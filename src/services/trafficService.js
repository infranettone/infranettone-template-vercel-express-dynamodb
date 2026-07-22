// ═══════════════════════════════════════════════════════════════════════════
//  Access monitoring, auditing and identification (traffic intelligence)
// ═══════════════════════════════════════════════════════════════════════════
//
// Captures every access, identifies the visitor (fingerprint + network
// signals), classifies human vs bot and produces trend aggregates. Built to run
// for free: low volume, single-table DynamoDB with TTL, or memory without AWS.
//
// PRIVACY (the app is public): sensitive request/response values are CAPTURED
// but NEVER stored or exposed in clear. For the IP we keep only a masked version
// (for coarse geolocation) and a salted hash (to count uniques without revealing
// the IP). For headers like Authorization or Cookie we keep only whether they
// were present and how many, never their content.
//
// Data model (pk prefixes):
//   EVENT   pk="EVENT"   sk="<iso>#<id>"   ttl=7d   → one access
//   VISITOR pk="VISITOR" sk="<fingerprint>"          → visitor profile
//
// The dashboard aggregates are computed on the fly over recent events (bounded
// Query). With TTL the table stays small: ~0 cost and no rollups that could
// drift out of sync. Template philosophy: best value for money.

const crypto = require('crypto');
const { QueryCommand, PutCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { getDocClient, isDynamoEnabled, TABLE_NAME, KEYS } = require('../config/dynamo');

const EVENT_TTL_DAYS = 7;
const SALT = process.env.TRACK_SALT || 'vedtemplate-privacy-salt';

// ── In-memory store (fallback without AWS) ──────────────────────────────────
const mem = { events: [], visitors: new Map() };
const MEM_CAP = 5000;

// ── Network / privacy utilities ─────────────────────────────────────────────

function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || '';
}

// Mask the IP: IPv4 drops the last octet, IPv6 keeps 3 hextets.
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

// Salted hash: lets us count unique visitors without storing the real IP.
function hashIp(ip) {
  if (!ip) return '';
  return crypto.createHash('sha256').update(SALT + '|' + ip).digest('hex').slice(0, 12);
}

// Approximate geolocation. On Vercel it arrives in edge headers; locally there
// is none, so it's marked as unknown.
function geoFromReq(req) {
  const h = req.headers;
  const cc = (h['x-vercel-ip-country'] || '').toUpperCase();
  return {
    country: cc || (process.env.VERCEL ? 'ZZ' : 'LOCAL'),
    city: h['x-vercel-ip-city'] ? decodeURIComponent(h['x-vercel-ip-city']) : '',
    region: h['x-vercel-ip-country-region'] || '',
  };
}

// ── User-Agent parsing (lightweight, no dependencies) ───────────────────────

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

// ── Bot detection ───────────────────────────────────────────────────────────
// Two signals: a signature in the User-Agent and the absence of the JS beacon.
// An access that never runs the browser beacon is suspected of automation.

const BOT_RE = /(bot|crawl|spider|slurp|mediapartners|adsbot|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|embedly|preview|headless|phantom|selenium|playwright|puppeteer|python-requests|curl|wget|axios|node-fetch|go-http|java\/|okhttp|scrapy|semrush|ahrefs|mj12|dotbot|petalbot)/i;
const KNOWN_GOOD = /(googlebot|bingbot|duckduckbot|applebot|yandex|baiduspider)/i;

function classifyBot(ua, beacon) {
  if (!ua) return { isBot: true, botKind: 'no-ua', botReason: 'No User-Agent' };
  if (KNOWN_GOOD.test(ua)) return { isBot: true, botKind: 'search-engine', botReason: 'Known search engine' };
  if (BOT_RE.test(ua)) return { isBot: true, botKind: 'bot', botReason: 'Bot signature in UA' };
  if (beacon) return { isBot: false, botKind: 'human', botReason: 'JS beacon confirmed' };
  return { isBot: false, botKind: 'unverified', botReason: 'No beacon (unconfirmed)' };
}

