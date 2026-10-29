# KathFlix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construir o KathFlix (app estilo Netflix com API REST + frontend HTML/JS puro) para treinos de Playwright, e reorganizar o repositório com o código atual em `automation/`.

**Architecture:** Um único processo Node/Express serve a API (`/api/*`), o frontend estático (`/`) e o Swagger (`/api-docs`). Persistência em SQLite via `node:sqlite` (embutido no Node 24, sem compilar módulo nativo). O frontend é um cliente fino da API, com token Bearer no `localStorage`.

**Tech Stack:** Node 24, Express 4, `node:sqlite`, multer, bcryptjs, swagger-ui-express, yaml, `node:test`.

**Design de referência:** `docs/plans/2026-10-29-kathflix-design.md`.

**Desvio do design (aprovado implicitamente por simplicidade):** o design cita `better-sqlite3`; este plano usa `node:sqlite` porque evita build nativo no Windows. Task 2 atualiza o documento de design.

**Convenções**
- Diretório de trabalho: `C:\Users\David\Documents\Softex\Modulo2\scripts` (raiz do git). Comandos em Git Bash.
- Todo commit termina com o trailer:
  `-m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`
- Testes da API: `cd kathflix && npm test`. O Node imprime um `ExperimentalWarning` do SQLite; é esperado e inofensivo.
- Credenciais do seed: `admin@kathflix.com` / `admin123` e `user@kathflix.com` / `user123`.

---

### Task 1: Mover o código de automação para `automation/`

**Files:**
- Move: `api_helper/ pages/ tests/ playwright.config.ts package.json yarn.lock testasync.ts` para `automation/`
- Create: `.gitignore` (raiz)

**Step 1: Mover os arquivos**

```bash
mkdir automation
mv api_helper pages tests playwright.config.ts package.json yarn.lock testasync.ts automation/
mv .gitignore automation/.gitignore
rm -rf test-results
ls automation
```
Expected: `api_helper  package.json  pages  playwright.config.ts  testasync.ts  tests  yarn.lock` (mais o `.gitignore` oculto).

**Step 2: Criar `.gitignore` da raiz**

```gitignore
node_modules/
test-results/
playwright-report/
blob-report/
.DS_Store

# KathFlix
kathflix/data/*.db
kathflix/data/*.db-*
kathflix/public/uploads/*
!kathflix/public/uploads/.gitkeep
```

**Step 3: Verificar que nada de código foi perdido**

```bash
git status --short
```
Expected: `automation/` e `.gitignore` como não rastreados.

**Step 4: Commit**

```bash
git add automation .gitignore
git commit -m "chore: move existing Playwright code to automation/ as example" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Scaffold do `kathflix/` (app factory, erros, helper de teste)

**Files:**
- Create: `kathflix/package.json`, `kathflix/server.js`, `kathflix/src/app.js`, `kathflix/src/errors.js`, `kathflix/src/util.js`, `kathflix/public/uploads/.gitkeep`, `kathflix/test/helpers.js`, `kathflix/test/health.test.js`
- Modify: `docs/plans/2026-10-29-kathflix-design.md` (troca `better-sqlite3` por `node:sqlite`)

**Step 1: `kathflix/package.json`**

```json
{
  "name": "kathflix",
  "version": "1.0.0",
  "private": true,
  "description": "App de treino para automação com Playwright",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test \"test/**/*.test.js\""
  },
  "engines": { "node": ">=22.13" },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "express": "^4.21.2",
    "multer": "^1.4.5-lts.1",
    "swagger-ui-express": "^5.0.1",
    "yaml": "^2.6.1"
  }
}
```

```bash
cd kathflix && npm install && mkdir -p public/uploads data && touch public/uploads/.gitkeep
```

**Step 2: `src/errors.js`**

```js
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const httpError = (status, message) => new HttpError(status, message);

function notFound(req, res, next) {
  next(httpError(404, 'Rota não encontrada'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Imagem acima de 2 MB' : err.message;
    return res.status(400).json({ error: msg });
  }
  console.error(err);
  return res.status(500).json({ error: 'Erro interno' });
}

module.exports = { HttpError, httpError, notFound, errorHandler };
```

**Step 3: `src/util.js`**

```js
const GENRES = ['Ação', 'Comédia', 'Drama', 'Terror', 'Ficção', 'Animação', 'Documentário'];
const DEFAULT_COVER = '/img/cover-default.svg';
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

function youtubeId(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

module.exports = { GENRES, DEFAULT_COVER, ACTIVE_WINDOW_MS, youtubeId };
```

**Step 4: `src/app.js` (versão inicial, só health)**

```js
const path = require('node:path');
const express = require('express');
const { notFound, errorHandler } = require('./errors');

function createApp({ dbPath = ':memory:', uploadDir, testApi } = {}) {
  const app = express();
  app.locals.uploadDir = uploadDir || path.join(__dirname, '..', 'public', 'uploads');
  app.locals.testApi = testApi !== undefined ? testApi : process.env.KATHFLIX_TEST_API !== 'off';

  app.use(express.json());
  app.use('/uploads', express.static(app.locals.uploadDir));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api', notFound);
  app.get('/', (req, res) => res.redirect('/login.html'));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
```

**Step 5: `server.js`**

```js
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./src/app');

const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const app = createApp({ dbPath: process.env.KATHFLIX_DB || path.join(dataDir, 'kathflix.db') });
app.listen(port, () => {
  console.log(`KathFlix no ar: http://localhost:${port}`);
  console.log(`Swagger:        http://localhost:${port}/api-docs`);
});
```

**Step 6: `test/helpers.js`**

```js
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
```

**Step 7: Teste (falha primeiro) `test/health.test.js`**

```js
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
```

**Step 8: Rodar**

Run: `cd kathflix && npm test`
Expected: 2 testes PASS.

**Step 9: Atualizar o design**

Em `docs/plans/2026-10-29-kathflix-design.md`, trocar `better-sqlite3` por `node:sqlite (embutido no Node 24)` na linha de Persistência e na lista de dependências do `package.json`.

**Step 10: Commit**

```bash
cd .. && git add kathflix docs && git commit -m "feat(kathflix): scaffold express app, error handling and test helper" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Banco de dados, serviços e seed

**Files:**
- Create: `kathflix/src/db.js`, `kathflix/src/seed.js`, `kathflix/src/users-service.js`, `kathflix/src/titles-service.js`, `kathflix/test/db.test.js`
- Modify: `kathflix/src/app.js`

**Step 1: Teste (falha) `test/db.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const { resetToSeed } = require('../src/seed');

test('openDb cria schema e seed', () => {
  const db = openDb(':memory:');
  const users = db.prepare('SELECT email, role FROM users ORDER BY id').all();
  assert.deepEqual(users.map((u) => u.email), ['admin@kathflix.com', 'user@kathflix.com']);
  assert.equal(users[0].role, 'admin');
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM titles').get().n >= 6);
  const series = db.prepare("SELECT id FROM titles WHERE type='series'").get();
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM episodes WHERE title_id=?').get(series.id).n >= 3);
  db.close();
});

test('resetToSeed volta ao estado inicial', () => {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO users (name,email,password_hash,role,created_at) VALUES ('x','x@x.com','h','user',1)").run();
  resetToSeed(db);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  db.close();
});
```

**Step 2: Rodar** — `npm test` → FAIL (`Cannot find module '../src/db'`).

**Step 3: `src/users-service.js`**

```js
const bcrypt = require('bcryptjs');
const { httpError } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  const { id, name, email, role, bio, avatar_url, created_at } = row;
  return { id, name, email, role, bio, avatar_url, created_at };
}

function validateUserInput({ name, email, password }, { partial = false } = {}) {
  if (!partial || name !== undefined) {
    if (!String(name || '').trim()) throw httpError(400, 'name é obrigatório');
  }
  if (!partial || email !== undefined) {
    if (!EMAIL_RE.test(String(email || '').trim())) throw httpError(400, 'email inválido');
  }
  if (!partial || password !== undefined) {
    if (String(password || '').length < 6) throw httpError(400, 'password deve ter ao menos 6 caracteres');
  }
}

function emailTaken(db, email, exceptId = 0) {
  return !!db.prepare('SELECT 1 FROM users WHERE lower(email)=lower(?) AND id<>?').get(email, exceptId);
}

function createUser(db, { name, email, password, role = 'user' }) {
  validateUserInput({ name, email, password });
  if (!['user', 'admin'].includes(role)) throw httpError(400, 'role deve ser user ou admin');
  const cleanEmail = String(email).trim().toLowerCase();
  if (emailTaken(db, cleanEmail)) throw httpError(409, 'E-mail já cadastrado');
  const hash = bcrypt.hashSync(String(password), 8);
  const r = db
    .prepare('INSERT INTO users (name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)')
    .run(String(name).trim(), cleanEmail, hash, role, Date.now());
  return db.prepare('SELECT * FROM users WHERE id=?').get(Number(r.lastInsertRowid));
}

module.exports = { publicUser, validateUserInput, emailTaken, createUser, bcrypt };
```

**Step 4: `src/titles-service.js`**

```js
const { httpError } = require('./errors');
const { GENRES, DEFAULT_COVER, youtubeId } = require('./util');

const truthy = (v) => v === true || v === 'true' || v === '1' || v === 1;

function parseTitleInput(body, coverFromFile) {
  const { type } = body;
  if (!['movie', 'series'].includes(type)) throw httpError(400, 'type deve ser movie ou series');
  const title = String(body.title || '').trim();
  if (!title) throw httpError(400, 'title é obrigatório');
  if (!GENRES.includes(body.genre)) throw httpError(400, `genre inválido. Use: ${GENRES.join(', ')}`);
  const year = body.year === undefined || body.year === '' || body.year === null ? null : Number(body.year);
  if (year !== null && !Number.isInteger(year)) throw httpError(400, 'year deve ser um número inteiro');

  const out = {
    type,
    title,
    description: String(body.description || '').trim(),
    year,
    genre: body.genre,
    cover_url: coverFromFile || String(body.cover_url || '').trim() || DEFAULT_COVER,
    is_new: body.is_new === undefined ? 1 : truthy(body.is_new) ? 1 : 0,
    video_url: null,
    episodes: [],
  };

  if (type === 'movie') {
    if (!youtubeId(body.video_url)) throw httpError(400, 'video_url deve ser um link do YouTube');
    out.video_url = body.video_url;
  } else {
    let eps = body.episodes;
    if (typeof eps === 'string') {
      try { eps = JSON.parse(eps); } catch { throw httpError(400, 'episodes deve ser um JSON válido'); }
    }
    if (!Array.isArray(eps) || eps.length === 0) throw httpError(400, 'série precisa de ao menos um episódio');
    out.episodes = eps.map((e, i) => {
      if (!youtubeId(e && e.video_url)) throw httpError(400, `episódio ${i + 1}: video_url deve ser um link do YouTube`);
      return {
        season: Number(e.season) || 1,
        number: Number(e.number) || i + 1,
        name: String(e.name || `Episódio ${i + 1}`),
        video_url: e.video_url,
      };
    });
  }
  return out;
}

function insertTitle(db, t) {
  const r = db
    .prepare(
      'INSERT INTO titles (type,title,description,year,genre,cover_url,video_url,is_new,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
    )
    .run(t.type, t.title, t.description, t.year, t.genre, t.cover_url, t.video_url, t.is_new, t.created_at || Date.now());
  const id = Number(r.lastInsertRowid);
  const ins = db.prepare('INSERT INTO episodes (title_id,season,number,name,video_url) VALUES (?,?,?,?,?)');
  for (const e of t.episodes) ins.run(id, e.season, e.number, e.name, e.video_url);
  return id;
}

function presentTitle(row, { favorites, episodes } = {}) {
  const t = { ...row, is_new: !!row.is_new };
  if (favorites) t.favorite = favorites.has(row.id);
  if (episodes) t.episodes = episodes;
  return t;
}

module.exports = { parseTitleInput, insertTitle, presentTitle };
```

**Step 5: `src/seed.js`**

```js
const { createUser } = require('./users-service');
const { insertTitle } = require('./titles-service');
const { DEFAULT_COVER } = require('./util');

const yt = (id) => `https://www.youtube.com/watch?v=${id}`;

const TITLES = [
  { type: 'movie', title: 'Big Buck Bunny', genre: 'Animação', year: 2008, is_new: 1, video_url: yt('aqz-KE-bpKQ'), description: 'Um coelho gigante enfrenta três roedores travessos.' },
  { type: 'movie', title: 'Sintel', genre: 'Animação', year: 2010, is_new: 1, video_url: yt('eRsGyueVLvQ'), description: 'Uma jovem procura seu dragão.' },
  { type: 'movie', title: 'Tears of Steel', genre: 'Ficção', year: 2012, is_new: 0, video_url: yt('R6MlUcmOul8'), description: 'Guerreiros e cientistas tentam salvar o mundo de robôs.' },
  { type: 'movie', title: 'Elephants Dream', genre: 'Ficção', year: 2006, is_new: 0, video_url: yt('TLkA0RELQ1g'), description: 'Dois personagens exploram uma máquina surreal.' },
  { type: 'movie', title: 'Me at the zoo', genre: 'Documentário', year: 2005, is_new: 0, video_url: yt('jNQXAC9IVRw'), description: 'O primeiro vídeo do YouTube.' },
  {
    type: 'series', title: 'Aventuras Open Source', genre: 'Ação', year: 2024, is_new: 1, video_url: null,
    description: 'Uma série em três episódios com curtas abertos.',
    episodes: [
      { season: 1, number: 1, name: 'O Coelho', video_url: yt('aqz-KE-bpKQ') },
      { season: 1, number: 2, name: 'O Dragão', video_url: yt('eRsGyueVLvQ') },
      { season: 1, number: 3, name: 'O Aço', video_url: yt('R6MlUcmOul8') },
    ],
  },
];

function seedAll(db) {
  createUser(db, { name: 'Admin', email: 'admin@kathflix.com', password: 'admin123', role: 'admin' });
  createUser(db, { name: 'Usuário Teste', email: 'user@kathflix.com', password: 'user123', role: 'user' });
  const base = Date.now();
  TITLES.forEach((t, i) =>
    insertTitle(db, { ...t, cover_url: DEFAULT_COVER, episodes: t.episodes || [], created_at: base + i })
  );
}

function seedIfEmpty(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) seedAll(db);
}

function resetToSeed(db) {
  for (const t of ['sessions', 'favorites', 'episodes', 'titles', 'users']) db.exec(`DELETE FROM ${t}`);
  seedAll(db);
}

module.exports = { seedIfEmpty, resetToSeed };
```

**Step 6: `src/db.js`**

```js
const { DatabaseSync } = require('node:sqlite');
const { seedIfEmpty } = require('./seed');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  year INTEGER,
  genre TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  video_url TEXT,
  is_new INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_id INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  season INTEGER NOT NULL DEFAULT 1,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  video_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, title_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at INTEGER NOT NULL
);
`;

function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  seedIfEmpty(db);
  return db;
}

module.exports = { openDb };
```

**Step 7: Ligar o DB no `app.js`**

Adicionar `const { openDb } = require('./db');` no topo e, logo após `app.locals.testApi = ...`:

```js
  app.locals.db = openDb(dbPath);
```

**Step 8: Rodar** — `npm test` → todos PASS (health + db).

**Step 9: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): sqlite schema, seed and services" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Autenticação (middleware + rotas)

