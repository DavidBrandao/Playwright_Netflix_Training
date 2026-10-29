const GENRES = ['Ação', 'Comédia', 'Drama', 'Terror', 'Ficção', 'Animação', 'Documentário'];
const DEFAULT_COVER = '/img/cover-default.svg';
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

function youtubeId(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[&?#].*)?$/
  );
  return m ? m[1] : null;
}

module.exports = { GENRES, DEFAULT_COVER, ACTIVE_WINDOW_MS, youtubeId };
