const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx, admin, user;
before(async () => { ctx = await startApp(); admin = await ctx.admin(); user = await ctx.user(); });
after(async () => { await ctx.close(); });

const movie = { type: 'movie', title: 'Filme X', genre: 'Drama', year: 2020, video_url: 'https://youtu.be/aqz-KE-bpKQ' };

test('usuário comum recebe 403; sem token 401', async () => {
  assert.equal((await ctx.call('POST', '/api/admin/titles', { token: user, json: movie })).status, 403);
  assert.equal((await ctx.call('GET', '/api/admin/users', { token: user })).status, 403);
  assert.equal((await ctx.call('GET', '/api/admin/users')).status, 401);
});

test('admin cria filme via JSON com cover_url e remove', async () => {
  const r = await ctx.call('POST', '/api/admin/titles', { token: admin, json: { ...movie, cover_url: 'https://img.test/a.jpg' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.cover_url, 'https://img.test/a.jpg');
  assert.equal((await ctx.call('DELETE', `/api/admin/titles/${r.body.id}`, { token: admin })).status, 204);
  assert.equal((await ctx.call('DELETE', `/api/admin/titles/${r.body.id}`, { token: admin })).status, 404);
});

test('admin cria filme via multipart com imagem', async () => {
  const f = new FormData();
  for (const [k, v] of Object.entries(movie)) f.append(k, String(v));
  f.append('cover', new Blob([Buffer.from('fake')], { type: 'image/jpeg' }), 'c.jpg');
  const r = await ctx.call('POST', '/api/admin/titles', { token: admin, form: f });
  assert.equal(r.status, 201);
  assert.match(r.body.cover_url, /^\/uploads\/.+\.jpg$/);
});

test('admin cria série com episódios (JSON e string JSON no multipart)', async () => {
  const episodes = [
    { season: 1, number: 1, name: 'Piloto', video_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
    { season: 1, number: 2, name: 'Segundo', video_url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ' },
  ];
  const r = await ctx.call('POST', '/api/admin/titles', { token: admin, json: { type: 'series', title: 'Série X', genre: 'Ação', episodes } });
  assert.equal(r.status, 201);
  assert.equal(r.body.episodes.length, 2);
  const f = new FormData();
  f.append('type', 'series'); f.append('title', 'Série Y'); f.append('genre', 'Ação');
  f.append('episodes', JSON.stringify(episodes));
  assert.equal((await ctx.call('POST', '/api/admin/titles', { token: admin, form: f })).status, 201);
});

test('validações de título devolvem 400', async () => {
  const bad = async (json) => (await ctx.call('POST', '/api/admin/titles', { token: admin, json })).status;
  assert.equal(await bad({ ...movie, video_url: 'http://site.com/x' }), 400);
  assert.equal(await bad({ ...movie, genre: 'Invalido' }), 400);
  assert.equal(await bad({ ...movie, title: '' }), 400);
  assert.equal(await bad({ type: 'series', title: 'S', genre: 'Ação', episodes: [] }), 400);
});

test('lista usuários ativos, todos, cria e remove', async () => {
  const active = await ctx.call('GET', '/api/admin/users', { token: admin });
  const emails = active.body.map((u) => u.email).sort();
  assert.deepEqual(emails, ['admin@kathflix.com', 'user@kathflix.com']);

  const created = await ctx.call('POST', '/api/admin/users', { token: admin, json: { name: 'Novo', email: 'novo@teste.com', password: 'abc123', role: 'user' } });
  assert.equal(created.status, 201);
  assert.ok(!(await ctx.call('GET', '/api/admin/users', { token: admin })).body.some((u) => u.email === 'novo@teste.com'));
  assert.ok((await ctx.call('GET', '/api/admin/users?all=true', { token: admin })).body.some((u) => u.email === 'novo@teste.com'));

  assert.equal((await ctx.call('DELETE', `/api/admin/users/${created.body.id}`, { token: admin })).status, 204);
  assert.equal((await ctx.call('DELETE', `/api/admin/users/${created.body.id}`, { token: admin })).status, 404);
});

test('admin não pode remover a si mesmo', async () => {
  const me = await ctx.call('GET', '/api/me', { token: admin });
  assert.equal((await ctx.call('DELETE', `/api/admin/users/${me.body.id}`, { token: admin })).status, 400);
});
