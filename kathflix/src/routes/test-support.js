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
