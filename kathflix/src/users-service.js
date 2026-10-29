const bcrypt = require('bcryptjs');
const { httpError } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  const { id, name, email, role, bio, avatar_url, created_at } = row;
  return { id, name, email, role, bio, avatar_url, created_at };
}

function validateUserInput({ name, email, password }, { partial = false } = {}) {
  if (!partial || name !== undefined) {
    if (!String(name || '').trim()) throw httpError(400, 'name é obrigatório');
  }
  if (!partial || email !== undefined) {
    if (!EMAIL_RE.test(String(email || '').trim())) throw httpError(400, 'email inválido');
  }
  if (!partial || password !== undefined) {
    if (String(password || '').length < 6) throw httpError(400, 'password deve ter ao menos 6 caracteres');
  }
}

function emailTaken(db, email, exceptId = 0) {
  return !!db.prepare('SELECT 1 FROM users WHERE lower(email)=lower(?) AND id<>?').get(email, exceptId);
}

function createUser(db, { name, email, password, role = 'user' }) {
  validateUserInput({ name, email, password });
  if (!['user', 'admin'].includes(role)) throw httpError(400, 'role deve ser user ou admin');
  const cleanEmail = String(email).trim().toLowerCase();
  if (emailTaken(db, cleanEmail)) throw httpError(409, 'E-mail já cadastrado');
  const hash = bcrypt.hashSync(String(password), 8);
  const r = db
    .prepare('INSERT INTO users (name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)')
    .run(String(name).trim(), cleanEmail, hash, role, Date.now());
  return db.prepare('SELECT * FROM users WHERE id=?').get(Number(r.lastInsertRowid));
}

module.exports = { publicUser, validateUserInput, emailTaken, createUser, bcrypt };