**Files:**
- Create: `kathflix/src/middleware/auth.js`, `kathflix/src/routes/auth.js`, `kathflix/test/auth.test.js`
- Modify: `kathflix/src/app.js`

**Step 1: Teste (falha) `test/auth.test.js`**

```js
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
```

**Step 2: Rodar** — `npm test` → FAIL (404 nas rotas de auth).

**Step 3: `src/middleware/auth.js`**

```js
const { httpError } = require('../errors');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next(httpError(401, 'Token ausente'));
  const db = req.app.locals.db;
  const user = db
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .get(token);
  if (!user) return next(httpError(401, 'Token inválido ou expirado'));
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?').run(Date.now(), token);
  req.user = user;
  req.token = token;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return next(httpError(403, 'Acesso restrito a administradores'));
  next();
}

module.exports = { auth, requireAdmin };
```

**Step 4: `src/routes/auth.js`**

```js
const crypto = require('node:crypto');
const express = require('express');
const { httpError } = require('../errors');
const { auth } = require('../middleware/auth');
const { createUser, publicUser, bcrypt } = require('../users-service');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  const user = createUser(req.app.locals.db, { name, email, password, role: 'user' });
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw httpError(400, 'email e password são obrigatórios');
  const db = req.app.locals.db;
  const user = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(String(email).trim());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    throw httpError(401, 'E-mail ou senha inválidos');
  }
  const token = crypto.randomUUID();
  db.prepare('INSERT INTO sessions (token,user_id,last_seen_at) VALUES (?,?,?)').run(token, user.id, Date.now());
  res.json({ token, user: publicUser(user) });
});

router.post('/logout', auth, (req, res) => {
  req.app.locals.db.prepare('DELETE FROM sessions WHERE token=?').run(req.token);
  res.status(204).end();
});

module.exports = router;
```

**Step 5: Registrar em `app.js`** (antes de `app.use('/api', notFound)`):

```js
  app.use('/api/auth', require('./routes/auth'));
```

**Step 6: Rodar** — `npm test` → PASS.

**Step 7: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): auth endpoints (register, login, logout)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Catálogo (`GET /api/titles`, `GET /api/titles/:id`)

**Files:**
- Create: `kathflix/src/routes/titles.js`, `kathflix/test/titles.test.js`
- Modify: `kathflix/src/app.js`

**Step 1: Teste (falha) `test/titles.test.js`**

```js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx, token;
before(async () => { ctx = await startApp(); token = await ctx.user(); });
after(async () => { await ctx.close(); });

test('lista exige autenticação', async () => {
  assert.equal((await ctx.call('GET', '/api/titles')).status, 401);
});

test('lista todos os títulos com flag favorite', async () => {
  const r = await ctx.call('GET', '/api/titles', { token });
  assert.equal(r.status, 200);
  assert.ok(r.body.length >= 6);
  assert.equal(r.body[0].favorite, false);
  assert.equal(typeof r.body[0].is_new, 'boolean');
});

test('filtra por gênero, busca e novidades', async () => {
  const g = await ctx.call('GET', '/api/titles?genre=Animação', { token });
  assert.ok(g.body.length >= 2 && g.body.every((t) => t.genre === 'Animação'));
  const q = await ctx.call('GET', '/api/titles?q=sintel', { token });
  assert.deepEqual(q.body.map((t) => t.title), ['Sintel']);
  const n = await ctx.call('GET', '/api/titles?new=true', { token });
  assert.ok(n.body.length >= 1 && n.body.every((t) => t.is_new));
});

test('ordena A-Z e por ano', async () => {
  const az = await ctx.call('GET', '/api/titles?sort=az', { token });
  const names = az.body.map((t) => t.title.toLowerCase());
  assert.deepEqual(names, [...names].sort());
  const yr = await ctx.call('GET', '/api/titles?sort=year', { token });
  assert.ok(yr.body[0].year >= yr.body[1].year);
});

test('detalhe de série traz episódios; 404 se não existe', async () => {
  const all = await ctx.call('GET', '/api/titles', { token });
  const series = all.body.find((t) => t.type === 'series');
  const r = await ctx.call('GET', `/api/titles/${series.id}`, { token });
  assert.equal(r.body.episodes.length, 3);
  assert.equal((await ctx.call('GET', '/api/titles/99999', { token })).status, 404);
});
```

**Step 2: Rodar** — FAIL.

**Step 3: `src/routes/titles.js`**

```js
const express = require('express');
const { httpError } = require('../errors');
const { auth } = require('../middleware/auth');
const { presentTitle } = require('../titles-service');

const router = express.Router();
router.use(auth);

const ORDERS = {
  az: 'title COLLATE NOCASE ASC',
  year: 'year DESC',
  recent: 'created_at DESC, id DESC',
};

function favoriteSet(db, userId) {
  const rows = db.prepare('SELECT title_id FROM favorites WHERE user_id=?').all(userId);
  return new Set(rows.map((r) => r.title_id));
}

router.get('/', (req, res) => {
  const { q, genre, new: isNew, sort } = req.query;
  const where = [];
  const params = [];
  if (q) { where.push('title LIKE ?'); params.push(`%${q}%`); }
  if (genre && genre !== 'Todas') { where.push('genre = ?'); params.push(genre); }
  if (isNew === 'true') where.push('is_new = 1');
  const order = ORDERS[sort] || ORDERS.recent;
  const sql = `SELECT * FROM titles ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`;
  const db = req.app.locals.db;
  const favs = favoriteSet(db, req.user.id);
  res.json(db.prepare(sql).all(...params).map((row) => presentTitle(row, { favorites: favs })));
});

router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM titles WHERE id=?').get(Number(req.params.id));
  if (!row) throw httpError(404, 'Título não encontrado');
  const episodes = db
    .prepare('SELECT id, season, number, name, video_url FROM episodes WHERE title_id=? ORDER BY season, number')
    .all(row.id);
  res.json(presentTitle(row, { favorites: favoriteSet(db, req.user.id), episodes }));
});

module.exports = router;
```

**Step 4: Registrar** `app.use('/api/titles', require('./routes/titles'));`

**Step 5: Rodar** — PASS. **Step 6: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): catalog endpoints with filters and sorting" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Favoritos

**Files:** Create `kathflix/src/routes/favorites.js`, `kathflix/test/favorites.test.js`; modify `app.js`.

**Step 1: Teste (falha)**

```js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let ctx, token;
before(async () => { ctx = await startApp(); token = await ctx.user(); });
after(async () => { await ctx.close(); });

test('favoritar, listar e desfavoritar', async () => {
  const all = await ctx.call('GET', '/api/titles', { token });
  const id = all.body[0].id;
  assert.equal((await ctx.call('POST', `/api/favorites/${id}`, { token })).status, 201);
  assert.equal((await ctx.call('POST', `/api/favorites/${id}`, { token })).status, 201); // idempotente
  const list = await ctx.call('GET', '/api/favorites', { token });
  assert.deepEqual(list.body.map((t) => t.id), [id]);
  assert.equal(list.body[0].favorite, true);
  assert.equal((await ctx.call('DELETE', `/api/favorites/${id}`, { token })).status, 204);
  assert.equal((await ctx.call('GET', '/api/favorites', { token })).body.length, 0);
});

test('favoritar título inexistente devolve 404', async () => {
  assert.equal((await ctx.call('POST', '/api/favorites/99999', { token })).status, 404);
});

test('favoritos exigem autenticação', async () => {
  assert.equal((await ctx.call('GET', '/api/favorites')).status, 401);
});
```

**Step 2: Rodar** — FAIL. **Step 3: `src/routes/favorites.js`**

```js
const express = require('express');
const { httpError } = require('../errors');
const { auth } = require('../middleware/auth');
const { presentTitle } = require('../titles-service');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const rows = req.app.locals.db
    .prepare('SELECT t.* FROM titles t JOIN favorites f ON f.title_id=t.id WHERE f.user_id=? ORDER BY t.title COLLATE NOCASE')
    .all(req.user.id);
  const favs = new Set(rows.map((r) => r.id));
  res.json(rows.map((r) => presentTitle(r, { favorites: favs })));
});

router.post('/:titleId', (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.titleId);
  if (!db.prepare('SELECT 1 FROM titles WHERE id=?').get(id)) throw httpError(404, 'Título não encontrado');
  db.prepare('INSERT OR IGNORE INTO favorites (user_id,title_id) VALUES (?,?)').run(req.user.id, id);
  res.status(201).json({ titleId: id, favorite: true });
});

router.delete('/:titleId', (req, res) => {
  req.app.locals.db
    .prepare('DELETE FROM favorites WHERE user_id=? AND title_id=?')
    .run(req.user.id, Number(req.params.titleId));
  res.status(204).end();
});

module.exports = router;
```

**Step 4: Registrar** `app.use('/api/favorites', require('./routes/favorites'));` **Step 5:** `npm test` PASS. **Step 6: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): favorites endpoints" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Perfil (`/api/me`) e upload de imagem

