const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx;
before(async () => { ctx = await startApp(); });
after(async () => { await ctx.close(); });

test('seed cria usuários e títulos em lote; cleanup remove por prefixo', async () => {
  const seed = await ctx.call('POST', '/api/test/seed', {
    json: {
      users: [{ name: 'QA Um', email: 'qa-um@teste.com', password: 'abc123' }, { name: 'QA Admin', email: 'qa-adm@teste.com', password: 'abc123', role: 'admin' }],
      titles: [{ type: 'movie', title: 'qa-Filme', genre: 'Drama', video_url: 'https://youtu.be/aqz-KE-bpKQ' }],
    },
  });
  assert.equal(seed.status, 201);
  assert.equal(seed.body.users.length, 2);
  assert.equal(seed.body.titles.length, 1);
  assert.ok(await ctx.login('qa-um@teste.com', 'abc123'));

  const clean = await ctx.call('DELETE', '/api/test/cleanup', { json: { prefix: 'qa-' } });
  assert.equal(clean.status, 200);
  assert.deepEqual(clean.body, { users: 2, titles: 1 });
});

test('cleanup exige prefixo de ao menos 3 caracteres', async () => {
  assert.equal((await ctx.call('DELETE', '/api/test/cleanup', { json: { prefix: 'a' } })).status, 400);
});

test('reset volta ao estado inicial', async () => {
  await ctx.call('POST', '/api/test/seed', { json: { users: [{ name: 'Z', email: 'zzz@teste.com', password: 'abc123' }] } });
  assert.equal((await ctx.call('POST', '/api/test/reset')).status, 200);
  const token = await ctx.admin();
  const all = await ctx.call('GET', '/api/admin/users?all=true', { token });
  assert.equal(all.body.length, 2);
});

test('rotas de teste não existem com testApi desligado', async () => {
  const off = await startApp({ testApi: false });
  assert.equal((await off.call('POST', '/api/test/reset')).status, 404);
  await off.close();
});
