const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx, token;
before(async () => { ctx = await startApp(); token = await ctx.user(); });
after(async () => { await ctx.close(); });

test('começa sem nenhum gato encontrado', async () => {
  const r = await ctx.call('GET', '/api/me/cats', { token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { total: 5, found: [], complete: false });
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

test('número de gato fora de 1..5 devolve 400', async () => {
  for (const n of ['0', '6', 'abc', '1.5']) {
    assert.equal((await ctx.call('POST', `/api/me/cats/${n}`, { token })).status, 400, n);
  }
});

test('os gatos são por usuário', async () => {
  const admin = await ctx.admin();
  assert.deepEqual((await ctx.call('GET', '/api/me/cats', { token: admin })).body.found, []);
});

test('ao achar os 5, complete fica true; DELETE zera', async () => {
  for (const n of [1, 2, 4, 5]) await ctx.call('POST', `/api/me/cats/${n}`, { token });
  const all = await ctx.call('GET', '/api/me/cats', { token });
  assert.deepEqual(all.body.found, [1, 2, 3, 4, 5]);
  assert.equal(all.body.complete, true);
  assert.equal((await ctx.call('DELETE', '/api/me/cats', { token })).status, 204);
  assert.deepEqual((await ctx.call('GET', '/api/me/cats', { token })).body, { total: 5, found: [], complete: false });
});

test('gatos exigem autenticação', async () => {
  assert.equal((await ctx.call('GET', '/api/me/cats')).status, 401);
  assert.equal((await ctx.call('POST', '/api/me/cats/1')).status, 401);
});

test('remover o usuário apaga os gatos dele; reset do test-api também', async () => {
  await ctx.call('POST', '/api/me/cats/1', { token });
  await ctx.call('POST', '/api/test/reset');
  const t2 = await ctx.user();
  assert.deepEqual((await ctx.call('GET', '/api/me/cats', { token: t2 })).body.found, []);
  assert.equal(ctx.app.locals.db.prepare('SELECT COUNT(*) c FROM lucky_cats').get().c, 0);
});
