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
