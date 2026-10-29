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
