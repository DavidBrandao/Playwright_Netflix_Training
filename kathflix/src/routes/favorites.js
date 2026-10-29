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
