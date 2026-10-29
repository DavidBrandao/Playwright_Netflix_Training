const express = require('express');
const { httpError } = require('../errors');

// Cada papel tem os seus gatos: o usuário comum só alcança os bugs de login/perfil, o admin os do painel.
const CATS_BY_ROLE = { user: [1, 2, 3], admin: [4, 5] };
const catsFor = (role) => CATS_BY_ROLE[role] || CATS_BY_ROLE.user;

const router = express.Router();

function state(db, user) {
  const cats = catsFor(user.role);
  const found = db.prepare('SELECT cat FROM lucky_cats WHERE user_id=? ORDER BY cat').all(user.id).map((r) => r.cat).filter((n) => cats.includes(n));
  return { total: cats.length, cats, found, complete: found.length === cats.length };
}

router.get('/', (req, res) => res.json(state(req.app.locals.db, req.user)));

router.post('/:cat', (req, res) => {
  const db = req.app.locals.db;
  const cat = Number(req.params.cat);
  const cats = catsFor(req.user.role);
  if (!Number.isInteger(cat) || !cats.includes(cat)) throw httpError(400, `cat deve ser um destes números: ${cats.join(', ')}`);
  const r = db.prepare('INSERT OR IGNORE INTO lucky_cats (user_id,cat,found_at) VALUES (?,?,?)').run(req.user.id, cat, Date.now());
  const newlyFound = r.changes === 1;
  res.status(newlyFound ? 201 : 200).json({ cat, newlyFound, ...state(db, req.user) });
});

router.delete('/', (req, res) => {
  req.app.locals.db.prepare('DELETE FROM lucky_cats WHERE user_id=?').run(req.user.id);
  res.status(204).end();
});

module.exports = router;