**Files:** Create `kathflix/src/upload.js`, `kathflix/src/routes/me.js`, `kathflix/test/me.test.js`; modify `app.js`.

**Step 1: Teste (falha)**

```js
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
```

**Step 2: Rodar** — FAIL. **Step 3: `src/upload.js`**

```js
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { httpError } = require('./errors');

function makeUpload(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
      file.mimetype.startsWith('image/') ? cb(null, true) : cb(httpError(400, 'Apenas imagens são permitidas')),
  });
}

module.exports = { makeUpload };
```

**Step 4: `src/routes/me.js`**

```js
const express = require('express');
const { auth } = require('../middleware/auth');
const { makeUpload } = require('../upload');
const { publicUser, validateUserInput, emailTaken, bcrypt } = require('../users-service');
const { httpError } = require('../errors');

module.exports = function meRouter(uploadDir) {
  const router = express.Router();
  const upload = makeUpload(uploadDir);
  router.use(auth);

  router.get('/', (req, res) => res.json(publicUser(req.user)));

  router.put('/', upload.single('avatar'), (req, res) => {
    const db = req.app.locals.db;
    const body = req.body || {};
    if (body.password === '') delete body.password; // formulário sem troca de senha
    validateUserInput(body, { partial: true });
    const next = { ...req.user };
    if (body.name !== undefined) next.name = String(body.name).trim();
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (emailTaken(db, email, req.user.id)) throw httpError(409, 'E-mail já cadastrado');
      next.email = email;
    }
    if (body.bio !== undefined) next.bio = String(body.bio);
    if (body.password) next.password_hash = bcrypt.hashSync(String(body.password), 8);
    if (req.file) next.avatar_url = `/uploads/${req.file.filename}`;
    else if (body.avatar_url !== undefined) next.avatar_url = String(body.avatar_url) || null;
    db.prepare('UPDATE users SET name=?, email=?, bio=?, avatar_url=?, password_hash=? WHERE id=?').run(
      next.name, next.email, next.bio, next.avatar_url ?? null, next.password_hash, req.user.id
    );
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)));
  });

  router.delete('/', (req, res) => {
    req.app.locals.db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
    res.status(204).end();
  });

  return router;
};
```

**Step 5: Registrar** `app.use('/api/me', require('./routes/me')(app.locals.uploadDir));` **Step 6:** `npm test` PASS. **Step 7: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): profile endpoints and image upload" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Admin (títulos e usuários)

**Files:** Create `kathflix/src/routes/admin.js`, `kathflix/test/admin.test.js`; modify `app.js`.

**Step 1: Teste (falha)**

```js
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
```

**Step 2: Rodar** — FAIL. **Step 3: `src/routes/admin.js`**

```js
const express = require('express');
const { httpError } = require('../errors');
const { auth, requireAdmin } = require('../middleware/auth');
const { makeUpload } = require('../upload');
const { createUser, publicUser } = require('../users-service');
const { parseTitleInput, insertTitle, presentTitle } = require('../titles-service');
const { ACTIVE_WINDOW_MS } = require('../util');

module.exports = function adminRouter(uploadDir) {
  const router = express.Router();
  const upload = makeUpload(uploadDir);
  router.use(auth, requireAdmin);

  router.post('/titles', upload.single('cover'), (req, res) => {
    const db = req.app.locals.db;
    const input = parseTitleInput(req.body || {}, req.file ? `/uploads/${req.file.filename}` : null);
    const id = insertTitle(db, input);
    const row = db.prepare('SELECT * FROM titles WHERE id=?').get(id);
    const episodes = db
      .prepare('SELECT id, season, number, name, video_url FROM episodes WHERE title_id=? ORDER BY season, number')
      .all(id);
    res.status(201).json(presentTitle(row, { episodes }));
  });

  router.delete('/titles/:id', (req, res) => {
    const r = req.app.locals.db.prepare('DELETE FROM titles WHERE id=?').run(Number(req.params.id));
    if (r.changes === 0) throw httpError(404, 'Título não encontrado');
    res.status(204).end();
  });

  router.get('/users', (req, res) => {
    const cutoff = req.query.all === 'true' ? -1 : Date.now() - ACTIVE_WINDOW_MS;
    const sql = `
      SELECT u.id, u.name, u.email, u.role, u.created_at, MAX(s.last_seen_at) AS last_seen_at
      FROM users u LEFT JOIN sessions s ON s.user_id = u.id
      GROUP BY u.id
      ${req.query.all === 'true' ? '' : 'HAVING MAX(s.last_seen_at) > ?'}
      ORDER BY u.name COLLATE NOCASE`;
    const stmt = req.app.locals.db.prepare(sql);
    res.json(req.query.all === 'true' ? stmt.all() : stmt.all(cutoff));
  });

  router.post('/users', (req, res) => {
    const { name, email, password, role } = req.body || {};
    const user = createUser(req.app.locals.db, { name, email, password, role: role || 'user' });
    res.status(201).json(publicUser(user));
  });

  router.delete('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw httpError(400, 'Não é possível remover a si mesmo');
    const r = req.app.locals.db.prepare('DELETE FROM users WHERE id=?').run(id);
    if (r.changes === 0) throw httpError(404, 'Usuário não encontrado');
    res.status(204).end();
  });

  return router;
};
```

**Step 4: Registrar** `app.use('/api/admin', require('./routes/admin')(app.locals.uploadDir));` **Step 5:** `npm test` PASS. **Step 6: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): admin endpoints for titles and users" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Rotas de apoio a testes (`/api/test/*`)

**Files:** Create `kathflix/src/routes/test-support.js`, `kathflix/test/test-support.test.js`; modify `app.js`.

**Step 1: Teste (falha)**

```js
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
```

**Step 2: Rodar** — FAIL. **Step 3: `src/routes/test-support.js`**

```js
const express = require('express');
const { httpError } = require('../errors');
const { createUser } = require('../users-service');
const { parseTitleInput, insertTitle } = require('../titles-service');
const { resetToSeed } = require('../seed');

const router = express.Router();

router.post('/reset', (req, res) => {
  resetToSeed(req.app.locals.db);
  res.json({ status: 'reset' });
});

router.post('/seed', (req, res) => {
  const db = req.app.locals.db;
  const { users = [], titles = [] } = req.body || {};
  const createdUsers = users.map((u) => {
    const row = createUser(db, u);
    return { id: row.id, email: row.email };
  });
  const createdTitles = titles.map((t) => {
    const id = insertTitle(db, parseTitleInput(t, null));
    return { id, title: t.title };
  });
  res.status(201).json({ users: createdUsers, titles: createdTitles });
});

router.delete('/cleanup', (req, res) => {
  const prefix = String((req.body && req.body.prefix) || req.query.prefix || '');
  if (prefix.length < 3) throw httpError(400, 'prefix deve ter ao menos 3 caracteres');
  const db = req.app.locals.db;
  const like = `${prefix.replace(/[%_]/g, '')}%`;
  const users = db.prepare("DELETE FROM users WHERE email LIKE ? AND email NOT IN ('admin@kathflix.com','user@kathflix.com')").run(like);
  const titles = db.prepare('DELETE FROM titles WHERE title LIKE ?').run(like);
  res.json({ users: users.changes, titles: titles.changes });
});

module.exports = router;
```

Convenção: o prefixo (mínimo 3 caracteres) vale para o início do e-mail do usuário e do nome do título. Use algo como `qa-`. Os caracteres `%` e `_` são removidos do prefixo para não virarem curingas do `LIKE`.

**Step 4: Registrar** (em `app.js`, condicional):

```js
  if (app.locals.testApi) app.use('/api/test', require('./routes/test-support'));
```

**Step 5:** `npm test` PASS. **Step 6: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): test-support endpoints (reset, seed, cleanup)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: OpenAPI + Swagger UI + teste de cobertura da doc

**Files:** Create `kathflix/openapi.yaml`, `kathflix/test/openapi.test.js`; modify `app.js`.

**Step 1: Teste (falha) `test/openapi.test.js`**

```js
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
```

**Step 2: Rodar** — FAIL (arquivo YAML inexistente).

**Step 3: `kathflix/openapi.yaml`**

```yaml
openapi: 3.0.3
info:
  title: KathFlix API
  version: 1.0.0
  description: |
    API do KathFlix, app de treino para automação com Playwright. Tudo que o frontend faz também pode ser feito aqui,
    o que permite montar **setup** e **teardown** de testes via API.

    ## Como colocar no ar
    ```
    cd kathflix
    npm install
    npm start
    ```
    App em `http://localhost:3000`, esta documentação em `http://localhost:3000/api-docs`.
    Variáveis: `PORT` (padrão 3000), `KATHFLIX_DB` (caminho do arquivo SQLite), `KATHFLIX_TEST_API=off` (desliga `/api/test/*`).

    ## Como autenticar
    1. Chame `POST /api/auth/login` com `{"email":"admin@kathflix.com","password":"admin123"}`.
    2. Copie o `token` da resposta.
    3. Clique em **Authorize** (cadeado) nesta página e cole o token, ou envie o header `Authorization: Bearer <token>`.

    ## Usuários do seed
    | Papel | E-mail | Senha |
    |---|---|---|
    | admin | admin@kathflix.com | admin123 |
    | user | user@kathflix.com | user123 |

    ## Erros
    Sempre no formato `{ "error": "mensagem" }` com status 400, 401, 403, 404 ou 409.
servers:
  - url: http://localhost:3000
tags:
  - name: Auth
  - name: Catálogo
  - name: Favoritos
  - name: Perfil
  - name: Admin
  - name: Apoio a testes
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  schemas:
    Error:
      type: object
      properties:
        error: { type: string, example: Título não encontrado }
    User:
      type: object
      properties:
        id: { type: integer, example: 3 }
        name: { type: string, example: Maria }
        email: { type: string, example: maria@teste.com }
        role: { type: string, enum: [user, admin] }
        bio: { type: string }
        avatar_url: { type: string, nullable: true, example: /uploads/1700000000000-ab12cd34.png }
        created_at: { type: integer, description: epoch em ms }
    Episode:
      type: object
      properties:
        id: { type: integer }
        season: { type: integer, example: 1 }
        number: { type: integer, example: 1 }
        name: { type: string, example: Piloto }
        video_url: { type: string, example: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }
    Title:
      type: object
      properties:
        id: { type: integer }
        type: { type: string, enum: [movie, series] }
        title: { type: string, example: Big Buck Bunny }
        description: { type: string }
        year: { type: integer, nullable: true, example: 2008 }
        genre: { type: string, enum: [Ação, Comédia, Drama, Terror, Ficção, Animação, Documentário] }
        cover_url: { type: string, example: /img/cover-default.svg }
        video_url: { type: string, nullable: true, description: apenas para filmes }
        is_new: { type: boolean }
        favorite: { type: boolean, description: presente nas listagens e no detalhe }
        episodes:
          type: array
          description: presente no detalhe (GET por id) e na criação
          items: { $ref: '#/components/schemas/Episode' }
    EpisodeInput:
      type: object
      required: [video_url]
      properties:
        season: { type: integer, default: 1 }
        number: { type: integer }
        name: { type: string }
        video_url: { type: string, description: link do YouTube }
    TitleInput:
      type: object
      required: [type, title, genre]
      properties:
        type: { type: string, enum: [movie, series] }
        title: { type: string, example: Meu Filme }
        description: { type: string }
        year: { type: integer, example: 2024 }
        genre: { type: string, enum: [Ação, Comédia, Drama, Terror, Ficção, Animação, Documentário] }
        cover_url: { type: string, description: link de imagem (alternativa ao arquivo `cover`) }
        is_new: { type: boolean, default: true }
        video_url: { type: string, description: obrigatório quando type=movie, example: 'https://youtu.be/aqz-KE-bpKQ' }
        episodes:
          type: array
          description: obrigatório (mínimo 1) quando type=series
          items: { $ref: '#/components/schemas/EpisodeInput' }
    UserInput:
      type: object
      required: [name, email, password]
      properties:
        name: { type: string, example: Maria }
        email: { type: string, example: maria@teste.com }
        password: { type: string, minLength: 6, example: senha123 }
        role: { type: string, enum: [user, admin], default: user, description: apenas em /api/admin/users e /api/test/seed }
  responses:
    Unauthorized:
      description: Token ausente, inválido ou expirado
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
    Forbidden:
      description: Requer papel admin
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
    NotFound:
      description: Recurso não encontrado
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
    BadRequest:
      description: Dados inválidos
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
security:
  - bearerAuth: []
