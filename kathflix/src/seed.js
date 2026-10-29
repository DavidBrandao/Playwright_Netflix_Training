const { createUser } = require('./users-service');
const { insertTitle } = require('./titles-service');
const { DEFAULT_COVER } = require('./util');

const yt = (id) => `https://www.youtube.com/watch?v=${id}`;

const TITLES = [
  { type: 'movie', title: 'Big Buck Bunny', genre: 'Animação', year: 2008, is_new: 1, video_url: yt('aqz-KE-bpKQ'), description: 'Um coelho gigante enfrenta três roedores travessos.' },
  { type: 'movie', title: 'Sintel', genre: 'Animação', year: 2010, is_new: 1, video_url: yt('eRsGyueVLvQ'), description: 'Uma jovem procura seu dragão.' },
  { type: 'movie', title: 'Tears of Steel', genre: 'Ficção', year: 2012, is_new: 0, video_url: yt('R6MlUcmOul8'), description: 'Guerreiros e cientistas tentam salvar o mundo de robôs.' },
  { type: 'movie', title: 'Elephants Dream', genre: 'Ficção', year: 2006, is_new: 0, video_url: yt('TLkA0RELQ1g'), description: 'Dois personagens exploram uma máquina surreal.' },
  { type: 'movie', title: 'Me at the zoo', genre: 'Documentário', year: 2005, is_new: 0, video_url: yt('jNQXAC9IVRw'), description: 'O primeiro vídeo do YouTube.' },
  {
    type: 'series', title: 'Aventuras Open Source', genre: 'Ação', year: 2024, is_new: 1, video_url: null,
    description: 'Uma série em três episódios com curtas abertos.',
    episodes: [
      { season: 1, number: 1, name: 'O Coelho', video_url: yt('aqz-KE-bpKQ') },
      { season: 1, number: 2, name: 'O Dragão', video_url: yt('eRsGyueVLvQ') },
      { season: 1, number: 3, name: 'O Aço', video_url: yt('R6MlUcmOul8') },
    ],
  },
];

function seedAll(db) {
  createUser(db, { name: 'Admin', email: 'admin@kathflix.com', password: 'admin123', role: 'admin' });
  createUser(db, { name: 'Usuário Teste', email: 'user@kathflix.com', password: 'user123', role: 'user' });
  const base = Date.now();
  TITLES.forEach((t, i) =>
    insertTitle(db, { ...t, cover_url: DEFAULT_COVER, episodes: t.episodes || [], created_at: base + i })
  );
}

function seedIfEmpty(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) seedAll(db);
}

function resetToSeed(db) {
  for (const t of ['sessions', 'favorites', 'episodes', 'titles', 'users']) db.exec(`DELETE FROM ${t}`);
  seedAll(db);
}

module.exports = { seedIfEmpty, resetToSeed };
