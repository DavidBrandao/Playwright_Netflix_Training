const express = require('express');
const { httpError } = require('../errors');

const TOTAL = 5;
const router = express.Router();

function state(db, userId) {
  const found = db.prepare('SELECT cat FROM lucky_cats WHERE user_id=? ORDER BY cat').all(userId).map((r) => r.cat);
  return { total: TOTAL, found, complete: found.length === TOTAL };
}

router.get('/', (req, res) => res.json(state(req.app.locals.db, req.user.id)));

router.post('/:cat', (req, res) => {
  const db = req.app.locals.db;
  const cat = Number(req.params.cat);
  if (!Number.isInteger(cat) || cat < 1 || cat > TOTAL) throw httpError(400, `cat deve ser um inteiro de 1 a ${TOTAL}`);
  const r = db.prepare('INSERT OR IGNORE INTO lucky_cats (user_id,cat,found_at) VALUES (?,?,?)').run(req.user.id, cat, Date.now());
  const newlyFound = r.changes === 1;
  res.status(newlyFound ? 201 : 200).json({ cat, newlyFound, ...state(db, req.user.id) });
});

router.delete('/', (req, res) => {
  req.app.locals.db.prepare('DELETE FROM lucky_cats WHERE user_id=?').run(req.user.id);
  res.status(204).end();
});

module.exports = router;
