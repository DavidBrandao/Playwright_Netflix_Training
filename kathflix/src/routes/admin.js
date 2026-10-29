const express = require('express');
const { httpError } = require('../errors');
const { auth, requireAdmin } = require('../middleware/auth');
const { makeUpload, discardFileOnError } = require('../upload');
const { createUser, publicUser } = require('../users-service');
const { parseTitleInput, insertTitle, presentTitle } = require('../titles-service');
const { ACTIVE_WINDOW_MS } = require('../util');

module.exports = function adminRouter(uploadDir) {
  const router = express.Router();
  const upload = makeUpload(uploadDir);
  router.use(auth, requireAdmin);

  router.post('/titles', upload.single('cover'), discardFileOnError((req, res) => {
    const db = req.app.locals.db;
    const input = parseTitleInput(req.body || {}, req.file ? `/uploads/${req.file.filename}` : null);
    const id = insertTitle(db, input);
    const row = db.prepare('SELECT * FROM titles WHERE id=?').get(id);
    const episodes = db
      .prepare('SELECT id, season, number, name, video_url FROM episodes WHERE title_id=? ORDER BY season, number')
      .all(id);
    res.status(201).json(presentTitle(row, { episodes }));
  }));

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
