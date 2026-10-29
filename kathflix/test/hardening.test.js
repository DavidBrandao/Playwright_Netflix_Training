const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { startApp } = require('./helpers');

let ctx;
let adminToken;
before(async () => {
  ctx = await startApp();
  adminToken = await ctx.admin();
});
after(async () => { await ctx.close(); });

const img = (field, filename) => {
  const f = new FormData();
  f.append(field, new Blob([Buffer.from('fake')], { type: 'image/png' }), filename);
  return f;
};

test('upload rejeita extensões fora da whitelist mesmo com mimetype image/*', async () => {
  for (const name of ['x.html', 'x.svg']) {
    const me = await ctx.call('PUT', '/api/me', { token: adminToken, form: img('avatar', name) });
    assert.equal(me.status, 400, `avatar ${name}`);
    const f = img('cover', name);
    f.append('type', 'movie'); f.append('title', 'Z'); f.append('genre', 'Drama'); f.append('video_url', 'https://youtu.be/aqz-KE-bpKQ');
    const t = await ctx.call('POST', '/api/admin/titles', { token: adminToken, form: f });
    assert.equal(t.status, 400, `cover ${name}`);
  }
});

test('cleanup com prefixo só de curingas devolve 400 e não apaga nada', async () => {
  for (const prefix of ['%%%', '___']) {
    const r = await ctx.call('DELETE', '/api/test/cleanup', { json: { prefix } });
    assert.equal(r.status, 400, prefix);
  }
  const list = await ctx.call('GET', '/api/titles', { token: adminToken });
  assert.ok(list.body.length > 0);
  assert.ok(await ctx.user());
});

test('GET /api/titles tolera parâmetros estranhos', async () => {
  const get = (qs) => ctx.call('GET', `/api/titles${qs}`, { token: adminToken });
  for (const qs of ['?sort=__proto__', '?sort=constructor', '?genre[a]=1', '?genre=a&genre=b', '?q[a]=1', '?q=a&q=b', '?new=true&new=true']) {
    assert.equal((await get(qs)).status, 200, qs);
  }
  const pct = await get('?q=%25');
  assert.equal(pct.status, 200);
  assert.ok(pct.body.every((t) => t.title.includes('%')));
  const us = await get('?q=_');
  assert.ok(us.body.every((t) => t.title.includes('_')));
});

test('corpo JSON grande devolve 413 com { error }', async () => {
  const r = await ctx.call('POST', '/api/auth/login', { json: { email: 'a@b.com', password: 'x'.repeat(200 * 1024) } });
  assert.equal(r.status, 413);
  assert.ok(r.body.error);
});

test('seed é atômico e valida tipos', async () => {
  const r = await ctx.call('POST', '/api/test/seed', {
    json: { users: [{ name: 'QA Atomic', email: 'qa-atomic@teste.com', password: 'abc123' }], titles: [{ type: 'x' }] },
  });
  assert.equal(r.status, 400);
  const login = await ctx.call('POST', '/api/auth/login', { json: { email: 'qa-atomic@teste.com', password: 'abc123' } });
  assert.equal(login.status, 401);
  assert.equal((await ctx.call('POST', '/api/test/seed', { json: { users: 5 } })).status, 400);
  assert.equal((await ctx.call('POST', '/api/test/seed', { json: { titles: 'x' } })).status, 400);
});

test('requisição que falha após o upload não deixa arquivo órfão', async () => {
  const dir = ctx.app.locals.uploadDir;
  const before = fs.readdirSync(dir).length;
  const f = img('cover', 'ok.png');
  f.append('type', 'movie'); f.append('title', ''); f.append('genre', 'Drama'); f.append('video_url', 'https://youtu.be/aqz-KE-bpKQ');
  assert.equal((await ctx.call('POST', '/api/admin/titles', { token: adminToken, form: f })).status, 400);

  const me = img('avatar', 'ok.png');
  me.append('email', 'user@kathflix.com');
  assert.equal((await ctx.call('PUT', '/api/me', { token: adminToken, form: me })).status, 409);
  assert.equal(fs.readdirSync(dir).length, before);
});

test('year: em branco vira null; fora de 1888..2100 é 400', async () => {
  const post = (year) => ctx.call('POST', '/api/admin/titles', {
    token: adminToken,
    json: { type: 'movie', title: `Ano ${year}`, genre: 'Drama', video_url: 'https://youtu.be/aqz-KE-bpKQ', year },
  });
  const blank = await post('   ');
  assert.equal(blank.status, 201);
  assert.equal(blank.body.year, null);
  for (const y of [0, 1887, 2101, -5]) assert.equal((await post(y)).status, 400, String(y));
  assert.equal((await post(1888)).status, 201);
  assert.equal((await post(2100)).status, 201);
});