// ── Cookies (tiny parser, no cookie-parser) ─────────────────────────────────

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

const VID_COOKIE = 'vt_vid';

// ── Building an event ───────────────────────────────────────────────────────

function buildEvent(req, { beacon = false, client = null, type = 'api' } = {}) {
  const ua = req.headers['user-agent'] || '';
  const ip = clientIp(req);
  const geo = geoFromReq(req);
  const bot = classifyBot(ua, beacon);
  const now = new Date();

  // Sensitive values: they are CAPTURED (read) but only their existence is stored.
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
    referer: '',                            // filled below without the query
    refererHost: '',
    ...bot,
    beacon,
    visitorId,
    // GSI1: lets the dashboard filter by country over a time range straight
    // from DynamoDB (see infra/dynamodb.yml). Sparse — only events set it.
    gsi1pk: 'C#' + geo.country,
    gsi1sk: now.toISOString(),
    // Sensitive signals: presence only, never content.
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

// ── Persistence ─────────────────────────────────────────────────────────────

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
  // DynamoDB doesn't support boolean operators (OR) in UpdateExpression, so the
  // "humanConfirmed" part is built conditionally in JS.
  const names = {
    '#h': 'hits', '#ls': 'lastSeen', '#fs': 'firstSeen', '#hc': 'humanConfirmed', '#fp': 'fp',
    '#c': 'country', '#d': 'device', '#b': 'browser', '#o': 'os', '#ib': 'isBot',
  };
  const values = {
    ':one': 1, ':ts': ev.ts, ':fp': fp,
    ':c': ev.country, ':d': ev.device, ':b': ev.browser, ':o': ev.os, ':ib': ev.isBot && !ev.beacon,
  };
  const sets = [
    '#ls = :ts', '#fs = if_not_exists(#fs, :ts)', '#fp = :fp',
    '#c = :c', '#d = :d', '#b = :b', '#o = :o', '#ib = :ib',
  ];
  if (ev.beacon) { sets.push('#hc = :true'); values[':true'] = true; }
  else { sets.push('#hc = if_not_exists(#hc, :false)'); values[':false'] = false; }
  if (client) {
    Object.assign(names, { '#sc': 'screen', '#tz': 'timezone', '#lg': 'languages', '#cr': 'cores', '#mm': 'memory' });
    sets.push('#sc = :sc', '#tz = :tz', '#lg = :lg', '#cr = :cr', '#mm = :mm');
    Object.assign(values, { ':sc': client.screen || '', ':tz': client.timezone || '', ':lg': client.languages || '', ':cr': client.cores || 0, ':mm': client.memory || 0 });
  }
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: KEYS.VISITOR, sk: fp },
    UpdateExpression: 'SET ' + sets.join(', ') + ' ADD #h :one',
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

// ── Public service API ──────────────────────────────────────────────────────

// Records an access from the middleware (server-side). Fire-and-forget.
async function record(req) {
  try {
    const ev = withReferer(buildEvent(req, { type: 'api' }), req.headers.referer || req.headers.referrer);
    await saveEvent(ev);
    await upsertVisitor(ev, null);
  } catch (err) {
    console.error('traffic.record', err.message);
  }
}

// Records a visit from the browser beacon (with fingerprint).
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

// Injects synthetic accesses so the dashboard can be DEMONSTRATED with live data.
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
    // Spread timestamps over the last 24h so the time series has shape.
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

// ── Reading and aggregation ─────────────────────────────────────────────────

// Time ranges the dashboard offers (like AWS consoles): fixed spans plus a
// custom [from, to]. Everything downstream is driven by the resolved window.
const RANGE_SPANS = {
  '1h': 3600e3,
  '24h': 24 * 3600e3,
  '7d': 7 * 86400e3,
  '30d': 30 * 86400e3,
  '90d': 90 * 86400e3,
  '1y': 365 * 86400e3,
};
const LIMIT_MIN = 50;
const LIMIT_MAX = 2000;   // caps the payload and bounds reads over huge tables