paths:
  /api/auth/register:
    post:
      tags: [Auth]
      summary: Cadastrar usuário (papel user)
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UserInput' }
            example: { name: Maria, email: maria@teste.com, password: senha123 }
      responses:
        '201':
          description: Usuário criado
          content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '409':
          description: E-mail já cadastrado
          content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
  /api/auth/login:
    post:
      tags: [Auth]
      summary: Login (devolve o token)
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties: { email: { type: string }, password: { type: string } }
            example: { email: admin@kathflix.com, password: admin123 }
      responses:
        '200':
          description: Login realizado
          content:
            application/json:
              schema:
                type: object
                properties:
                  token: { type: string, example: 3f1c2a4e-9d2b-4a53-8d56-2d0c3d9a7e11 }
                  user: { $ref: '#/components/schemas/User' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401':
          description: E-mail ou senha inválidos
          content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
  /api/auth/logout:
    post:
      tags: [Auth]
      summary: Encerrar sessão (invalida o token)
      responses:
        '204': { description: Sessão encerrada }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /api/titles:
    get:
      tags: [Catálogo]
      summary: Listar títulos
      parameters:
        - { name: q, in: query, schema: { type: string }, description: busca por parte do título }
        - { name: genre, in: query, schema: { type: string }, description: 'categoria; "Todas" ou vazio = sem filtro' }
        - { name: new, in: query, schema: { type: boolean }, description: 'true = só novidades' }
        - { name: sort, in: query, schema: { type: string, enum: [recent, az, year] }, description: ordenação }
      responses:
        '200':
          description: Lista de títulos
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Title' } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /api/titles/{id}:
    get:
      tags: [Catálogo]
      summary: Detalhe do título (série inclui episódios)
      parameters:
        - { name: id, in: path, required: true, schema: { type: integer } }
      responses:
        '200':
          description: Título
          content: { application/json: { schema: { $ref: '#/components/schemas/Title' } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '404': { $ref: '#/components/responses/NotFound' }
  /api/favorites:
    get:
      tags: [Favoritos]
      summary: Listar favoritos do usuário logado
      responses:
        '200':
          description: Lista de títulos favoritos
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Title' } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /api/favorites/{titleId}:
    parameters:
      - { name: titleId, in: path, required: true, schema: { type: integer } }
    post:
      tags: [Favoritos]
      summary: Favoritar (idempotente)
      responses:
        '201':
          description: Favoritado
          content: { application/json: { schema: { type: object, properties: { titleId: { type: integer }, favorite: { type: boolean, example: true } } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '404': { $ref: '#/components/responses/NotFound' }
    delete:
      tags: [Favoritos]
      summary: Desfavoritar
      responses:
        '204': { description: Removido }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /api/me:
    get:
      tags: [Perfil]
      summary: Dados do usuário logado
      responses:
        '200': { description: Usuário, content: { application/json: { schema: { $ref: '#/components/schemas/User' } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
    put:
      tags: [Perfil]
      summary: Atualizar perfil (campos opcionais)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
                email: { type: string }
                bio: { type: string }
                password: { type: string, minLength: 6 }
                avatar_url: { type: string }
            example: { name: Maria Souza, bio: Fã de séries }
          multipart/form-data:
            schema:
              type: object
              properties:
                name: { type: string }
                email: { type: string }
                bio: { type: string }
                password: { type: string }
                avatar: { type: string, format: binary, description: imagem até 2 MB }
      responses:
        '200': { description: Usuário atualizado, content: { application/json: { schema: { $ref: '#/components/schemas/User' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '409':
          description: E-mail já em uso
          content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
    delete:
      tags: [Perfil]
      summary: Excluir a própria conta
      responses:
        '204': { description: Conta removida }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /api/admin/titles:
    post:
      tags: [Admin]
      summary: Criar filme ou série
      description: |
        Aceita JSON (use `cover_url`) ou `multipart/form-data` (use o arquivo `cover`).
        No multipart, `episodes` vai como **string JSON**.
        Sem imagem alguma, a capa padrão é usada.
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TitleInput' }
            examples:
              filme:
                value: { type: movie, title: Meu Filme, genre: Drama, year: 2024, video_url: 'https://youtu.be/aqz-KE-bpKQ', cover_url: 'https://picsum.photos/300/450' }
              serie:
                value:
                  type: series
                  title: Minha Série
                  genre: Ação
                  episodes:
                    - { season: 1, number: 1, name: Piloto, video_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }
                    - { season: 1, number: 2, name: Segundo, video_url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ' }
          multipart/form-data:
            schema:
              type: object
              required: [type, title, genre]
              properties:
                type: { type: string, enum: [movie, series] }
                title: { type: string }
                description: { type: string }
                year: { type: integer }
                genre: { type: string }
                video_url: { type: string }
                episodes: { type: string, description: 'string JSON: [{"season":1,"number":1,"name":"Piloto","video_url":"..."}]' }
                cover: { type: string, format: binary, description: imagem até 2 MB }
      responses:
        '201': { description: Título criado, content: { application/json: { schema: { $ref: '#/components/schemas/Title' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
  /api/admin/titles/{id}:
    delete:
      tags: [Admin]
      summary: Remover título (e episódios/favoritos relacionados)
      parameters:
        - { name: id, in: path, required: true, schema: { type: integer } }
      responses:
        '204': { description: Removido }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
  /api/admin/users:
    get:
      tags: [Admin]
      summary: Listar usuários ativos (sessão nos últimos 30 min)
      parameters:
        - { name: all, in: query, schema: { type: boolean }, description: 'true = todos os cadastrados' }
      responses:
        '200':
          description: Usuários
          content:
            application/json:
              schema:
                type: array
                items:
                  allOf:
                    - $ref: '#/components/schemas/User'
                    - type: object
                      properties: { last_seen_at: { type: integer, nullable: true } }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
    post:
      tags: [Admin]
      summary: Criar usuário (permite definir o papel)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UserInput' }
            example: { name: Novo Admin, email: novo@teste.com, password: abc123, role: admin }
      responses:
        '201': { description: Usuário criado, content: { application/json: { schema: { $ref: '#/components/schemas/User' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409':
          description: E-mail já cadastrado
          content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
  /api/admin/users/{id}:
    delete:
      tags: [Admin]
      summary: Remover usuário (não permite remover a si mesmo)
      parameters:
        - { name: id, in: path, required: true, schema: { type: integer } }
      responses:
        '204': { description: Removido }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
  /api/test/reset:
    post:
      tags: [Apoio a testes]
      summary: Voltar o banco ao seed inicial
      description: Sem autenticação. Indisponível se `KATHFLIX_TEST_API=off`.
      security: []
      responses:
        '200': { description: Banco resetado, content: { application/json: { schema: { type: object, properties: { status: { type: string, example: reset } } } } } }
  /api/test/seed:
    post:
      tags: [Apoio a testes]
      summary: Criar usuários e títulos em lote
      description: Sem autenticação. Usa as mesmas regras de validação de `/api/admin/*`.
      security: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                users: { type: array, items: { $ref: '#/components/schemas/UserInput' } }
                titles: { type: array, items: { $ref: '#/components/schemas/TitleInput' } }
            example:
              users: [{ name: QA Um, email: qa-um@teste.com, password: abc123 }]
              titles: [{ type: movie, title: qa-Filme, genre: Drama, video_url: 'https://youtu.be/aqz-KE-bpKQ' }]
      responses:
        '201':
          description: Itens criados (com ids)
          content:
            application/json:
              schema:
                type: object
                properties:
                  users: { type: array, items: { type: object, properties: { id: { type: integer }, email: { type: string } } } }
                  titles: { type: array, items: { type: object, properties: { id: { type: integer }, title: { type: string } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '409':
          description: E-mail já cadastrado
          content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
  /api/test/cleanup:
    delete:
      tags: [Apoio a testes]
      summary: Remover tudo que começa com um prefixo (teardown)
      description: Remove usuários cujo e-mail começa com o prefixo e títulos cujo nome começa com o prefixo. Nunca remove os usuários do seed. Prefixo mínimo de 3 caracteres.
      security: []
      requestBody:
        content:
          application/json:
            schema: { type: object, required: [prefix], properties: { prefix: { type: string, example: 'qa-' } } }
      responses:
        '200': { description: Quantidade removida, content: { application/json: { schema: { type: object, properties: { users: { type: integer }, titles: { type: integer } } } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
```

**Step 4: Montar o Swagger em `app.js`** (antes de `app.use('/api', notFound)`):

```js
  const fs = require('node:fs');
  const YAML = require('yaml');
  const swaggerUi = require('swagger-ui-express');
  const specText = fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8');
  app.get('/api-docs/openapi.yaml', (req, res) => res.type('text/yaml').send(specText));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(YAML.parse(specText), { customSiteTitle: 'KathFlix API' }));
```

**Step 5: Rodar** — `npm test` → PASS. Se algum endpoint do YAML não existir, o teste aponta qual.

**Step 6: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): OpenAPI spec and Swagger UI at /api-docs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Frontend base (CSS, `common.js`, capa padrão) + login e cadastro

**Files (todos em `kathflix/public/`):** `css/styles.css`, `js/common.js`, `img/cover-default.svg`, `login.html`, `js/login.js`, `register.html`, `js/register.js`

**Step 1: `img/cover-default.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b20710"/><stop offset="1" stop-color="#141414"/></linearGradient></defs>
  <rect width="300" height="450" fill="url(#g)"/>
  <text x="150" y="235" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">KATHFLIX</text>
</svg>
```

**Step 2: `css/styles.css`**

```css
:root { --bg:#141414; --panel:#1f1f1f; --red:#e50914; --text:#f3f3f3; --muted:#a3a3a3; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font-family: Arial, Helvetica, sans-serif; }
a { color: inherit; }
[hidden] { display:none !important; }
.logo { color:var(--red); font-weight:bold; letter-spacing:2px; font-size:1.6rem; text-decoration:none; }
.nav { display:flex; align-items:center; gap:24px; padding:14px 32px; background:#000; position:sticky; top:0; z-index:5; }
.nav nav { display:flex; gap:18px; flex:1; }
.nav nav a { text-decoration:none; color:var(--muted); } .nav nav a:hover, .nav nav a.active { color:#fff; }
button, .btn { background:var(--red); color:#fff; border:0; border-radius:4px; padding:9px 16px; cursor:pointer; font-size:.95rem; text-decoration:none; display:inline-block; }
button.secondary { background:#333; } button.danger { background:#7a1016; }
button:disabled { opacity:.4; cursor:not-allowed; }
input, select, textarea { width:100%; padding:10px; border-radius:4px; border:1px solid #444; background:#2b2b2b; color:#fff; font-size:.95rem; }
label { display:block; margin:12px 0 4px; color:var(--muted); font-size:.85rem; }
.auth-page { display:flex; justify-content:center; align-items:center; min-height:100vh; background:radial-gradient(circle at top,#3a0a0d,#141414 60%); }
.auth-box { width:100%; max-width:380px; padding:32px; background:rgba(0,0,0,.8); border-radius:8px; }
.auth-box h1 { text-align:center; margin-top:0; } .auth-box button[type=submit] { width:100%; margin-top:20px; }
.auth-box .alt { text-align:center; margin-top:16px; color:var(--muted); font-size:.9rem; }
.msg { padding:10px 12px; border-radius:4px; margin:12px 0; font-size:.9rem; }
.msg.error { background:#5c1b1f; } .msg.success { background:#14532d; } .msg.info { background:#1e3a5f; }
main { padding:24px 32px; max-width:1200px; margin:0 auto; }
.hero { min-height:240px; border-radius:8px; padding:40px; margin-bottom:24px; display:flex; flex-direction:column; justify-content:flex-end; background:linear-gradient(90deg,#000c,#0000),url('/img/cover-default.svg') center/cover; }
.hero h2 { font-size:2.2rem; margin:0 0 8px; }
.filters { display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px; margin-bottom:8px; }
section h2 { margin:28px 0 12px; }
.row { display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; }
.card { flex:0 0 160px; background:var(--panel); border-radius:6px; overflow:hidden; padding-bottom:10px; }
.card img { width:100%; aspect-ratio:2/3; object-fit:cover; display:block; }
.card-title { font-size:.95rem; margin:8px 10px 2px; } .card-meta { color:var(--muted); font-size:.75rem; margin:0 10px 8px; }
.card .fav-btn { margin:0 10px; width:calc(100% - 20px); padding:6px; font-size:.8rem; }
.skeleton-card { flex:0 0 160px; height:300px; border-radius:6px; background:linear-gradient(90deg,#222,#333,#222); background-size:200% 100%; animation:sk 1.2s infinite; }
@keyframes sk { to { background-position:-200% 0; } }
.promo { display:flex; align-items:center; gap:12px; background:#1e3a5f; padding:12px 32px; }
.promo span { flex:1; }
.player { width:100%; aspect-ratio:16/9; border:0; border-radius:8px; background:#000; }
.episodes { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
.episodes button.active { background:#fff; color:#000; }
table { width:100%; border-collapse:collapse; margin-top:12px; }
th, td { text-align:left; padding:8px 10px; border-bottom:1px solid #333; font-size:.9rem; }
.tabs { display:flex; gap:8px; margin-bottom:16px; } .tabs button[aria-selected=true] { background:#fff; color:#000; }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; } .form-grid .full { grid-column:1/-1; }
.episode-row { display:grid; grid-template-columns:1fr 2fr; gap:8px; margin-bottom:6px; }
.modal-bg { position:fixed; inset:0; background:#000a; display:flex; align-items:center; justify-content:center; z-index:10; }
.modal { background:var(--panel); padding:24px; border-radius:8px; max-width:360px; width:100%; }
.modal .actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.avatar { width:96px; height:96px; border-radius:50%; object-fit:cover; background:#333; }
.site-footer { text-align:center; color:var(--muted); padding:32px; font-size:.8rem; }
@media (max-width:700px) { .filters, .form-grid { grid-template-columns:1fr; } .nav { padding:12px 16px; } main { padding:16px; } }
```

**Step 3: `js/common.js`**

```js
(function () {
  const TOKEN_KEY = 'kathflix.token';
  const USER_KEY = 'kathflix.user';

  const KF = {
    getToken: () => localStorage.getItem(TOKEN_KEY),
    getUser() {
      try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    },
    setSession(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    setUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user)); },
    clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },

    async api(path, { method = 'GET', json, form } = {}) {
      const headers = {};
      const token = KF.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      let body;
      if (form) body = form;
      else if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
      const res = await fetch(`/api${path}`, { method, headers, body });
      if (res.status === 204) return null;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && token && !path.startsWith('/auth/login')) {
          KF.clearSession();
          location.href = '/login.html';
        }
        throw new Error(data.error || `Erro ${res.status}`);
      }
      return data;
    },

    requireAuth() {
      const user = KF.getUser();
      if (!KF.getToken() || !user) { location.href = '/login.html'; throw new Error('redirect'); }
      return user;
    },

    alertsEnabled() {
      const q = new URLSearchParams(location.search).get('alerts');
      if (q === 'off') return false;
      return localStorage.getItem('kathflix.alerts') !== 'off';
    },

    youtubeEmbed(url) {
      const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      return m ? `https://www.youtube.com/embed/${m[1]}` : '';
    },

    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    show(el, text) { el.textContent = text; el.hidden = false; },

    renderNav(active) {
      const user = KF.getUser();
      const el = document.getElementById('nav');
      el.innerHTML = `
        <header class="nav">
          <a class="logo" href="/home.html" id="nav-logo" data-testid="nav-logo">KATHFLIX</a>
          <nav>
            <a href="/home.html" id="nav-home" data-testid="nav-home" class="${active === 'home' ? 'active' : ''}">Início</a>
            <a href="/profile.html" id="nav-profile" data-testid="nav-profile" class="${active === 'profile' ? 'active' : ''}">Perfil</a>
            ${user.role === 'admin' ? `<a href="/admin.html" id="nav-admin" data-testid="nav-admin" class="${active === 'admin' ? 'active' : ''}">Admin</a>` : ''}
          </nav>
          <span id="nav-username" data-testid="nav-username">${KF.esc(user.name)}</span>
          <button type="button" id="nav-logout" data-testid="nav-logout" class="secondary">Sair</button>
        </header>`;
      document.getElementById('nav-logout').addEventListener('click', async () => {
        try { await KF.api('/auth/logout', { method: 'POST' }); } catch { /* sessão já inválida */ }
        KF.clearSession();
        location.href = '/login.html';
      });
    },

    renderFooter() {
      const f = document.createElement('footer');
      f.className = 'site-footer';
      f.textContent = '© KathFlix — projeto de treinamento de automação';
      document.body.appendChild(f);
    },
  };

  window.KF = KF;
})();
```

**Step 4: `login.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KathFlix - Entrar</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="auth-page">
  <main class="auth-box">
    <h1 class="logo">KATHFLIX</h1>
    <form id="login-form" novalidate>
      <h2>Entrar</h2>
      <div id="login-success" class="msg success" role="status" data-testid="login-success" hidden></div>
      <div id="login-error" class="msg error" role="alert" data-testid="login-error" hidden></div>
      <label for="login-email">E-mail</label>
      <input id="login-email" data-testid="login-email" type="email" autocomplete="username">
      <label for="login-password">Senha</label>
      <input id="login-password" data-testid="login-password" type="password" autocomplete="current-password">
      <button type="submit" id="login-submit" data-testid="login-submit">Entrar</button>
    </form>
    <p class="alt">Novo por aqui? <a href="/register.html" id="login-register-link" data-testid="login-register-link">Cadastre-se</a></p>
  </main>
  <script src="/js/common.js"></script>
  <script src="/js/login.js"></script>
</body>
</html>
```

**Step 5: `js/login.js`**

```js
(function () {
  const params = new URLSearchParams(location.search);
  if (params.get('alerts') === 'off') localStorage.setItem('kathflix.alerts', 'off');
  if (params.get('alerts') === 'on') localStorage.removeItem('kathflix.alerts');

  if (KF.getToken() && KF.getUser()) { location.href = '/home.html'; return; }

  const err = document.getElementById('login-error');
  if (params.get('registered')) KF.show(document.getElementById('login-success'), 'Cadastro realizado! Faça login para continuar.');

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) return KF.show(err, 'Informe e-mail e senha');
    try {
      const { token, user } = await KF.api('/auth/login', { method: 'POST', json: { email, password } });
      KF.setSession(token, user);
      if (KF.alertsEnabled()) {
        sessionStorage.setItem('kathflix.promo', '1');
        alert(`Bem-vindo ao KathFlix, ${user.name}!`);
      }
      location.href = '/home.html';
    } catch (ex) {
      KF.show(err, ex.message);
    }
  });
})();
```

**Step 6: `register.html`** (mesmo `<head>` do login, título `KathFlix - Cadastro`)

```html
<body class="auth-page">
  <main class="auth-box">
    <h1 class="logo">KATHFLIX</h1>
    <form id="register-form" novalidate>
      <h2>Criar conta</h2>
      <div id="register-error" class="msg error" role="alert" data-testid="register-error" hidden></div>
      <label for="register-name">Nome</label>
      <input id="register-name" data-testid="register-name" type="text">
      <label for="register-email">E-mail</label>
      <input id="register-email" data-testid="register-email" type="email">
      <label for="register-password">Senha</label>
      <input id="register-password" data-testid="register-password" type="password">
      <label for="register-confirm">Confirmar senha</label>
      <input id="register-confirm" data-testid="register-confirm" type="password">
      <button type="submit" id="register-submit" data-testid="register-submit">Cadastrar</button>
    </form>
    <p class="alt">Já tem conta? <a href="/login.html" id="register-login-link" data-testid="register-login-link">Entrar</a></p>
  </main>
  <script src="/js/common.js"></script>
  <script src="/js/register.js"></script>
</body>
```

**`js/register.js`**

```js
(function () {
  const err = document.getElementById('register-error');
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    if (!name || !email || !password) return KF.show(err, 'Preencha todos os campos');
    if (password !== confirm) return KF.show(err, 'As senhas não conferem');
    try {
      await KF.api('/auth/register', { method: 'POST', json: { name, email, password } });
      location.href = '/login.html?registered=1';
    } catch (ex) {
      KF.show(err, ex.message);
    }
  });
})();
```

**Step 7: Verificar manualmente**

```bash
cd kathflix && npm start
```
Abrir `http://localhost:3000`: deve redirecionar ao login. Cadastrar um usuário, voltar ao login, ver a mensagem de sucesso, e logar errado (ver erro inline). (O login certo vai dar 404 em `/home.html` até a Task 12.)

**Step 8: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): frontend base, login and register pages" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tela inicial (`home.html`)

**Files:** `kathflix/public/home.html`, `kathflix/public/js/home.js`

**Step 1: `home.html`** (mesmo `<head>`, título `KathFlix - Início`)

```html
<body>
  <div id="nav"></div>
  <div id="promo-banner" class="promo" role="alert" data-testid="promo-banner" hidden>
    <span data-testid="promo-text">Novo episódio disponível! Deseja ver agora?</span>
    <button type="button" id="promo-watch" data-testid="promo-watch">Ver agora</button>
    <button type="button" id="promo-dismiss" data-testid="promo-dismiss" class="secondary">Dispensar</button>
    <button type="button" id="promo-close" data-testid="promo-close" class="secondary" aria-label="Fechar">×</button>
  </div>
  <main>
    <section class="hero" id="hero"></section>

    <div class="filters">
      <div><label for="search-input">Buscar</label>
        <input id="search-input" data-testid="search-input" type="search" placeholder="Digite o título"></div>
      <div><label for="category-select">Categoria</label>
        <select id="category-select" data-testid="category-select">
          <option value="">Todas</option>
          <option>Ação</option><option>Comédia</option><option>Drama</option><option>Terror</option>
          <option>Ficção</option><option>Animação</option><option>Documentário</option>
        </select></div>
      <div><label for="sort-select">Ordenar por</label>
        <select id="sort-select" data-testid="sort-select">
          <option value="recent">Mais recentes</option><option value="az">A-Z</option><option value="year">Ano</option>
        </select></div>
    </div>

    <section data-testid="section-new"><h2>Novidades</h2><div class="row" id="row-new"></div></section>
    <section data-testid="section-catalog"><h2>Catálogo</h2><div class="row" id="row-catalog"></div>
      <p id="catalog-empty" data-testid="catalog-empty" hidden>Nenhum título encontrado</p></section>
    <section data-testid="section-favorites"><h2>Meus Favoritos</h2><div class="row" id="row-fav"></div>
      <p id="fav-empty" data-testid="fav-empty" hidden>Você ainda não tem favoritos</p></section>
  </main>
  <script src="/js/common.js"></script>
  <script src="/js/home.js"></script>
</body>
```

O hero e o footer não têm `data-testid` (requisito 10).

**Step 2: `js/home.js`**

```js
(function () {
  KF.requireAuth();
  KF.renderNav('home');
  KF.renderFooter();

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let allTitles = [];

  function skeleton(row) {
    row.innerHTML = '<div class="skeleton-card" data-testid="skeleton"></div>'.repeat(5);
  }

  function card(t, prefix) {
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.testid = `${prefix}-card-${t.id}`;
    el.innerHTML = `
      <a href="/watch.html?id=${t.id}">
        <img src="${KF.esc(t.cover_url)}" alt="Capa de ${KF.esc(t.title)}">
        <h3 class="card-title">${KF.esc(t.title)}</h3>
      </a>
      <p class="card-meta">${t.type === 'series' ? 'Série' : 'Filme'} · ${KF.esc(t.genre)}${t.year ? ' · ' + t.year : ''}</p>
      <button type="button" id="fav-toggle" class="fav-btn secondary" aria-pressed="${t.favorite}">${t.favorite ? '★ Favorito' : '☆ Favoritar'}</button>`;
    el.querySelector('#fav-toggle').addEventListener('click', async () => {
      await KF.api(`/favorites/${t.id}`, { method: t.favorite ? 'DELETE' : 'POST' });
      await load(false);
    });
    return el;
  }

  function fill(row, titles, prefix) {
    row.replaceChildren(...titles.map((t) => card(t, prefix)));
  }

  function renderHero() {
    const t = allTitles.find((x) => x.is_new) || allTitles[0];
    $('hero').innerHTML = t
      ? `<h2>${KF.esc(t.title)}</h2><p>${KF.esc(t.description)}</p><div><a class="btn" href="/watch.html?id=${t.id}">Assistir</a></div>`
      : '<h2>KathFlix</h2>';
  }

  async function load(withSkeleton) {
    if (withSkeleton) { ['row-new', 'row-catalog', 'row-fav'].forEach((id) => skeleton($(id))); await sleep(700); }
    const params = new URLSearchParams();
    if ($('search-input').value.trim()) params.set('q', $('search-input').value.trim());
    if ($('category-select').value) params.set('genre', $('category-select').value);
    params.set('sort', $('sort-select').value);
    const [catalog, news, favs] = await Promise.all([
      KF.api(`/titles?${params}`),
      KF.api('/titles?new=true'),
      KF.api('/favorites'),
    ]);
    if (!allTitles.length) { allTitles = news.concat(catalog); renderHero(); }
    fill($('row-new'), news, 'new');
    fill($('row-catalog'), catalog, 'catalog');
    fill($('row-fav'), favs, 'fav');
    $('catalog-empty').hidden = catalog.length > 0;
    $('fav-empty').hidden = favs.length > 0;
  }

  // banner pós-login
  if (KF.alertsEnabled() && sessionStorage.getItem('kathflix.promo')) {
    sessionStorage.removeItem('kathflix.promo');
    $('promo-banner').hidden = false;
  }
  const closeBanner = () => { $('promo-banner').hidden = true; };
  $('promo-dismiss').addEventListener('click', closeBanner);
  $('promo-close').addEventListener('click', closeBanner);
  $('promo-watch').addEventListener('click', async () => {
    const list = await KF.api('/titles');
    const target = list.find((t) => t.type === 'series') || list[0];
    location.href = `/watch.html?id=${target.id}`;
  });

  let timer;
  $('search-input').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(false), 300); });
  $('category-select').addEventListener('change', () => load(false));
  $('sort-select').addEventListener('change', () => load(false));

  load(true);
})();
```

**Step 3: Verificar manualmente** — `npm start`; logar como `user@kathflix.com`. Conferir: alert nativo, banner com 3 botões, skeleton de ~0,7 s, 3 carrosséis, filtro de categoria, busca, ordenação, favoritar move o card para "Meus Favoritos". Testar também `http://localhost:3000/login.html?alerts=off`: sem alert nem banner.

**Step 4: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): home page with catalog, filters, favorites and post-login alerts" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Tela de assistir (`watch.html`)

**Files:** `kathflix/public/watch.html`, `kathflix/public/js/watch.js`

**Step 1: `watch.html`**

```html
<body>
  <div id="nav"></div>
  <main>
    <h1 id="watch-title" data-testid="watch-title"></h1>
    <p id="watch-meta" data-testid="watch-meta"></p>
    <iframe id="player" data-testid="player" class="player" title="Player de vídeo"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    <div id="episodes" class="episodes" data-testid="episodes" hidden></div>
    <p id="watch-description" data-testid="watch-description"></p>
    <button type="button" id="watch-favorite" data-testid="watch-favorite"></button>
    <div id="watch-error" class="msg error" role="alert" hidden></div>
  </main>
  <script src="/js/common.js"></script>
  <script src="/js/watch.js"></script>
</body>
```

**Step 2: `js/watch.js`**

```js
(function () {
  KF.requireAuth();
  KF.renderNav('home');
  KF.renderFooter();

  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get('id');
  let title;

  function play(url) { $('player').src = KF.youtubeEmbed(url); }

  function renderFav() {
    $('watch-favorite').textContent = title.favorite ? '★ Remover dos favoritos' : '☆ Adicionar aos favoritos';
    $('watch-favorite').setAttribute('aria-pressed', String(title.favorite));
  }

  async function init() {
    try {
      title = await KF.api(`/titles/${encodeURIComponent(id)}`);
    } catch (ex) {
      return KF.show($('watch-error'), ex.message);
    }
    $('watch-title').textContent = title.title;
    $('watch-meta').textContent = `${title.type === 'series' ? 'Série' : 'Filme'} · ${title.genre}${title.year ? ' · ' + title.year : ''}`;
    $('watch-description').textContent = title.description;
    renderFav();

    if (title.type === 'series') {
      const box = $('episodes');
      box.hidden = false;
      title.episodes.forEach((ep, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary';
        b.dataset.testid = `episode-${ep.season}-${ep.number}`;
        b.textContent = `T${ep.season}E${ep.number} · ${ep.name}`;
        b.addEventListener('click', () => {
          box.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
          play(ep.video_url);
        });
        box.appendChild(b);
        if (i === 0) b.click();
      });
    } else {
      play(title.video_url);
    }
  }

  $('watch-favorite').addEventListener('click', async () => {
    await KF.api(`/favorites/${title.id}`, { method: title.favorite ? 'DELETE' : 'POST' });
    title.favorite = !title.favorite;
    renderFav();
  });

  init();
})();
```

**Step 3: Verificar manualmente** — abrir um filme (iframe com o embed) e a série (clicar nos episódios troca o `src` do iframe). Favoritar e voltar à home. `watch.html?id=999` mostra o erro em `role="alert"`.

**Step 4: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): watch page with youtube embed and episodes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Perfil (`profile.html`)

**Files:** `kathflix/public/profile.html`, `kathflix/public/js/profile.js`

**Step 1: `profile.html`**

```html
<body>
  <div id="nav"></div>
  <main>
    <h1>Meu perfil</h1>
    <form id="profile-form" novalidate style="max-width:480px">
      <img id="profile-avatar" data-testid="profile-avatar" class="avatar" alt="Avatar" src="/img/cover-default.svg">
      <label for="profile-avatar-file">Avatar (imagem até 2 MB)</label>
      <input id="profile-avatar-file" data-testid="profile-avatar-file" type="file" accept="image/*">
      <label for="profile-name">Nome</label>
      <input id="profile-name" data-testid="profile-name" type="text">
      <label for="profile-email">E-mail</label>
      <input id="profile-email" data-testid="profile-email" type="email">
      <label for="profile-bio">Bio</label>
      <textarea id="profile-bio" data-testid="profile-bio" rows="3"></textarea>
      <label for="profile-password">Nova senha (deixe vazio para manter)</label>
      <input id="profile-password" data-testid="profile-password" type="password">
      <div id="profile-message" class="msg" role="alert" data-testid="profile-message" hidden></div>
      <button type="submit" id="profile-save" data-testid="profile-save">Salvar</button>
    </form>
  </main>
  <script src="/js/common.js"></script>
  <script src="/js/profile.js"></script>
</body>
```

**Step 2: `js/profile.js`**

```js
(function () {
  KF.requireAuth();
  KF.renderNav('profile');
  KF.renderFooter();

  const $ = (id) => document.getElementById(id);
  const msg = $('profile-message');

  function fill(u) {
    $('profile-name').value = u.name;
    $('profile-email').value = u.email;
    $('profile-bio').value = u.bio || '';
    $('profile-avatar').src = u.avatar_url || '/img/cover-default.svg';
  }

  function say(text, kind) {
    msg.className = `msg ${kind}`;
    KF.show(msg, text);
  }

  KF.api('/me').then(fill).catch((ex) => say(ex.message, 'error'));

  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.hidden = true;
    const form = new FormData();
    form.append('name', $('profile-name').value.trim());
    form.append('email', $('profile-email').value.trim());
    form.append('bio', $('profile-bio').value);
    if ($('profile-password').value) form.append('password', $('profile-password').value);
    const file = $('profile-avatar-file').files[0];
    if (file) form.append('avatar', file);
    try {
      const user = await KF.api('/me', { method: 'PUT', form });
      KF.setUser(user);
      fill(user);
      $('profile-password').value = '';
      $('profile-avatar-file').value = '';
      KF.renderNav('profile');
      say('Perfil atualizado com sucesso', 'success');
    } catch (ex) {
      say(ex.message, 'error');
    }
  });
})();
```

**Step 3: Verificar manualmente** — alterar nome/bio, salvar, ver a mensagem "Perfil atualizado com sucesso" e o novo nome na navbar; recarregar e conferir persistência; usar e-mail do admin e ver o erro 409; enviar um avatar PNG.

**Step 4: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): profile page" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Tela de administração (`admin.html`)

**Files:** `kathflix/public/admin.html`, `kathflix/public/js/admin.js`

**Step 1: `admin.html`**

```html
<body>
  <div id="nav"></div>
  <main>
    <h1>Administração</h1>
    <div class="tabs" role="tablist">
      <button type="button" id="tab-titles" data-testid="tab-titles" role="tab" aria-selected="true">Filmes e séries</button>
      <button type="button" id="tab-users" data-testid="tab-users" role="tab" aria-selected="false" class="secondary">Usuários</button>
    </div>
    <div id="admin-message" class="msg" role="alert" data-testid="admin-message" hidden></div>

    <div id="panel-titles">
      <h2>Adicionar título</h2>
      <form id="title-form" novalidate class="form-grid">
        <div><label for="title-name">Título</label><input id="title-name" data-testid="title-name" type="text"></div>
        <div><label for="title-genre">Categoria</label>
          <select id="title-genre" data-testid="title-genre">
            <option>Ação</option><option>Comédia</option><option>Drama</option><option>Terror</option>
            <option>Ficção</option><option>Animação</option><option>Documentário</option>
          </select></div>
        <div><label for="title-type">Tipo</label>
          <select id="title-type" data-testid="title-type"><option value="movie">Filme</option><option value="series">Série</option></select></div>
        <div><label for="title-year">Ano</label><input id="title-year" data-testid="title-year" type="number" min="1900" max="2100"></div>
        <div class="full"><label for="title-description">Descrição</label><textarea id="title-description" data-testid="title-description" rows="2"></textarea></div>
        <div><label for="title-cover-file">Imagem de capa (arquivo)</label><input id="title-cover-file" data-testid="title-cover-file" type="file" accept="image/*"></div>
        <div><label for="title-cover-url">ou URL da imagem</label><input id="title-cover-url" data-testid="title-cover-url" type="url"></div>
        <div class="full" id="movie-fields">
          <label for="title-video-url">Link do vídeo (YouTube)</label>
          <input id="title-video-url" data-testid="title-video-url" type="url" placeholder="https://www.youtube.com/watch?v=...">
        </div>
        <div class="full" id="series-fields" hidden>
          <label>Episódios</label>
          <div id="episode-list"></div>
          <button type="button" id="add-episode" data-testid="add-episode" class="secondary">+ Adicionar episódio</button>
        </div>
        <div class="full"><button type="submit" id="admin-add-title" data-testid="admin-add-title">Adicionar ao catálogo</button></div>
      </form>

      <h2>Catálogo atual</h2>
      <table data-testid="titles-table">
        <thead><tr><th>Título</th><th>Tipo</th><th>Categoria</th><th>Ano</th><th></th></tr></thead>
        <tbody id="titles-body"></tbody>
      </table>
    </div>

    <div id="panel-users" hidden>
      <h2>Usuários</h2>
      <label><input id="show-all-users" data-testid="show-all-users" type="checkbox" style="width:auto"> Mostrar todos os cadastrados (não só os ativos)</label>
      <table data-testid="users-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Última atividade</th><th></th></tr></thead>
        <tbody id="users-body"></tbody>
      </table>
    </div>
  </main>

  <div id="confirm-modal" class="modal-bg" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-text" data-testid="confirm-modal">
      <p id="confirm-text" data-testid="confirm-text"></p>
      <div class="actions">
        <button type="button" id="confirm-cancel" data-testid="confirm-cancel" class="secondary">Cancelar</button>
        <button type="button" id="confirm-ok" data-testid="confirm-ok" class="danger">Remover</button>
      </div>
    </div>
  </div>
  <script src="/js/common.js"></script>
  <script src="/js/admin.js"></script>
</body>
```

**Step 2: `js/admin.js`**

```js
(function () {
  const me = KF.requireAuth();
  if (me.role !== 'admin') { location.href = '/home.html'; return; }
  KF.renderNav('admin');
  KF.renderFooter();

  const $ = (id) => document.getElementById(id);
  const msg = $('admin-message');
  const say = (text, kind) => { msg.className = `msg ${kind}`; KF.show(msg, text); };

  function showTab(name) {
    $('panel-titles').hidden = name !== 'titles';
    $('panel-users').hidden = name !== 'users';
    $('tab-titles').setAttribute('aria-selected', String(name === 'titles'));
    $('tab-users').setAttribute('aria-selected', String(name === 'users'));
    $('tab-titles').className = name === 'titles' ? '' : 'secondary';
    $('tab-users').className = name === 'users' ? '' : 'secondary';
    msg.hidden = true;
    if (name === 'users') loadUsers();
  }
  $('tab-titles').addEventListener('click', () => showTab('titles'));
  $('tab-users').addEventListener('click', () => showTab('users'));

  function confirmRemove(text) {
    return new Promise((resolve) => {
      $('confirm-text').textContent = text;
      $('confirm-modal').hidden = false;
      const done = (v) => { $('confirm-modal').hidden = true; resolve(v); };
      $('confirm-ok').onclick = () => done(true);
      $('confirm-cancel').onclick = () => done(false);
    });
  }

  // ---- títulos ----
  function addEpisodeRow() {
    const n = $('episode-list').children.length + 1;
    const row = document.createElement('div');
    row.className = 'episode-row';
    row.dataset.testid = 'episode-row';
    row.innerHTML = `
      <input name="ep-name" type="text" placeholder="Nome do episódio" aria-label="Nome do episódio ${n}" value="Episódio ${n}">
      <input name="ep-url" type="url" placeholder="Link do YouTube" aria-label="Link do episódio ${n}">`;
    $('episode-list').appendChild(row);
  }

  function syncType() {
    const series = $('title-type').value === 'series';
    $('movie-fields').hidden = series;
    $('series-fields').hidden = !series;
    if (series && !$('episode-list').children.length) addEpisodeRow();
  }
  $('title-type').addEventListener('change', syncType);
  $('add-episode').addEventListener('click', addEpisodeRow);

  async function loadTitles() {
    const titles = await KF.api('/titles?sort=recent');
    $('titles-body').innerHTML = titles.map((t) => `
      <tr data-testid="title-row-${t.id}" data-id="${t.id}" data-name="${KF.esc(t.title)}">
        <td>${KF.esc(t.title)}</td><td>${t.type === 'series' ? 'Série' : 'Filme'}</td>
        <td>${KF.esc(t.genre)}</td><td>${t.year ?? ''}</td>
        <td><button type="button" id="remove-btn" class="danger">Remover</button></td>
      </tr>`).join('');
  }

  $('titles-body').addEventListener('click', async (e) => {
    if (!e.target.closest('#remove-btn')) return;
    const tr = e.target.closest('tr');
    if (!(await confirmRemove(`Remover "${tr.dataset.name}" do catálogo?`))) return;
    try {
      await KF.api(`/admin/titles/${tr.dataset.id}`, { method: 'DELETE' });
      say(`Título "${tr.dataset.name}" removido`, 'success');
      loadTitles();
    } catch (ex) { say(ex.message, 'error'); }
  });

  $('title-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.hidden = true;
    const form = new FormData();
    const type = $('title-type').value;
    form.append('type', type);
    form.append('title', $('title-name').value.trim());
    form.append('genre', $('title-genre').value);
    form.append('description', $('title-description').value);
    if ($('title-year').value) form.append('year', $('title-year').value);
    const file = $('title-cover-file').files[0];
    if (file) form.append('cover', file);
    else if ($('title-cover-url').value.trim()) form.append('cover_url', $('title-cover-url').value.trim());
    if (type === 'movie') {
      form.append('video_url', $('title-video-url').value.trim());
    } else {
      const eps = [...$('episode-list').children].map((row, i) => ({
        season: 1,
        number: i + 1,
        name: row.querySelector('[name=ep-name]').value.trim(),
        video_url: row.querySelector('[name=ep-url]').value.trim(),
      }));
      form.append('episodes', JSON.stringify(eps));
    }
    try {
      const t = await KF.api('/admin/titles', { method: 'POST', form });
      say(`Título "${t.title}" adicionado com sucesso`, 'success');
      $('title-form').reset();
      $('episode-list').innerHTML = '';
      syncType();
      loadTitles();
    } catch (ex) { say(ex.message, 'error'); }
  });

  // ---- usuários ----
  async function loadUsers() {
    const users = await KF.api(`/admin/users${$('show-all-users').checked ? '?all=true' : ''}`);
    $('users-body').innerHTML = users.map((u) => `
      <tr data-testid="user-row-${u.id}" data-id="${u.id}" data-name="${KF.esc(u.name)}">
        <td>${KF.esc(u.name)}</td><td>${KF.esc(u.email)}</td><td>${u.role}</td>
        <td>${u.last_seen_at ? new Date(u.last_seen_at).toLocaleString('pt-BR') : '-'}</td>
        <td><button type="button" id="remove-btn" class="danger" ${u.id === me.id ? 'disabled' : ''}>Remover</button></td>
      </tr>`).join('');
  }
  $('show-all-users').addEventListener('change', loadUsers);

  $('users-body').addEventListener('click', async (e) => {
    if (!e.target.closest('#remove-btn')) return;
    const tr = e.target.closest('tr');
    if (!(await confirmRemove(`Remover o usuário "${tr.dataset.name}"?`))) return;
    try {
      await KF.api(`/admin/users/${tr.dataset.id}`, { method: 'DELETE' });
      say(`Usuário "${tr.dataset.name}" removido`, 'success');
      loadUsers();
    } catch (ex) { say(ex.message, 'error'); }
  });

  syncType();
  loadTitles();
})();
```

**Step 3: Verificar manualmente** — logar como admin (`admin@kathflix.com`): criar um filme com URL de imagem, uma série com 2 episódios e um filme com upload; remover um título via modal (Cancelar não remove; Remover remove); aba Usuários: ver os ativos, marcar "mostrar todos", remover um usuário cadastrado; o botão do próprio admin fica desabilitado. Logar como `user@kathflix.com` e abrir `/admin.html` deve redirecionar à home (o link "Admin" também não aparece).

**Step 4: Commit**

```bash
cd .. && git add kathflix && git commit -m "feat(kathflix): admin page for titles and users" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Smoke test E2E do frontend (verificação, não vai para o repo)

Esta tarefa confirma que o frontend funciona de ponta a ponta antes de seguir. O script fica no scratchpad, fora do repositório.

**Step 1: Garantir o Playwright**

```bash
cd automation && npm install && npx playwright install chromium
```
(Se preferir yarn: `yarn install`.)

**Step 2: Subir a app em background**

```bash
cd ../kathflix && KATHFLIX_DB=":memory:" PORT=3100 node server.js
```
(Rodar em segundo plano. `KATHFLIX_DB=:memory:` mantém a base limpa.)

**Step 3: Script `<scratchpad>/smoke.spec.ts`** (mover para `automation/tests/` apenas durante a execução e apagar depois, ou rodar com `--config` apontando para o scratchpad)

```ts
import { test, expect } from '@playwright/test';
const BASE = 'http://localhost:3100';

test('fluxo completo do KathFlix', async ({ page, request }) => {
  // setup via API
  const login = await request.post(`${BASE}/api/auth/login`, { data: { email: 'admin@kathflix.com', password: 'admin123' } });
  const { token } = await login.json();
  const created = await request.post(`${BASE}/api/admin/titles`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { type: 'movie', title: 'smoke-Filme', genre: 'Drama', video_url: 'https://youtu.be/aqz-KE-bpKQ' },
  });
  expect(created.status()).toBe(201);

  // login com alert nativo
  let dialogText = '';
  page.on('dialog', async (d) => { dialogText = d.message(); await d.accept(); });
  await page.goto(`${BASE}/login.html`);
  await page.getByTestId('login-email').fill('user@kathflix.com');
  await page.getByTestId('login-password').fill('user123');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/home\.html/);
  expect(dialogText).toBe('Bem-vindo ao KathFlix, Usuário Teste!');

  // banner pós-login
  await expect(page.getByTestId('promo-text')).toHaveText('Novo episódio disponível! Deseja ver agora?');
  await page.getByTestId('promo-dismiss').click();
  await expect(page.getByTestId('promo-banner')).toBeHidden();

  // título criado via API aparece; favoritar (id duplicado: só CSS)
  const card = page.getByTestId(/catalog-card-/).filter({ hasText: 'smoke-Filme' });
  await expect(card).toBeVisible();
  await card.locator('#fav-toggle').click();
  await expect(page.getByTestId('section-favorites').getByText('smoke-Filme')).toBeVisible();

  // dropdown de categoria
  await page.getByTestId('category-select').selectOption('Animação');
  await expect(page.getByTestId(/catalog-card-/).first()).toBeVisible();

  // perfil
  await page.getByTestId('nav-profile').click();
  await page.getByTestId('profile-bio').fill('bio do smoke');
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('profile-message')).toHaveText('Perfil atualizado com sucesso');

  // usuário comum não acessa admin
  await page.goto(`${BASE}/admin.html`);
  await expect(page).toHaveURL(/home\.html/);

  // admin: remover o título com modal
  await page.getByTestId('nav-logout').click();
  await page.goto(`${BASE}/login.html?alerts=off`);
  await page.getByTestId('login-email').fill('admin@kathflix.com');
  await page.getByTestId('login-password').fill('admin123');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('nav-admin').click();
  const row = page.locator('tr', { hasText: 'smoke-Filme' });
  await row.locator('#remove-btn').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('admin-message')).toContainText('removido');
  await expect(row).toHaveCount(0);
});
```

**Step 4: Rodar**

```bash
cd automation && npx playwright test <caminho>/smoke.spec.ts --project=chromium --reporter=list
```
Expected: 1 passed. Se falhar, corrigir o frontend (não o teste, salvo erro do próprio script) e repetir.

**Step 5: Encerrar o servidor e limpar**

Parar o processo em background e remover qualquer cópia temporária do script de dentro de `automation/`. Conferir `git status` (nada novo além do esperado).

---

### Task 17: Coleção Postman e exemplo de hooks (setup/teardown)

**Files:** `kathflix/postman/KathFlix.postman_collection.json`, `kathflix/examples/api-client.ts`

**Step 1: Coleção Postman** (Collection v2.1; variáveis `baseUrl` e `token`)

```json
{
  "info": {
    "name": "KathFlix API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "description": "Rode primeiro 'Auth / Login (admin)': o script grava o token em {{token}}. As demais requisições usam esse token."
  },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:3000" },
    { "key": "token", "value": "" },
    { "key": "titleId", "value": "" },
    { "key": "userId", "value": "" }
  ],
  "auth": { "type": "bearer", "bearer": [{ "key": "token", "value": "{{token}}", "type": "string" }] },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Login (admin)",
          "event": [{ "listen": "test", "script": { "type": "text/javascript", "exec": ["pm.collectionVariables.set('token', pm.response.json().token);"] } }],
          "request": { "auth": { "type": "noauth" }, "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/auth/login", "body": { "mode": "raw", "raw": "{\n  \"email\": \"admin@kathflix.com\",\n  \"password\": \"admin123\"\n}" } }
        },
        {
          "name": "Login (user)",
          "event": [{ "listen": "test", "script": { "type": "text/javascript", "exec": ["pm.collectionVariables.set('token', pm.response.json().token);"] } }],
          "request": { "auth": { "type": "noauth" }, "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/auth/login", "body": { "mode": "raw", "raw": "{\n  \"email\": \"user@kathflix.com\",\n  \"password\": \"user123\"\n}" } }
        },
        {
          "name": "Register",
          "request": { "auth": { "type": "noauth" }, "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/auth/register", "body": { "mode": "raw", "raw": "{\n  \"name\": \"Maria\",\n  \"email\": \"maria@teste.com\",\n  \"password\": \"senha123\"\n}" } }
        },
        { "name": "Logout", "request": { "method": "POST", "url": "{{baseUrl}}/api/auth/logout" } }
      ]
    },
    {
      "name": "Catálogo e favoritos",
      "item": [
        { "name": "Listar títulos", "request": { "method": "GET", "url": { "raw": "{{baseUrl}}/api/titles?sort=az", "host": ["{{baseUrl}}"], "path": ["api", "titles"], "query": [{ "key": "sort", "value": "az" }, { "key": "genre", "value": "", "disabled": true }, { "key": "q", "value": "", "disabled": true }] } } },
        { "name": "Detalhe do título", "request": { "method": "GET", "url": "{{baseUrl}}/api/titles/{{titleId}}" } },
        { "name": "Listar favoritos", "request": { "method": "GET", "url": "{{baseUrl}}/api/favorites" } },
        { "name": "Favoritar", "request": { "method": "POST", "url": "{{baseUrl}}/api/favorites/{{titleId}}" } },
        { "name": "Desfavoritar", "request": { "method": "DELETE", "url": "{{baseUrl}}/api/favorites/{{titleId}}" } }
      ]
    },
    {
      "name": "Perfil",
      "item": [
        { "name": "Meus dados", "request": { "method": "GET", "url": "{{baseUrl}}/api/me" } },
        { "name": "Atualizar perfil", "request": { "method": "PUT", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/me", "body": { "mode": "raw", "raw": "{\n  \"name\": \"Maria Souza\",\n  \"bio\": \"Fã de séries\"\n}" } } }
      ]
    },
    {
      "name": "Admin (use o token do admin)",
      "item": [
        {
          "name": "Criar filme (JSON + cover_url)",
          "event": [{ "listen": "test", "script": { "type": "text/javascript", "exec": ["pm.collectionVariables.set('titleId', pm.response.json().id);"] } }],
          "request": { "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/admin/titles", "body": { "mode": "raw", "raw": "{\n  \"type\": \"movie\",\n  \"title\": \"Meu Filme\",\n  \"genre\": \"Drama\",\n  \"year\": 2024,\n  \"video_url\": \"https://youtu.be/aqz-KE-bpKQ\",\n  \"cover_url\": \"https://picsum.photos/300/450\"\n}" } }
        },
        {
          "name": "Criar filme (multipart + imagem)",
          "request": { "method": "POST", "url": "{{baseUrl}}/api/admin/titles", "body": { "mode": "formdata", "formdata": [{ "key": "type", "value": "movie", "type": "text" }, { "key": "title", "value": "Filme com arquivo", "type": "text" }, { "key": "genre", "value": "Ação", "type": "text" }, { "key": "video_url", "value": "https://youtu.be/aqz-KE-bpKQ", "type": "text" }, { "key": "cover", "type": "file", "src": [] }] } }
        },
        {
          "name": "Criar série",
          "event": [{ "listen": "test", "script": { "type": "text/javascript", "exec": ["pm.collectionVariables.set('titleId', pm.response.json().id);"] } }],
          "request": { "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/admin/titles", "body": { "mode": "raw", "raw": "{\n  \"type\": \"series\",\n  \"title\": \"Minha Série\",\n  \"genre\": \"Ação\",\n  \"episodes\": [\n    { \"season\": 1, \"number\": 1, \"name\": \"Piloto\", \"video_url\": \"https://www.youtube.com/watch?v=aqz-KE-bpKQ\" },\n    { \"season\": 1, \"number\": 2, \"name\": \"Segundo\", \"video_url\": \"https://www.youtube.com/watch?v=eRsGyueVLvQ\" }\n  ]\n}" } }
        },
        { "name": "Remover título", "request": { "method": "DELETE", "url": "{{baseUrl}}/api/admin/titles/{{titleId}}" } },
        { "name": "Listar usuários ativos", "request": { "method": "GET", "url": "{{baseUrl}}/api/admin/users" } },
        { "name": "Listar todos os usuários", "request": { "method": "GET", "url": "{{baseUrl}}/api/admin/users?all=true" } },
        {
          "name": "Criar usuário",
          "event": [{ "listen": "test", "script": { "type": "text/javascript", "exec": ["pm.collectionVariables.set('userId', pm.response.json().id);"] } }],
          "request": { "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/admin/users", "body": { "mode": "raw", "raw": "{\n  \"name\": \"Novo Usuário\",\n  \"email\": \"novo@teste.com\",\n  \"password\": \"abc123\",\n  \"role\": \"user\"\n}" } }
        },
        { "name": "Remover usuário", "request": { "method": "DELETE", "url": "{{baseUrl}}/api/admin/users/{{userId}}" } }
      ]
    },
    {
      "name": "Apoio a testes (sem token)",
      "item": [
        { "name": "Reset", "request": { "auth": { "type": "noauth" }, "method": "POST", "url": "{{baseUrl}}/api/test/reset" } },
        { "name": "Seed em lote", "request": { "auth": { "type": "noauth" }, "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/test/seed", "body": { "mode": "raw", "raw": "{\n  \"users\": [{ \"name\": \"QA Um\", \"email\": \"qa-um@teste.com\", \"password\": \"abc123\" }],\n  \"titles\": [{ \"type\": \"movie\", \"title\": \"qa-Filme\", \"genre\": \"Drama\", \"video_url\": \"https://youtu.be/aqz-KE-bpKQ\" }]\n}" } } },
        { "name": "Cleanup por prefixo", "request": { "auth": { "type": "noauth" }, "method": "DELETE", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": "{{baseUrl}}/api/test/cleanup", "body": { "mode": "raw", "raw": "{ \"prefix\": \"qa-\" }" } } }
      ]
    }
  ]
}
```

**Step 2: Validar o JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('kathflix/postman/KathFlix.postman_collection.json','utf8')); console.log('ok')"
```
Expected: `ok`

**Step 3: `examples/api-client.ts`**

```ts
/**
 * Cliente de API do KathFlix para usar em hooks do Playwright (setup/teardown).
 * Exige Node 18+ (fetch global). Ajuste BASE se a app não estiver em localhost:3000.
 *
 * Exemplo de uso em um teste:
 *
 *   import { test } from '@playwright/test';
 *   import { KathflixApi } from '../examples/api-client';
 *
 *   const api = new KathflixApi();
 *   test.beforeEach(async () => {
 *     await api.seed({ users: [{ name: 'QA', email: 'qa-ana@teste.com', password: 'abc123' }] });
 *   });
 *   test.afterEach(async () => {
 *     await api.cleanup('qa-');
 *   });
 */
const BASE = process.env.KATHFLIX_URL ?? 'http://localhost:3000';

type Json = Record<string, unknown>;

export class KathflixApi {
  constructor(private base: string = BASE) {}

  private async request<T = any>(method: string, path: string, opts: { token?: string; json?: Json } = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.json) headers['Content-Type'] = 'application/json';
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: opts.json ? JSON.stringify(opts.json) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.error ?? 'erro'}`);
    return data as T;
  }

  /** Volta o banco ao estado inicial (usuários e títulos do seed). */
  reset() { return this.request('POST', '/api/test/reset'); }

  /** Cria usuários e títulos em lote, sem autenticação. */
  seed(data: { users?: Json[]; titles?: Json[] }) { return this.request('POST', '/api/test/seed', { json: data }); }

  /** Teardown: remove usuários (e-mail) e títulos (nome) que começam com o prefixo (mínimo 3 caracteres). */
  cleanup(prefix: string) { return this.request('DELETE', '/api/test/cleanup', { json: { prefix } }); }

  async login(email: string, password: string): Promise<string> {
    const r = await this.request<{ token: string }>('POST', '/api/auth/login', { json: { email, password } });
    return r.token;
  }

  loginAdmin() { return this.login('admin@kathflix.com', 'admin123'); }

  createUser(adminToken: string, user: Json) { return this.request('POST', '/api/admin/users', { token: adminToken, json: user }); }
  deleteUser(adminToken: string, id: number) { return this.request('DELETE', `/api/admin/users/${id}`, { token: adminToken }); }
  createTitle(adminToken: string, title: Json) { return this.request('POST', '/api/admin/titles', { token: adminToken, json: title }); }
  deleteTitle(adminToken: string, id: number) { return this.request('DELETE', `/api/admin/titles/${id}`, { token: adminToken }); }
  favorite(token: string, titleId: number) { return this.request('POST', `/api/favorites/${titleId}`, { token }); }
}
```

**Step 4: Commit**

```bash
git add kathflix && git commit -m "docs(kathflix): postman collection and API client example for hooks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 18: README, verificação final e push

**Files:** Create `README.md` (raiz), `kathflix/README.md`

**Step 1: `README.md` da raiz**

```markdown
# Playwright Netflix Training

Material de treinamento de automação com Playwright.

| Pasta | O que é |
|---|---|
| `kathflix/` | App **KathFlix** (frontend + API) usada como alvo dos testes. |
| `automation/` | Projeto Playwright **de exemplo** (Page Objects, specs, helper de API). Aponta para o saucedemo e serve de referência de estilo para automatizar o KathFlix. |
| `docs/plans/` | Design e plano de implementação do KathFlix. |

Comece por `kathflix/README.md`.
```

**Step 2: `kathflix/README.md`**

```markdown
# KathFlix

App estilo Netflix para treinos de automação. Tudo que a tela faz também é possível via API (setup/teardown com hooks).

## Como subir
    cd kathflix
    npm install
    npm start

- App: http://localhost:3000
- Swagger (API): http://localhost:3000/api-docs
- Requer Node 22.13+ (usa `node:sqlite`). O aviso "ExperimentalWarning: SQLite" é esperado.

Variáveis: `PORT` (3000), `KATHFLIX_DB` (arquivo SQLite; `:memory:` para base descartável), `KATHFLIX_TEST_API=off` (desliga `/api/test/*`).

## Usuários do seed
| Papel | E-mail | Senha |
|---|---|---|
| admin | admin@kathflix.com | admin123 |
| user | user@kathflix.com | user123 |

## Telas
`/login.html`, `/register.html`, `/home.html`, `/watch.html?id=`, `/profile.html`, `/admin.html` (só admin).

Dica: `/login.html?alerts=off` desliga o alert nativo e o banner pós-login (`?alerts=on` religa).

## Para a turma
- Elementos têm `data-testid` e `id` estáveis (`getByTestId`, `getByRole`, `getByLabel`).
- Desafios propositais: `id="remove-btn"` repetido nas tabelas do admin, `id="fav-toggle"` repetido nos cards (só CSS/XPath), banner de destaque e rodapé sem `data-testid`, skeleton de carregamento, modal de confirmação, iframe do YouTube, dropdowns, alert nativo e banner pós-login.

## API para setup e teardown
- Documentação: Swagger em `/api-docs` e coleção Postman em `postman/`.
- Exemplo em TypeScript: `examples/api-client.ts` (`seed`, `cleanup`, `reset`, login, criação de títulos e usuários).
- Rotas `/api/test/*` não exigem token: `reset`, `seed` e `cleanup` por prefixo.

## Testes da API
    npm test

## Aviso
App de treino: senhas com hash, mas sem HTTPS, sem rate limit e com rotas de teste abertas. Não use em produção.
```

**Step 3: Verificação final**

```bash
cd kathflix && npm test
```
Expected: todos os testes PASS (health, db, auth, titles, favorites, me, admin, test-support, openapi), 0 falhas.

Rodar o smoke da Task 16 novamente contra a versão final. Expected: 1 passed.

**Step 4: Commit e push**

```bash
cd .. && git add -A && git commit -m "docs: add READMEs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git status --short
git log --oneline
git push -u origin main
```
Expected: `git status` limpo; `git log` mostra os commits das Tasks 1 a 18; push para `https://github.com/DavidBrandao/Playwright_Netflix_Training.git` concluído.

Se o push pedir autenticação, o usuário deve rodar `! git push -u origin main` no prompt para usar as credenciais dele.
