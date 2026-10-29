const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');

async function startApp(options = {}) {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kathflix-'));
  const app = createApp({ dbPath: ':memory:', uploadDir, ...options });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, url, { token, json, form } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let body;
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }
    if (form) body = form;
    const res = await fetch(base + url, { method, headers, body });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, body: data };
  }

  async function login(email, password) {
    const r = await call('POST', '/api/auth/login', { json: { email, password } });
    return r.body.token;
  }

  return {
    base,
    app,
    call,
    login,
    admin: () => login('admin@kathflix.com', 'admin123'),
    user: () => login('user@kathflix.com', 'user123'),
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      if (app.locals.db) app.locals.db.close();
    },
  };
}

module.exports = { startApp };
