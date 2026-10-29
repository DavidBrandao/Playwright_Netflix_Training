const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx, token;
before(async () => { ctx = await startApp(); token = await ctx.user(); });
after(async () => { await ctx.close(); });

test('lista exige autenticação', async () => {
  assert.equal((await ctx.call('GET', '/api/titles')).status, 401);
});

test('lista todos os títulos com flag favorite', async () => {
  const r = await ctx.call('GET', '/api/titles', { token });
  assert.equal(r.status, 200);
  assert.ok(r.body.length >= 6);
  assert.equal(r.body[0].favorite, false);
  assert.equal(typeof r.body[0].is_new, 'boolean');
});

test('filtra por gênero, busca e novidades', async () => {
  const g = await ctx.call('GET', '/api/titles?genre=Animação', { token });
  assert.ok(g.body.length >= 2 && g.body.every((t) => t.genre === 'Animação'));
  const q = await ctx.call('GET', '/api/titles?q=sintel', { token });
  assert.deepEqual(q.body.map((t) => t.title), ['Sintel']);
  const n = await ctx.call('GET', '/api/titles?new=true', { token });
  assert.ok(n.body.length >= 1 && n.body.every((t) => t.is_new));
});

test('ordena A-Z e por ano', async () => {
  const az = await ctx.call('GET', '/api/titles?sort=az', { token });
  const names = az.body.map((t) => t.title.toLowerCase());
  assert.deepEqual(names, [...names].sort());
  const yr = await ctx.call('GET', '/api/titles?sort=year', { token });
  assert.ok(yr.body[0].year >= yr.body[1].year);
});

test('detalhe de série traz episódios; 404 se não existe', async () => {
  const all = await ctx.call('GET', '/api/titles', { token });
  const series = all.body.find((t) => t.type === 'series');
  const r = await ctx.call('GET', `/api/titles/${series.id}`, { token });
  assert.equal(r.body.episodes.length, 3);
  assert.equal((await ctx.call('GET', '/api/titles/99999', { token })).status, 404);
});
