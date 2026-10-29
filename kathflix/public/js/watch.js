(function () {
  KF.requireAuth();
  KF.renderNav('home');
  KF.renderFooter();

  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get('id');
  let title;

  function play(url) { $('player').src = KF.youtubeEmbed(url); }

  function renderFav() {
    $('watch-favorite').textContent = title.favorite ? '★ Remover dos favoritos' : '☆ Adicionar aos favoritos';
    $('watch-favorite').setAttribute('aria-pressed', String(title.favorite));
  }

  async function init() {
    try {
      title = await KF.api(`/titles/${encodeURIComponent(id)}`);
    } catch (ex) {
      return KF.show($('watch-error'), ex.message);
    }
    $('watch-title').textContent = title.title;
    $('watch-meta').textContent = `${title.type === 'series' ? 'Série' : 'Filme'} · ${title.genre}${title.year ? ' · ' + title.year : ''}`;
    $('watch-description').textContent = title.description;
    renderFav();

    if (title.type === 'series') {
      const box = $('episodes');
      box.hidden = false;
      title.episodes.forEach((ep, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary';
        b.dataset.testid = `episode-${ep.season}-${ep.number}`;
        b.textContent = `T${ep.season}E${ep.number} · ${ep.name}`;
        b.addEventListener('click', () => {
          box.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
          play(ep.video_url);
        });
        box.appendChild(b);
        if (i === 0) b.click();
      });
    } else {
      play(title.video_url);
    }
  }

  $('watch-favorite').addEventListener('click', async () => {
    await KF.api(`/favorites/${title.id}`, { method: title.favorite ? 'DELETE' : 'POST' });
    title.favorite = !title.favorite;
    renderFav();
  });

  init();
})();
