const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx, token;
before(async () => { ctx = await startApp(); token = await ctx.user(); });
after(async () => { await ctx.close(); });

test('favoritar, listar e desfavoritar', async () => {
  const all = await ctx.call('GET', '/api/titles', { token });
  const id = all.body[0].id;
  assert.equal((await ctx.call('POST', `/api/favorites/${id}`, { token })).status, 201);
  assert.equal((await ctx.call('POST', `/api/favorites/${id}`, { token })).status, 201); // idempotente
  const list = await ctx.call('GET', '/api/favorites', { token });
  assert.deepEqual(list.body.map((t) => t.id), [id]);
  assert.equal(list.body[0].favorite, true);
  assert.equal((await ctx.call('DELETE', `/api/favorites/${id}`, { token })).status, 204);
  assert.equal((await ctx.call('GET', '/api/favorites', { token })).body.length, 0);
});

test('favoritar título inexistente devolve 404', async () => {
  assert.equal((await ctx.call('POST', '/api/favorites/99999', { token })).status, 404);
});

test('favoritos exigem autenticação', async () => {
  assert.equal((await ctx.call('GET', '/api/favorites')).status, 401);
});
