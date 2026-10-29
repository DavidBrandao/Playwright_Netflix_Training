(function () {
  KF.requireAuth();
  KF.renderNav('home');
  KF.renderFooter();

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let allTitles = [];

  function skeleton(row) {
    row.innerHTML = '<div class="skeleton-card" data-testid="skeleton"></div>'.repeat(5);
  }

  function card(t, prefix) {
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.testid = `${prefix}-card-${t.id}`;
    el.innerHTML = `
      <a href="/watch.html?id=${t.id}">
        <img src="${KF.esc(t.cover_url)}" alt="Capa de ${KF.esc(t.title)}">
        <h3 class="card-title">${KF.esc(t.title)}</h3>
      </a>
      <p class="card-meta">${t.type === 'series' ? 'Série' : 'Filme'} · ${KF.esc(t.genre)}${t.year ? ' · ' + t.year : ''}</p>
      <button type="button" id="fav-toggle" class="fav-btn secondary" aria-pressed="${t.favorite}">${t.favorite ? '★ Favorito' : '☆ Favoritar'}</button>`;
    el.querySelector('#fav-toggle').addEventListener('click', async () => {
      await KF.api(`/favorites/${t.id}`, { method: t.favorite ? 'DELETE' : 'POST' });
      await load(false);
    });
    return el;
  }

  function fill(row, titles, prefix) {
    row.replaceChildren(...titles.map((t) => card(t, prefix)));
  }

  function renderHero() {
    const t = allTitles.find((x) => x.is_new) || allTitles[0];
    $('hero').innerHTML = t
      ? `<h2>${KF.esc(t.title)}</h2><p>${KF.esc(t.description)}</p><div><a class="btn" href="/watch.html?id=${t.id}">Assistir</a></div>`
      : '<h2>KathFlix</h2>';
  }

  async function load(withSkeleton) {
    if (withSkeleton) { ['row-new', 'row-catalog', 'row-fav'].forEach((id) => skeleton($(id))); await sleep(700); }
    const params = new URLSearchParams();
    if ($('search-input').value.trim()) params.set('q', $('search-input').value.trim());
    if ($('category-select').value) params.set('genre', $('category-select').value);
    params.set('sort', $('sort-select').value);
    const [catalog, news, favs] = await Promise.all([
      KF.api(`/titles?${params}`),
      KF.api('/titles?new=true'),
      KF.api('/favorites'),
    ]);
    if (!allTitles.length) { allTitles = news.concat(catalog); renderHero(); }
    fill($('row-new'), news, 'new');
    fill($('row-catalog'), catalog, 'catalog');
    fill($('row-fav'), favs, 'fav');
    $('catalog-empty').hidden = catalog.length > 0;
    $('fav-empty').hidden = favs.length > 0;
  }

  // banner pós-login
  if (KF.alertsEnabled() && sessionStorage.getItem('kathflix.promo')) {
    sessionStorage.removeItem('kathflix.promo');
    $('promo-banner').hidden = false;
  }
  const closeBanner = () => { $('promo-banner').hidden = true; };
  $('promo-dismiss').addEventListener('click', closeBanner);
  $('promo-close').addEventListener('click', closeBanner);
  $('promo-watch').addEventListener('click', async () => {
    const list = await KF.api('/titles');
    const target = list.find((t) => t.type === 'series') || list[0];
    location.href = `/watch.html?id=${target.id}`;
  });

  let timer;
  $('search-input').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(false), 300); });
  $('category-select').addEventListener('change', () => load(false));
  $('sort-select').addEventListener('change', () => load(false));

  load(true);
})();
