const { httpError } = require('./errors');
const { GENRES, DEFAULT_COVER, youtubeId } = require('./util');

const truthy = (v) => v === true || v === 'true' || v === '1' || v === 1;

function parseTitleInput(body, coverFromFile) {
  const { type } = body;
  if (!['movie', 'series'].includes(type)) throw httpError(400, 'type deve ser movie ou series');
  const title = String(body.title || '').trim();
  if (!title) throw httpError(400, 'title é obrigatório');
  if (!GENRES.includes(body.genre)) throw httpError(400, `genre inválido. Use: ${GENRES.join(', ')}`);
  const year = body.year === undefined || body.year === null || String(body.year).trim() === '' ? null : Number(body.year);
  if (year !== null && !Number.isInteger(year)) throw httpError(400, 'year deve ser um número inteiro');
  if (year !== null && (year < 1888 || year > 2100)) throw httpError(400, 'year deve estar entre 1888 e 2100');

  const out = {
    type,
    title,
    description: String(body.description || '').trim(),
    year,
    genre: body.genre,
    cover_url: coverFromFile || String(body.cover_url || '').trim() || DEFAULT_COVER,
    is_new: body.is_new === undefined ? 1 : truthy(body.is_new) ? 1 : 0,
    video_url: null,
    episodes: [],
  };

  if (type === 'movie') {
    if (!youtubeId(body.video_url)) throw httpError(400, 'video_url deve ser um link do YouTube');
    out.video_url = body.video_url;
  } else {
    let eps = body.episodes;
    if (typeof eps === 'string') {
      try { eps = JSON.parse(eps); } catch { throw httpError(400, 'episodes deve ser um JSON válido'); }
    }
    if (!Array.isArray(eps) || eps.length === 0) throw httpError(400, 'série precisa de ao menos um episódio');
    out.episodes = eps.map((e, i) => {
      if (!youtubeId(e && e.video_url)) throw httpError(400, `episódio ${i + 1}: video_url deve ser um link do YouTube`);
      return {
        season: Number(e.season) || 1,
        number: Number(e.number) || i + 1,
        name: String(e.name || `Episódio ${i + 1}`),
        video_url: e.video_url,
      };
    });
  }
  return out;
}

function insertTitle(db, t) {
  const r = db
    .prepare(
      'INSERT INTO titles (type,title,description,year,genre,cover_url,video_url,is_new,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
    )
    .run(t.type, t.title, t.description, t.year, t.genre, t.cover_url, t.video_url, t.is_new, t.created_at || Date.now());
  const id = Number(r.lastInsertRowid);
  const ins = db.prepare('INSERT INTO episodes (title_id,season,number,name,video_url) VALUES (?,?,?,?,?)');
  for (const e of t.episodes) ins.run(id, e.season, e.number, e.name, e.video_url);
  return id;
}

function presentTitle(row, { favorites, episodes } = {}) {
  const t = { ...row, is_new: !!row.is_new };
  if (favorites) t.favorite = favorites.has(row.id);
  if (episodes) t.episodes = episodes;
  return t;
}

module.exports = { parseTitleInput, insertTitle, presentTitle };
