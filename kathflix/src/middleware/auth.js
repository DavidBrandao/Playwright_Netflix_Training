const { httpError } = require('../errors');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next(httpError(401, 'Token ausente'));
  const db = req.app.locals.db;
  const user = db
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .get(token);
  if (!user) return next(httpError(401, 'Token inválido ou expirado'));
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?').run(Date.now(), token);
  req.user = user;
  req.token = token;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return next(httpError(403, 'Acesso restrito a administradores'));
  next();
}

module.exports = { auth, requireAdmin };
