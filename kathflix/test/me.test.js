const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx;
before(async () => { ctx = await startApp(); });
after(async () => { await ctx.close(); });

test('GET /api/me devolve o usuário logado', async () => {
  const token = await ctx.user();
  const r = await ctx.call('GET', '/api/me', { token });
  assert.equal(r.body.email, 'user@kathflix.com');
});

test('PUT /api/me atualiza nome, bio e senha', async () => {
  await ctx.call('POST', '/api/auth/register', { json: { name: 'Ana', email: 'ana@teste.com', password: 'abc123' } });
  const token = await ctx.login('ana@teste.com', 'abc123');
  const r = await ctx.call('PUT', '/api/me', { token, json: { name: 'Ana Souza', bio: 'Oi', password: 'novasenha' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.name, 'Ana Souza');
  assert.equal(r.body.bio, 'Oi');
  assert.ok(await ctx.login('ana@teste.com', 'novasenha'));
});

test('PUT /api/me com e-mail de outro usuário devolve 409', async () => {
  const token = await ctx.login('ana@teste.com', 'novasenha');
  const r = await ctx.call('PUT', '/api/me', { token, json: { email: 'admin@kathflix.com' } });
  assert.equal(r.status, 409);
});

test('PUT /api/me aceita avatar via multipart e rejeita não-imagem', async () => {
  const token = await ctx.login('ana@teste.com', 'novasenha');
  const ok = new FormData();
  ok.append('avatar', new Blob([Buffer.from('fake')], { type: 'image/png' }), 'a.png');
  const r = await ctx.call('PUT', '/api/me', { token, form: ok });
  assert.equal(r.status, 200);
  assert.match(r.body.avatar_url, /^\/uploads\/.+\.png$/);

  const bad = new FormData();
  bad.append('avatar', new Blob(['texto'], { type: 'text/plain' }), 'a.txt');
  assert.equal((await ctx.call('PUT', '/api/me', { token, form: bad })).status, 400);
});

test('DELETE /api/me remove a conta', async () => {
  const token = await ctx.login('ana@teste.com', 'novasenha');
  assert.equal((await ctx.call('DELETE', '/api/me', { token })).status, 204);
  assert.equal((await ctx.call('GET', '/api/me', { token })).status, 401);
});