function resolveWindow({ range = '24h', from, to } = {}) {
  const now = Date.now();
  if (range === 'custom' && from) {
    const startMs = Date.parse(from);
    const endMs = to ? Date.parse(to) : now;
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs < endMs) {
      return { startMs, endMs, range: 'custom' };
    }
  }
  const span = RANGE_SPANS[range] || RANGE_SPANS['24h'];
  return { startMs: now - span, endMs: now, range: RANGE_SPANS[range] ? range : '24h' };
}

function clampLimit(v) {
  return Math.min(Math.max(Number(v) || 500, LIMIT_MIN), LIMIT_MAX);
}

// Reads events within [startMs, endMs], newest first, bounded by `limit`.
// On DynamoDB this is a range Query on the sort key (sk = "<iso>#<id>"), so only
// the matching key range is read — it scales to huge tables because narrowing
// the time range narrows the scan. When `country` is set it queries GSI1
// instead (gsi1pk = "C#<country>"), so a country filter is just as efficient at
// scale. Paginates until it reaches `limit`.
async function queryEvents({ startMs, endMs, limit, country }) {
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  if (!isDynamoEnabled()) {
    return mem.events
      .filter((e) => {
        const t = Date.parse(e.ts);
        return t >= startMs && t <= endMs && (!country || e.country === country);
      })
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, limit);
  }
  const base = country
    ? {
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk BETWEEN :a AND :b',
        ExpressionAttributeValues: { ':pk': 'C#' + country, ':a': startIso, ':b': endIso + '￿' },
      }
    : {
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :a AND :b',
        ExpressionAttributeValues: { ':pk': KEYS.EVENT, ':a': startIso, ':b': endIso + '￿' },
      };
  const out = [];
  let ExclusiveStartKey;
  let pages = 0;
  do {
    const res = await getDocClient().send(new QueryCommand({
      TableName: TABLE_NAME,
      ...base,
      ScanIndexForward: false,
      Limit: Math.min(limit - out.length, 1000),
      ExclusiveStartKey,
    }));
    out.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey && out.length < limit && ++pages < 50);
  return out.slice(0, limit);
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

// Redacted view of an event (what CAN be shown publicly).
function redactEvent(e) {
  return {
    ts: e.ts, type: e.type, method: e.method, path: e.path,
    ipMasked: e.ipMasked, country: e.country, city: e.city,
    browser: e.browser, os: e.os, device: e.device,
    isBot: e.isBot, botKind: e.botKind, botReason: e.botReason, beacon: e.beacon,
    refererHost: e.refererHost, visitorId: (e.visitorId || '').slice(0, 8),
    // Sensitive marker: captured but not shown.
    sensitive: e.sensitiveCaptured
      ? { captured: true, note: 'Sensitive values captured and redacted', hasAuth: e.hasAuth, cookies: e.cookieCount }
      : { captured: false },
    synthetic: Boolean(e.synthetic),
  };
}

