// Tests de integración de la API completa, sin AWS: sin credenciales la app
// entra en modo memoria, así que estos tests corren igual en local y en CI.
//
//   npm test

const { test, before, after } = require('node:test');
const assert = require('node:assert');

// Garantizar modo memoria aunque exista un .env con credenciales.
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

test('GET /api/status/health responde ok', async () => {
  const res = await fetch(`${base}/api/status/health`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { ok: true });
});

test('GET /api/status indica modo memoria sin credenciales', async () => {
  const res = await fetch(`${base}/api/status`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.storage.mode, 'memoria');
  assert.strictEqual(body.dynamo.enabled, false);
});

test('CRUD completo de registros', async () => {
  // Crear
  const created = await fetch(`${base}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'registro de test' }),
  });
  assert.strictEqual(created.status, 201);
  const item = await created.json();
  assert.ok(item.id);
  assert.strictEqual(item.text, 'registro de test');

  // Listar
  const list = await fetch(`${base}/api/items`).then((r) => r.json());
  assert.ok(list.items.some((i) => i.id === item.id));

  // Borrar
  const del = await fetch(`${base}/api/items/${item.id}`, { method: 'DELETE' });
  assert.strictEqual(del.status, 204);

  const after = await fetch(`${base}/api/items`).then((r) => r.json());
  assert.ok(!after.items.some((i) => i.id === item.id));
});

test('POST sin texto devuelve 400', async () => {
  const res = await fetch(`${base}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 400);
});

test('DELETE de id inexistente devuelve 404', async () => {
  const res = await fetch(`${base}/api/items/no-existe`, { method: 'DELETE' });
  assert.strictEqual(res.status, 404);
});

test('sirve el frontend estático en /', async () => {
  const res = await fetch(`${base}/`);
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /Plantilla/);
});
