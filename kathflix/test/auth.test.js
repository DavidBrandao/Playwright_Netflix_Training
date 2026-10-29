const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx;
before(async () => { ctx = await startApp(); });
after(async () => { await ctx.close(); });

const newUser = { name: 'Maria', email: 'maria@teste.com', password: 'senha123' };

test('register cria usuário sem expor o hash', async () => {
  const r = await ctx.call('POST', '/api/auth/register', { json: newUser });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, 'maria@teste.com');
  assert.equal(r.body.user.role, 'user');
  assert.equal(r.body.user.password_hash, undefined);
});

test('register com e-mail duplicado devolve 409', async () => {
  const r = await ctx.call('POST', '/api/auth/register', { json: newUser });
  assert.equal(r.status, 409);
  assert.ok(r.body.error);
});

test('register com dados inválidos devolve 400', async () => {
  const r = await ctx.call('POST', '/api/auth/register', { json: { name: '', email: 'x', password: '1' } });
  assert.equal(r.status, 400);
});

test('login devolve token e usuário', async () => {
  const r = await ctx.call('POST', '/api/auth/login', { json: { email: 'maria@teste.com', password: 'senha123' } });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.equal(r.body.user.name, 'Maria');
});

test('login com senha errada devolve 401', async () => {
  const r = await ctx.call('POST', '/api/auth/login', { json: { email: 'maria@teste.com', password: 'errada' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'E-mail ou senha inválidos');
});

test('login sem campos devolve 400', async () => {
  const r = await ctx.call('POST', '/api/auth/login', { json: {} });
  assert.equal(r.status, 400);
});

test('logout invalida o token', async () => {
  const token = await ctx.login('maria@teste.com', 'senha123');
  assert.equal((await ctx.call('POST', '/api/auth/logout', { token })).status, 204);
  assert.equal((await ctx.call('POST', '/api/auth/logout', { token })).status, 401);
});

test('rota protegida sem token devolve 401', async () => {
  assert.equal((await ctx.call('POST', '/api/auth/logout')).status, 401);
});
