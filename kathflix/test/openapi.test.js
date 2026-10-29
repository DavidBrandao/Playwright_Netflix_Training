const fs = require('node:fs');
const path = require('node:path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const YAML = require('yaml');
const { startApp } = require('./helpers');

let ctx;
before(async () => { ctx = await startApp(); });
after(async () => { await ctx.close(); });

const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));

test('Swagger UI e o YAML estão no ar', async () => {
  const ui = await fetch(`${ctx.base}/api-docs/`);
  assert.equal(ui.status, 200);
  const yml = await fetch(`${ctx.base}/api-docs/openapi.yaml`);
  assert.equal(yml.status, 200);
  assert.match(await yml.text(), /openapi: 3/);
});

test('todo endpoint documentado existe na API', async () => {
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const method of Object.keys(methods)) {
      const url = p.replace(/\{[^}]+\}/g, '999999');
      const r = await ctx.call(method.toUpperCase(), url);
      const missing = r.status === 404 && r.body && r.body.error === 'Rota não encontrada';
      assert.ok(!missing, `${method.toUpperCase()} ${p} está no openapi.yaml mas não existe na API`);
    }
  }
});
