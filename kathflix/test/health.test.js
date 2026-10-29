const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx;
before(async () => { ctx = await startApp(); });
after(async () => { await ctx.close(); });

test('GET /api/health responde ok', async () => {
  const r = await ctx.call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { status: 'ok' });
});

test('rota inexistente devolve { error } 404', async () => {
  const r = await ctx.call('GET', '/api/nao-existe');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'Rota não encontrada');
});
