// ═══════════════════════════════════════════════════════════════════════════
//  Monitorización, auditoría e identificación de accesos (traffic intelligence)
// ═══════════════════════════════════════════════════════════════════════════
//
// Captura cada acceso, identifica al visitante (fingerprint + señales de red),
// clasifica humano vs bot y produce agregados de tendencia. Pensado para correr
// gratis: bajo volumen, single-table DynamoDB con TTL, o memoria sin AWS.
//
// PRIVACIDAD (la app es pública): los valores sensibles de request/response se
// CAPTAN pero NUNCA se almacenan ni se exponen en claro. De la IP guardamos solo
// una versión enmascarada (para geolocalizar a groso modo) y un hash con sal
// (para contar únicos sin revelar la IP). De cabeceras como Authorization o
// Cookie guardamos únicamente que existían y cuántas, jamás su contenido.
//
// Modelo de datos (prefijos de pk):
//   EVENT   pk="EVENT"   sk="<iso>#<id>"   ttl=7d   → un acceso
//   VISITOR pk="VISITOR" sk="<fingerprint>"          → perfil de visitante
//
// Los agregados del dashboard se calculan al vuelo sobre los eventos recientes
// (Query acotada). Con TTL la tabla se mantiene pequeña: coste ~0 y sin rollups
// que puedan desincronizarse. Filosofía de la plantilla: máxima relación
// calidad/precio.

const crypto = require('crypto');
const { QueryCommand, PutCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { getDocClient, isDynamoEnabled, TABLE_NAME, KEYS } = require('../config/dynamo');

const EVENT_TTL_DAYS = 7;
const MAX_SCAN = 3000;           // techo de eventos leídos para agregar
const SALT = process.env.TRACK_SALT || 'vedtemplate-privacy-salt';

// ── Almacén en memoria (fallback sin AWS) ───────────────────────────────────
const mem = { events: [], visitors: new Map() };
const MEM_CAP = 5000;

// ── Utilidades de red / privacidad ──────────────────────────────────────────

function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || '';
}

// Enmascara la IP: IPv4 pierde el último octeto, IPv6 conserva 3 hextets.
function maskIp(ip) {
  if (!ip) return '';
  if (ip.includes('.')) {
    const p = ip.split('.');
    if (p.length === 4) return `${p[0]}.${p[1]}.${p[2]}.x`;
  }
  if (ip.includes(':')) {
    const p = ip.split(':').filter(Boolean);
    return p.slice(0, 3).join(':') + '::';
  }
  return 'x';
}

// Hash con sal: permite contar visitantes únicos sin guardar la IP real.
function hashIp(ip) {
  if (!ip) return '';
  return crypto.createHash('sha256').update(SALT + '|' + ip).digest('hex').slice(0, 12);
}

// Geolocalización aproximada. En Vercel llega en cabeceras del edge; en local
// no hay, así que se marca como desconocida.
function geoFromReq(req) {
  const h = req.headers;
  const cc = (h['x-vercel-ip-country'] || '').toUpperCase();
  return {
    country: cc || (process.env.VERCEL ? 'ZZ' : 'LOCAL'),
    city: h['x-vercel-ip-city'] ? decodeURIComponent(h['x-vercel-ip-city']) : '',
    region: h['x-vercel-ip-country-region'] || '',
  };
}

// ── Parsing de User-Agent (ligero, sin dependencias) ────────────────────────

