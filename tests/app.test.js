// Integration tests for the whole API, without AWS: with no credentials the app
// enters memory mode, so these tests run the same locally and in CI.
//
//   npm test

const { test, before, after } = require('node:test');
const assert = require('node:assert');

// Force memory mode even if a .env with credentials exists.
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;

const app = require('../src/app');

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('GET /api/status/health responds ok', async () => {
  const res = await fetch(`${base}/api/status/health`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { ok: true });
});

test('GET /api/status reports memory mode without credentials', async () => {
  const res = await fetch(`${base}/api/status`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.storage.mode, 'memory');
  assert.strictEqual(body.dynamo.enabled, false);
});

test('full record CRUD', async () => {
  // Create
  const created = await fetch(`${base}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'test record' }),
  });
  assert.strictEqual(created.status, 201);
  const item = await created.json();
  assert.ok(item.id);
  assert.strictEqual(item.text, 'test record');

  // List
  const list = await fetch(`${base}/api/items`).then((r) => r.json());
  assert.ok(list.items.some((i) => i.id === item.id));

  // Delete
  const del = await fetch(`${base}/api/items/${item.id}`, { method: 'DELETE' });
  assert.strictEqual(del.status, 204);

  const after = await fetch(`${base}/api/items`).then((r) => r.json());
  assert.ok(!after.items.some((i) => i.id === item.id));
});

test('POST without text returns 400', async () => {
  const res = await fetch(`${base}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 400);
});

test('DELETE of a non-existent id returns 404', async () => {
  const res = await fetch(`${base}/api/items/does-not-exist`, { method: 'DELETE' });
  assert.strictEqual(res.status, 404);
});

test('serves the static frontend at /', async () => {
  const res = await fetch(`${base}/`);
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /vedtemplate/);
});
