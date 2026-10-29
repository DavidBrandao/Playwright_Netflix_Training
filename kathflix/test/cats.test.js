const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx, token, admin;
before(async () => { ctx = await startApp(); token = await ctx.user(); admin = await ctx.admin(); });
after(async () => { await ctx.close(); });

test('usuário comum: 3 gatos (1, 2, 3), nenhum encontrado', async () => {
  const r = await ctx.call('GET', '/api/me/cats', { token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { total: 3, cats: [1, 2, 3], found: [], complete: false });
});

test('admin: 2 gatos (4, 5)', async () => {
  const r = await ctx.call('GET', '/api/me/cats', { token: admin });
  assert.deepEqual(r.body, { total: 2, cats: [4, 5], found: [], complete: false });
});

test('registrar gato é idempotente: 201 na primeira vez, 200 depois', async () => {
  const first = await ctx.call('POST', '/api/me/cats/3', { token });
  assert.equal(first.status, 201);
  assert.equal(first.body.newlyFound, true);
  assert.deepEqual(first.body.found, [3]);
  const again = await ctx.call('POST', '/api/me/cats/3', { token });
  assert.equal(again.status, 200);
  assert.equal(again.body.newlyFound, false);
  assert.deepEqual(again.body.found, [3]);
});

test('gato fora do conjunto do papel (ou inválido) devolve 400', async () => {
  for (const n of ['0', '4', '5', '6', 'abc', '1.5']) {
    assert.equal((await ctx.call('POST', `/api/me/cats/${n}`, { token })).status, 400, `user ${n}`);
  }
  for (const n of ['1', '2', '3', '6']) {
    assert.equal((await ctx.call('POST', `/api/me/cats/${n}`, { token: admin })).status, 400, `admin ${n}`);
  }
});

test('os gatos são por usuário', async () => {
  assert.deepEqual((await ctx.call('GET', '/api/me/cats', { token: admin })).body.found, []);
});

test('usuário completa ao achar 1, 2 e 3; DELETE zera', async () => {
  for (const n of [1, 2]) await ctx.call('POST', `/api/me/cats/${n}`, { token });
  const all = await ctx.call('GET', '/api/me/cats', { token });
  assert.deepEqual(all.body.found, [1, 2, 3]);
  assert.equal(all.body.complete, true);
  assert.equal((await ctx.call('DELETE', '/api/me/cats', { token })).status, 204);
  assert.deepEqual((await ctx.call('GET', '/api/me/cats', { token })).body.found, []);
});

test('admin completa ao achar 4 e 5', async () => {
  await ctx.call('POST', '/api/me/cats/4', { token: admin });
  const r = await ctx.call('POST', '/api/me/cats/5', { token: admin });
  assert.equal(r.body.complete, true);
  assert.equal(r.body.total, 2);
});

test('gatos exigem autenticação', async () => {
  assert.equal((await ctx.call('GET', '/api/me/cats')).status, 401);
  assert.equal((await ctx.call('POST', '/api/me/cats/1')).status, 401);
});

test('reset do test-api apaga os gatos', async () => {
  await ctx.call('POST', '/api/me/cats/1', { token });
  await ctx.call('POST', '/api/test/reset');
  assert.equal(ctx.app.locals.db.prepare('SELECT COUNT(*) c FROM lucky_cats').get().c, 0);
});