function parseUA(ua = '') {
  const u = ua.toLowerCase();
  let browser = 'Unknown';
  if (/edg\//.test(u)) browser = 'Edge';
  else if (/opr\/|opera/.test(u)) browser = 'Opera';
  else if (/chrome\/|crios/.test(u)) browser = 'Chrome';
  else if (/firefox\/|fxios/.test(u)) browser = 'Firefox';
  else if (/safari\//.test(u)) browser = 'Safari';

  let os = 'Unknown';
  if (/windows/.test(u)) os = 'Windows';
  else if (/android/.test(u)) os = 'Android';
  else if (/iphone|ipad|ipod/.test(u)) os = 'iOS';
  else if (/mac os x|macintosh/.test(u)) os = 'macOS';
  else if (/linux/.test(u)) os = 'Linux';

  let device = 'Desktop';
  if (/mobile|iphone|ipod|android.*mobile/.test(u)) device = 'Mobile';
  else if (/ipad|tablet|android(?!.*mobile)/.test(u)) device = 'Tablet';

  return { browser, os, device };
}

// ── Detección de bots ───────────────────────────────────────────────────────
// Dos señales: firma en el User-Agent y ausencia de beacon JS. Un acceso que
// nunca ejecuta el beacon del navegador es sospechoso de automatización.

const BOT_RE = /(bot|crawl|spider|slurp|mediapartners|adsbot|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|embedly|preview|headless|phantom|selenium|playwright|puppeteer|python-requests|curl|wget|axios|node-fetch|go-http|java\/|okhttp|scrapy|semrush|ahrefs|mj12|dotbot|petalbot)/i;
const KNOWN_GOOD = /(googlebot|bingbot|duckduckbot|applebot|yandex|baiduspider)/i;

function classifyBot(ua, beacon) {
  if (!ua) return { isBot: true, botKind: 'no-ua', botReason: 'Sin User-Agent' };
  if (KNOWN_GOOD.test(ua)) return { isBot: true, botKind: 'search-engine', botReason: 'Buscador conocido' };
  if (BOT_RE.test(ua)) return { isBot: true, botKind: 'bot', botReason: 'Firma de bot en el UA' };
  if (beacon) return { isBot: false, botKind: 'human', botReason: 'Beacon JS confirmado' };
  return { isBot: false, botKind: 'unverified', botReason: 'Sin beacon (no confirmado)' };
}

// ── Cookies (parser minúsculo, sin cookie-parser) ───────────────────────────

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

const VID_COOKIE = 'vt_vid';

// ── Construcción de un evento ───────────────────────────────────────────────

function buildEvent(req, { beacon = false, client = null, type = 'api' } = {}) {
  const ua = req.headers['user-agent'] || '';
  const ip = clientIp(req);
  const geo = geoFromReq(req);
  const bot = classifyBot(ua, beacon);
  const now = new Date();

  // Valores sensibles: se CAPTAN (se leen) pero solo se guarda su existencia.
  const cookieCount = (req.headers.cookie || '').split(';').filter((c) => c.trim()).length;
  const hasAuth = Boolean(req.headers.authorization);
  const hasQuery = req.originalUrl?.includes('?') || false;

  const visitorId = (client && client.fp) || readCookie(req, VID_COOKIE) || hashIp(ip);

  return {
    id: crypto.randomUUID(),
    ts: now.toISOString(),
    type,                                   // 'pageview' (beacon) | 'api'
    method: req.method,
    path: (req.path || req.originalUrl || '/').split('?')[0].slice(0, 200),
    ipMasked: maskIp(ip),
    ipHash: hashIp(ip),
    country: geo.country,
    city: geo.city,
    region: geo.region,
    ...parseUA(ua),
    uaRaw: ua.slice(0, 300),
    referer: '',                            // se rellena abajo sin query
    refererHost: '',
    ...bot,
    beacon,
    visitorId,
    // Señales sensibles: presencia, jamás contenido.
    hasAuth,
    cookieCount,
    hasQuery,
    sensitiveCaptured: hasAuth || cookieCount > 0 || hasQuery,
    ttl: Math.floor(now.getTime() / 1000) + EVENT_TTL_DAYS * 86400,
  };
}

function withReferer(ev, refererRaw) {
  const ref = (refererRaw || '').split('?')[0];
  ev.referer = ref.slice(0, 200);
  try { ev.refererHost = ref ? new URL(ref).hostname : ''; } catch { ev.refererHost = ''; }
  return ev;
}

// ── Persistencia ────────────────────────────────────────────────────────────

async function saveEvent(ev) {
  if (!isDynamoEnabled()) {
    mem.events.push(ev);
    if (mem.events.length > MEM_CAP) mem.events.splice(0, mem.events.length - MEM_CAP);
    return;
  }
  await getDocClient().send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { pk: KEYS.EVENT, sk: `${ev.ts}#${ev.id}`, ...ev },
  }));
}

