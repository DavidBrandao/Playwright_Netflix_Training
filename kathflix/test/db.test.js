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
