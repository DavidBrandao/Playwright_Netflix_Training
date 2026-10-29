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