// Adaptive time series: the bucket unit follows the window length so the chart
// stays readable at any range (hours for ≤2 days, days for ≤~3 months, months
// beyond). Fills empty buckets with zeros so the axis is continuous.
function seriesUnit(spanMs) {
  if (spanMs <= 2 * 86400e3) return 'hour';
  if (spanMs <= 92 * 86400e3) return 'day';
  return 'month';
}
function bucketKey(d, unit) {
  const iso = d.toISOString();
  if (unit === 'hour') return iso.slice(0, 13);   // YYYY-MM-DDTHH
  if (unit === 'day') return iso.slice(0, 10);     // YYYY-MM-DD
  return iso.slice(0, 7);                           // YYYY-MM
}
function bucketLabel(key, unit) {
  if (unit === 'hour') return key.slice(11, 13) + 'h';
  if (unit === 'day') return key.slice(5);         // MM-DD
  return key;                                       // YYYY-MM
}
function floorToUnit(ms, unit) {
  const d = new Date(ms);
  if (unit === 'hour') d.setUTCMinutes(0, 0, 0);
  else if (unit === 'day') d.setUTCHours(0, 0, 0, 0);
  else { d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); }
  return d;
}
function stepUnit(d, unit) {
  const n = new Date(d);
  if (unit === 'hour') n.setUTCHours(n.getUTCHours() + 1);
  else if (unit === 'day') n.setUTCDate(n.getUTCDate() + 1);
  else n.setUTCMonth(n.getUTCMonth() + 1);
  return n;
}
function buildSeries(events, startMs, endMs) {
  const unit = seriesUnit(endMs - startMs);
  const counts = new Map();
  for (const e of events) {
    const k = bucketKey(new Date(Date.parse(e.ts)), unit);
    const c = counts.get(k) || { human: 0, bot: 0 };
    e.isBot ? c.bot++ : c.human++;
    counts.set(k, c);
  }
  const buckets = [];
  let d = floorToUnit(startMs, unit);
  let guard = 0;
  while (d.getTime() <= endMs && guard++ < 1500) {
    const k = bucketKey(d, unit);
    const c = counts.get(k) || { human: 0, bot: 0 };
    buckets.push({ label: bucketLabel(k, unit), human: c.human, bot: c.bot, total: c.human + c.bot });
    d = stepUnit(d, unit);
  }
  return { unit, buckets };
}

function pct(cur, prev) {
  if (!prev) return cur ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

// Momentum within the selected window: recent half vs older half of the loaded
// events. Needs no extra query and answers "is it trending up right now?".
function trendHalves(events, startMs, endMs) {
  const mid = startMs + (endMs - startMs) / 2;
  let recent = 0, older = 0;
  for (const e of events) { (Date.parse(e.ts) >= mid ? recent++ : older++); }
  return { recent, older, changePct: pct(recent, older) };
}

async function getDashboard(opts = {}) {
  const limit = clampLimit(opts.limit);
  const { startMs, endMs, range } = resolveWindow(opts);
  const country = opts.country ? String(opts.country).toUpperCase().slice(0, 8) : '';
  const events = await queryEvents({ startMs, endMs, limit, country });
  const total = events.length;
  const capped = total >= limit;   // hit the ceiling → there may be more in range
  const humans = events.filter((e) => !e.isBot).length;
  const bots = total - humans;
  const confirmed = events.filter((e) => e.beacon).length;
  const uniqueVisitors = new Set(events.map((e) => e.visitorId).filter(Boolean)).size;

  return {
    generatedAt: new Date().toISOString(),
    mode: isDynamoEnabled() ? 'dynamodb' : 'memory',
    range,
    country: country || null,
    window: { from: new Date(startMs).toISOString(), to: new Date(endMs).toISOString() },
    limit, scanned: total, capped,
    totals: { hits: total, humans, bots, confirmedHumans: confirmed, uniqueVisitors },
    trend: trendHalves(events, startMs, endMs),
    series: buildSeries(events, startMs, endMs),
    topCountries: topCounts(events, 'country'),
    topPaths: topCounts(events, 'path'),
    topReferrers: topCounts(events, 'refererHost'),
    browsers: topCounts(events, 'browser', 6),
    os: topCounts(events, 'os', 6),
    devices: topCounts(events, 'device', 4),
    botKinds: topCounts(events, 'botKind', 6),
    // Full ranged+limited set (redacted); the client sorts/filters/paginates it.
    events: events.map(redactEvent),
  };
}

async function getVisitorsView(limit = 200) {
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
  // exported for tests
  _internals: { parseUA, classifyBot, maskIp, redactEvent, buildEvent, withReferer },
};