async function upsertVisitor(ev, client) {
  const fp = ev.visitorId;
  if (!fp) return;
  if (!isDynamoEnabled()) {
    const prev = mem.visitors.get(fp) || { fp, firstSeen: ev.ts, hits: 0 };
    mem.visitors.set(fp, {
      ...prev,
      lastSeen: ev.ts,
      hits: prev.hits + 1,
      humanConfirmed: prev.humanConfirmed || ev.beacon,
      country: ev.country,
      device: ev.device,
      browser: ev.browser,
      os: ev.os,
      isBot: ev.isBot && !ev.beacon,
      ...(client ? {
        screen: client.screen, timezone: client.timezone,
        languages: client.languages, cores: client.cores, memory: client.memory,
      } : {}),
    });
    return;
  }
  const names = { '#h': 'hits', '#ls': 'lastSeen', '#hc': 'humanConfirmed',
    '#c': 'country', '#d': 'device', '#b': 'browser', '#o': 'os', '#fs': 'firstSeen' };
  const values = {
    ':one': 1, ':ts': ev.ts, ':beacon': ev.beacon,
    ':c': ev.country, ':d': ev.device, ':b': ev.browser, ':o': ev.os, ':false': false,
  };
  let expr = 'SET #ls = :ts, #c = :c, #d = :d, #b = :b, #o = :o, '
    + '#hc = if_not_exists(#hc, :false) OR :beacon, #fs = if_not_exists(#fs, :ts) '
    + 'ADD #h :one';
  if (client) {
    Object.assign(names, { '#sc': 'screen', '#tz': 'timezone', '#lg': 'languages', '#cr': 'cores', '#mm': 'memory' });
    Object.assign(values, { ':sc': client.screen || '', ':tz': client.timezone || '', ':lg': client.languages || '', ':cr': client.cores || 0, ':mm': client.memory || 0 });
    expr = expr.replace('ADD', ', #sc = :sc, #tz = :tz, #lg = :lg, #cr = :cr, #mm = :mm ADD');
  }
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: KEYS.VISITOR, sk: fp },
    UpdateExpression: expr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

// ── API pública del servicio ────────────────────────────────────────────────

// Registra un acceso desde el middleware (server-side). Fire-and-forget.
async function record(req) {
  try {
    const ev = withReferer(buildEvent(req, { type: 'api' }), req.headers.referer || req.headers.referrer);
    await saveEvent(ev);
    await upsertVisitor(ev, null);
  } catch (err) {
    console.error('traffic.record', err.message);
  }
}

// Registra una visita desde el beacon del navegador (con fingerprint).
async function track(req, client) {
  const ev = withReferer(
    buildEvent(req, { beacon: true, client, type: 'pageview' }),
    (client && client.referrer) || req.headers.referer,
  );
  if (client && client.path) ev.path = String(client.path).split('?')[0].slice(0, 200);
  await saveEvent(ev);
  await upsertVisitor(ev, client);
  return { visitorId: ev.visitorId, country: ev.country, isBot: ev.isBot, cookie: VID_COOKIE };
}

// Inyecta accesos sintéticos para poder DEMOSTRAR el dashboard con datos vivos.
async function simulate(count = 40) {
  const countries = ['ES', 'US', 'DE', 'FR', 'GB', 'MX', 'AR', 'BR', 'IT', 'NL', 'JP', 'ZZ'];
  const paths = ['/', '/', '/', '/api/status', '/api/items', '/api/track', '/robots.txt', '/sitemap.xml'];
  const humans = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36',
  ];
  const bots = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'python-requests/2.31.0',
    'curl/8.4.0',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  ];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const n = Math.min(Math.max(1, count), 200);
  for (let i = 0; i < n; i++) {
    const isBot = Math.random() < 0.35;
    const ua = isBot ? pick(bots) : pick(humans);
    const beacon = !isBot && Math.random() < 0.85;
    // Reparte los timestamps en las últimas 24h para que la serie temporal tenga forma.
    const ago = Math.pow(Math.random(), 1.6) * 24 * 3600 * 1000;
    const ts = new Date(Date.now() - ago);
    const ip = `${10 + (i % 90)}.${i % 255}.${(i * 7) % 255}.${(i * 13) % 255}`;
    const fakeReq = {
      method: pick(['GET', 'GET', 'GET', 'POST']),
      path: pick(paths),
      originalUrl: pick(paths),
      socket: { remoteAddress: ip },
      headers: {
        'user-agent': ua,
        'x-vercel-ip-country': pick(countries),
        referer: Math.random() < 0.5 ? pick(['https://www.google.com/', 'https://github.com/', 'https://t.co/', '']) : '',
      },
    };
    const ev = withReferer(buildEvent(fakeReq, { beacon, type: beacon ? 'pageview' : 'api' }), fakeReq.headers.referer);
    ev.ts = ts.toISOString();
    ev.ttl = Math.floor(ts.getTime() / 1000) + EVENT_TTL_DAYS * 86400;
    ev.synthetic = true;
    await saveEvent(ev);
    await upsertVisitor(ev, null);
  }
  return { inserted: n };
}

// ── Lectura y agregación ────────────────────────────────────────────────────

async function recentEvents(limit = MAX_SCAN) {
  if (!isDynamoEnabled()) {
    return [...mem.events].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
  }
  const res = await getDocClient().send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': KEYS.EVENT },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return res.Items || [];
}

