// Tests de la herramienta de monitorización de tráfico, en modo memoria (sin
// AWS). Cubren lo crítico: que los valores sensibles se captan pero NUNCA se
// filtran, la clasificación de bots, el enmascarado de IP y el flujo del beacon.

const { test, before, after } = require('node:test');
const assert = require('node:assert');

delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;

const traffic = require('../src/services/trafficService');
const { parseUA, classifyBot, maskIp, redactEvent, buildEvent } = traffic._internals;
const app = require('../src/app');

// ── Unitarios ────────────────────────────────────────────────────────────────

test('maskIp elimina el último octeto en IPv4 y acorta IPv6', () => {
  assert.strictEqual(maskIp('85.123.45.200'), '85.123.45.x');
  assert.strictEqual(maskIp('2001:db8:1234:5678::1'), '2001:db8:1234::');
});

test('parseUA reconoce navegador, SO y dispositivo', () => {
  const chrome = parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0 Safari/537.36');
  assert.strictEqual(chrome.browser, 'Chrome');
  assert.strictEqual(chrome.os, 'Windows');
  assert.strictEqual(chrome.device, 'Desktop');
  const iphone = parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148');
  assert.strictEqual(iphone.os, 'iOS');
  assert.strictEqual(iphone.device, 'Mobile');
});

test('classifyBot detecta bots, buscadores y humanos', () => {
  assert.strictEqual(classifyBot('curl/8.4.0', false).isBot, true);
  assert.strictEqual(classifyBot('Mozilla/5.0 (compatible; Googlebot/2.1)', false).botKind, 'search-engine');
  assert.strictEqual(classifyBot('Mozilla/5.0 (Windows) Chrome/125', true).isBot, false);
  assert.strictEqual(classifyBot('Mozilla/5.0 (Windows) Chrome/125', false).botKind, 'unverified');
  assert.strictEqual(classifyBot('', false).isBot, true);
});

test('los valores sensibles se captan pero la vista redactada NUNCA los expone', () => {
  const req = {
    method: 'GET', path: '/api/items', originalUrl: '/api/items?secret=shh',
    socket: { remoteAddress: '10.20.30.40' },
    headers: {
      'user-agent': 'curl/8.4.0',
      authorization: 'Bearer SUPER-SECRET-TOKEN',
      cookie: 'session=abc123; token=xyz789',
    },
  };
  const ev = buildEvent(req, {});
  // Internamente se marca que se captaron.
  assert.strictEqual(ev.sensitiveCaptured, true);
  assert.strictEqual(ev.hasAuth, true);
  assert.strictEqual(ev.cookieCount, 2);
  // Pero el evento JAMÁS guarda el contenido en claro.
  const serialized = JSON.stringify(ev);
  assert.ok(!serialized.includes('SUPER-SECRET-TOKEN'));
  assert.ok(!serialized.includes('abc123'));
  assert.ok(!serialized.includes('secret=shh'));
  // Y la vista pública redactada tampoco.
  const red = JSON.stringify(redactEvent(ev));
  assert.ok(!red.includes('SUPER-SECRET-TOKEN') && !red.includes('abc123'));
  assert.match(red, /captured/);
  // La IP se muestra enmascarada, nunca completa.
  assert.ok(red.includes('10.20.30.x'));
  assert.ok(!red.includes('10.20.30.40'));
});

// ── Integración sobre la API ─────────────────────────────────────────────────

let server, base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('el beacon /api/traffic/track devuelve cookie de visitante', async () => {
  const res = await fetch(`${base}/api/traffic/track`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fp: 'testvisitor0001', screen: '1920x1080@2', timezone: 'Europe/Madrid', path: '/' }),
  });
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('set-cookie') || '', /vt_vid=testvisitor0001/);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
});

test('simulate puebla el dashboard y los agregados cuadran', async () => {
  await fetch(`${base}/api/traffic/simulate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count: 50 }),
  });
  const d = await fetch(`${base}/api/traffic`).then((r) => r.json());
  assert.ok(d.totals.hits >= 50);
  assert.strictEqual(d.totals.humans + d.totals.bots, d.totals.hits);
  assert.strictEqual(d.hourly.length, 24);
  assert.ok(Array.isArray(d.topCountries) && d.topCountries.length > 0);
  assert.ok(d.recent.length > 0);
  // Ningún evento del feed expone valores sensibles en claro.
  assert.ok(!JSON.stringify(d.recent).match(/Bearer |session=/));
});

test('el explorador de visitantes lista al visitante del beacon', async () => {
  const d = await fetch(`${base}/api/traffic/visitors`).then((r) => r.json());
  assert.ok(d.visitors.some((v) => v.id.startsWith('testvisitor')));
});

test('GET /api/traffic no queda registrado a sí mismo (no se autocontamina)', async () => {
  const before = (await fetch(`${base}/api/traffic`).then((r) => r.json())).totals.hits;
  await fetch(`${base}/api/traffic`);
  await fetch(`${base}/api/traffic`);
  const after = (await fetch(`${base}/api/traffic`).then((r) => r.json())).totals.hits;
  assert.strictEqual(before, after);
});
