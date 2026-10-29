const { DatabaseSync } = require('node:sqlite');
const { seedIfEmpty } = require('./seed');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  year INTEGER,
  genre TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  video_url TEXT,
  is_new INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_id INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  season INTEGER NOT NULL DEFAULT 1,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  video_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, title_id)
);
CREATE TABLE IF NOT EXISTS lucky_cats (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cat INTEGER NOT NULL,
  found_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, cat)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at INTEGER NOT NULL
);
`;

function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  seedIfEmpty(db);
  return db;
}

module.exports = { openDb };