async function listVisitors(limit = 100) {
  if (!isDynamoEnabled()) {
    return [...mem.visitors.values()].sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '')).slice(0, limit);
  }
  const res = await getDocClient().send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': KEYS.VISITOR },
    Limit: limit,
  }));
  return (res.Items || []).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
}

function topCounts(events, field, n = 8) {
  const m = new Map();
  for (const e of events) {
    const k = e[field] || '—';
    if (!k || k === '—') continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count).slice(0, n);
}

// Vista redactada de un evento (lo que SÍ se puede mostrar en público).
function redactEvent(e) {
  return {
    ts: e.ts, type: e.type, method: e.method, path: e.path,
    ipMasked: e.ipMasked, country: e.country, city: e.city,
    browser: e.browser, os: e.os, device: e.device,
    isBot: e.isBot, botKind: e.botKind, botReason: e.botReason, beacon: e.beacon,
    refererHost: e.refererHost, visitorId: (e.visitorId || '').slice(0, 8),
    // Marcador de sensibles: se capturaron pero no se muestran.
    sensitive: e.sensitiveCaptured
      ? { captured: true, note: 'Valores sensibles captados y redactados', hasAuth: e.hasAuth, cookies: e.cookieCount }
      : { captured: false },
    synthetic: Boolean(e.synthetic),
  };
}

function bucketHourly(events, hours = 24) {
  const now = Date.now();
  const buckets = [];
  for (let i = hours - 1; i >= 0; i--) {
    const start = now - (i + 1) * 3600e3;
    const end = now - i * 3600e3;
    const label = new Date(end).toISOString().slice(11, 13) + 'h';
    let human = 0, bot = 0;
    for (const e of events) {
      const t = Date.parse(e.ts);
      if (t > start && t <= end) (e.isBot ? bot++ : human++);
    }
    buckets.push({ label, human, bot, total: human + bot });
  }
  return buckets;
}

function windowCount(events, sinceMs, untilMs = Infinity) {
  const now = Date.now();
  let c = 0;
  for (const e of events) {
    const age = now - Date.parse(e.ts);
    if (age >= sinceMs && age < untilMs) c++;
  }
  return c;
}

function pct(cur, prev) {
  if (!prev) return cur ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

async function getDashboard() {
  const events = await recentEvents();
  const total = events.length;
  const humans = events.filter((e) => !e.isBot).length;
  const bots = total - humans;
  const confirmed = events.filter((e) => e.beacon).length;
  const uniqueVisitors = new Set(events.map((e) => e.visitorId).filter(Boolean)).size;

  const last1h = windowCount(events, 0, 3600e3);
  const prev1h = windowCount(events, 3600e3, 2 * 3600e3);
  const last24h = windowCount(events, 0, 24 * 3600e3);
  const prev24h = windowCount(events, 24 * 3600e3, 48 * 3600e3);

  return {
    generatedAt: new Date().toISOString(),
    mode: isDynamoEnabled() ? 'dynamodb' : 'memory',
    totals: { hits: total, humans, bots, confirmedHumans: confirmed, uniqueVisitors },
    trend: {
      hour: { current: last1h, previous: prev1h, changePct: pct(last1h, prev1h) },
      day: { current: last24h, previous: prev24h, changePct: pct(last24h, prev24h) },
    },
    hourly: bucketHourly(events, 24),
    topCountries: topCounts(events, 'country'),
    topPaths: topCounts(events, 'path'),
    topReferrers: topCounts(events, 'refererHost'),
    browsers: topCounts(events, 'browser', 6),
    os: topCounts(events, 'os', 6),
    devices: topCounts(events, 'device', 4),
    botKinds: topCounts(events, 'botKind', 6),
    recent: events.slice(0, 30).map(redactEvent),
  };
}

async function getVisitorsView(limit = 60) {
  const visitors = await listVisitors(limit);
  return {
    count: visitors.length,
    visitors: visitors.map((v) => ({
      id: (v.fp || '').slice(0, 12),
      firstSeen: v.firstSeen, lastSeen: v.lastSeen, hits: v.hits || 0,
      humanConfirmed: Boolean(v.humanConfirmed), isBot: Boolean(v.isBot),
      country: v.country, device: v.device, browser: v.browser, os: v.os,
      screen: v.screen || '', timezone: v.timezone || '',
    })),
  };
}

module.exports = {
  record, track, simulate, getDashboard, getVisitorsView,
  // exportados para tests
  _internals: { parseUA, classifyBot, maskIp, redactEvent, buildEvent, withReferer },
};
