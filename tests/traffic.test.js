// Tests for the traffic monitoring tool, in memory mode (no AWS). They cover
// the critical parts: that sensitive values are captured but NEVER leaked, bot
// classification, IP masking and the beacon flow.

const { test, before, after } = require('node:test');
const assert = require('node:assert');

delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;

const traffic = require('../src/services/trafficService');
const { parseUA, classifyBot, maskIp, redactEvent, buildEvent } = traffic._internals;
const app = require('../src/app');

// ── Unit ─────────────────────────────────────────────────────────────────────

test('maskIp drops the last octet in IPv4 and shortens IPv6', () => {
  assert.strictEqual(maskIp('85.123.45.200'), '85.123.45.x');
  assert.strictEqual(maskIp('2001:db8:1234:5678::1'), '2001:db8:1234::');
});

test('parseUA recognizes browser, OS and device', () => {
  const chrome = parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0 Safari/537.36');
  assert.strictEqual(chrome.browser, 'Chrome');
  assert.strictEqual(chrome.os, 'Windows');
  assert.strictEqual(chrome.device, 'Desktop');
  const iphone = parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148');
  assert.strictEqual(iphone.os, 'iOS');
  assert.strictEqual(iphone.device, 'Mobile');
});

test('classifyBot detects bots, search engines and humans', () => {
  assert.strictEqual(classifyBot('curl/8.4.0', false).isBot, true);
  assert.strictEqual(classifyBot('Mozilla/5.0 (compatible; Googlebot/2.1)', false).botKind, 'search-engine');
  assert.strictEqual(classifyBot('Mozilla/5.0 (Windows) Chrome/125', true).isBot, false);
  assert.strictEqual(classifyBot('Mozilla/5.0 (Windows) Chrome/125', false).botKind, 'unverified');
  assert.strictEqual(classifyBot('', false).isBot, true);
});

test('sensitive values are captured but the redacted view NEVER exposes them', () => {
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
  // Internally it's marked that they were captured.
  assert.strictEqual(ev.sensitiveCaptured, true);
  assert.strictEqual(ev.hasAuth, true);
  assert.strictEqual(ev.cookieCount, 2);
  // But the event NEVER stores the content in clear.
  const serialized = JSON.stringify(ev);
  assert.ok(!serialized.includes('SUPER-SECRET-TOKEN'));
  assert.ok(!serialized.includes('abc123'));
  assert.ok(!serialized.includes('secret=shh'));
  // Nor does the public redacted view.
  const red = JSON.stringify(redactEvent(ev));
  assert.ok(!red.includes('SUPER-SECRET-TOKEN') && !red.includes('abc123'));
  assert.match(red, /captured/);
  // The IP is shown masked, never in full.
  assert.ok(red.includes('10.20.30.x'));
  assert.ok(!red.includes('10.20.30.40'));
});

// ── API integration ──────────────────────────────────────────────────────────

let server, base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('the /api/traffic/track beacon returns a visitor cookie', async () => {
  const res = await fetch(`${base}/api/traffic/track`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fp: 'testvisitor0001', screen: '1920x1080@2', timezone: 'Europe/Madrid', path: '/' }),
  });
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('set-cookie') || '', /vt_vid=testvisitor0001/);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
});

test('simulate populates the dashboard and the aggregates add up', async () => {
  await fetch(`${base}/api/traffic/simulate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count: 50 }),
  });
  const d = await fetch(`${base}/api/traffic?range=24h&limit=2000`).then((r) => r.json());
  assert.ok(d.totals.hits >= 50);
  assert.strictEqual(d.totals.humans + d.totals.bots, d.totals.hits);
  assert.ok(d.series && Array.isArray(d.series.buckets) && d.series.buckets.length > 0);
  assert.ok(Array.isArray(d.topCountries) && d.topCountries.length > 0);
  assert.ok(d.events.length > 0);
  // No feed event exposes sensitive values in clear.
  assert.ok(!JSON.stringify(d.events).match(/Bearer |session=/));
});

test('the time range drives the series granularity', async () => {
  const day = await fetch(`${base}/api/traffic?range=24h`).then((r) => r.json());
  assert.strictEqual(day.series.unit, 'hour');
  const week = await fetch(`${base}/api/traffic?range=7d`).then((r) => r.json());
  assert.strictEqual(week.series.unit, 'day');
  const year = await fetch(`${base}/api/traffic?range=1y`).then((r) => r.json());
  assert.strictEqual(year.series.unit, 'month');
});

test('limit bounds the loaded events and flags capped', async () => {
  const d = await fetch(`${base}/api/traffic?range=24h&limit=50`).then((r) => r.json());
  assert.ok(d.events.length <= 50);
  assert.strictEqual(d.limit, 50);
  // With >50 simulated events in the last 24h, it must report capped.
  if (d.events.length === 50) assert.strictEqual(d.capped, true);
});

test('events carry sparse GSI1 keys but the redacted view strips them', () => {
  const req = {
    method: 'GET', path: '/', originalUrl: '/',
    socket: { remoteAddress: '1.2.3.4' },
    headers: { 'user-agent': 'curl/8', 'x-vercel-ip-country': 'es' },
  };
  const ev = buildEvent(req, {});
  assert.strictEqual(ev.gsi1pk, 'C#ES');
  assert.ok(ev.gsi1sk);
  assert.ok(!('gsi1pk' in redactEvent(ev)));
});

test('the country filter returns only that country', async () => {
  const d = await fetch(`${base}/api/traffic?range=24h&limit=2000&country=ES`).then((r) => r.json());
  assert.strictEqual(d.country, 'ES');
  for (const e of d.events) assert.strictEqual(e.country, 'ES');
});

test('a custom range only returns events inside the window', async () => {
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 3600e3).toISOString(); // last hour
  const d = await fetch(`${base}/api/traffic?range=custom&from=${from}&to=${to}&limit=2000`).then((r) => r.json());
  assert.strictEqual(d.range, 'custom');
  for (const e of d.events) {
    assert.ok(e.ts >= from && e.ts <= to, `event ${e.ts} outside [${from}, ${to}]`);
  }
});

test('the visitor explorer lists the beacon visitor', async () => {
  const d = await fetch(`${base}/api/traffic/visitors`).then((r) => r.json());
  assert.ok(d.visitors.some((v) => v.id.startsWith('testvisitor')));
});

test('GET /api/traffic is not recorded on itself (no self-pollution)', async () => {
  const before = (await fetch(`${base}/api/traffic`).then((r) => r.json())).totals.hits;
  await fetch(`${base}/api/traffic`);
  await fetch(`${base}/api/traffic`);
  const after = (await fetch(`${base}/api/traffic`).then((r) => r.json())).totals.hits;
  assert.strictEqual(before, after);
});
