const express = require('express');
const { httpError } = require('../errors');
const { createUser, validateUserInput } = require('../users-service');
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
  if (!Array.isArray(users) || !Array.isArray(titles)) throw httpError(400, 'users e titles devem ser arrays');
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  if (![...users, ...titles].every(isObj)) throw httpError(400, 'users e titles devem conter objetos');
  users.forEach((u) => validateUserInput(u));
  const parsed = titles.map((t) => parseTitleInput(t, null));
  let createdUsers;
  let createdTitles;
  db.exec('BEGIN');
  try {
    createdUsers = users.map((u) => {
      const row = createUser(db, u);
      return { id: row.id, email: row.email };
    });
    createdTitles = parsed.map((p, i) => ({ id: insertTitle(db, p), title: titles[i].title }));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.status(201).json({ users: createdUsers, titles: createdTitles });
});

router.delete('/cleanup', (req, res) => {
  const prefix = String((req.body && req.body.prefix) || req.query.prefix || '').replace(/[%_]/g, '');
  if (prefix.length < 3) throw httpError(400, 'prefix deve ter ao menos 3 caracteres');
  const db = req.app.locals.db;
  const like = `${prefix}%`;
  const users = db.prepare("DELETE FROM users WHERE email LIKE ? AND email NOT IN ('admin@kathflix.com','user@kathflix.com')").run(like);
  const titles = db.prepare('DELETE FROM titles WHERE title LIKE ?').run(like);
  res.json({ users: users.changes, titles: titles.changes });
});

module.exports = router;
