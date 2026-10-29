const express = require('express');
const { httpError } = require('../errors');
const { auth } = require('../middleware/auth');
const { presentTitle } = require('../titles-service');

const router = express.Router();
router.use(auth);

const ORDERS = {
  az: 'title COLLATE NOCASE ASC, id DESC',
  year: 'year DESC, id DESC',
  recent: 'created_at DESC, id DESC',
};

function favoriteSet(db, userId) {
  const rows = db.prepare('SELECT title_id FROM favorites WHERE user_id=?').all(userId);
  return new Set(rows.map((r) => r.title_id));
}

router.get('/', (req, res) => {
  const str = (v) => (typeof v === 'string' ? v : undefined);
  const q = str(req.query.q);
  const genre = str(req.query.genre);
  const isNew = str(req.query.new);
  const sort = str(req.query.sort);
  const where = [];
  const params = [];
  if (q) { where.push("title LIKE ? ESCAPE '\\'"); params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); }
  if (genre && genre !== 'Todas') { where.push('genre = ?'); params.push(genre); }
  if (isNew === 'true') where.push('is_new = 1');
  const order = Object.hasOwn(ORDERS, sort) ? ORDERS[sort] : ORDERS.recent;
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
