const express = require('express');
const { auth } = require('../middleware/auth');
const { makeUpload, discardFileOnError } = require('../upload');
const { publicUser, validateUserInput, emailTaken, bcrypt } = require('../users-service');
const { httpError } = require('../errors');

module.exports = function meRouter(uploadDir) {
  const router = express.Router();
  const upload = makeUpload(uploadDir);
  router.use(auth);
  router.use('/cats', require('./cats'));

  router.get('/', (req, res) => res.json(publicUser(req.user)));

  router.put('/', upload.single('avatar'), discardFileOnError((req, res) => {
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
  }));

  router.delete('/', (req, res) => {
    req.app.locals.db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
    res.status(204).end();
  });

  return router;
};
