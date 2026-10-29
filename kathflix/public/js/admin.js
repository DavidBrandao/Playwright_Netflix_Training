(function () {
  const me = KF.requireAuth();
  if (me.role !== 'admin') { location.href = '/home.html'; return; }
  KF.renderNav('admin');
  KF.renderFooter();

  const $ = (id) => document.getElementById(id);
  const msg = $('admin-message');
  const say = (text, kind) => { msg.className = `msg ${kind}`; KF.show(msg, text); };

  function showTab(name) {
    $('panel-titles').hidden = name !== 'titles';
    $('panel-users').hidden = name !== 'users';
    $('tab-titles').setAttribute('aria-selected', String(name === 'titles'));
    $('tab-users').setAttribute('aria-selected', String(name === 'users'));
    $('tab-titles').className = name === 'titles' ? '' : 'secondary';
    $('tab-users').className = name === 'users' ? '' : 'secondary';
    msg.hidden = true;
    if (name === 'users') loadUsers();
  }
  $('tab-titles').addEventListener('click', () => showTab('titles'));
  $('tab-users').addEventListener('click', () => showTab('users'));

  function confirmRemove(text) {
    return new Promise((resolve) => {
      $('confirm-text').textContent = text;
      $('confirm-modal').hidden = false;
      const done = (v) => { $('confirm-modal').hidden = true; resolve(v); };
      $('confirm-ok').onclick = () => done(true);
      $('confirm-cancel').onclick = () => done(false);
    });
  }

  // ---- títulos ----
  function addEpisodeRow() {
    const n = $('episode-list').children.length + 1;
    const row = document.createElement('div');
    row.className = 'episode-row';
    row.dataset.testid = 'episode-row';
    row.innerHTML = `
      <input name="ep-name" type="text" placeholder="Nome do episódio" aria-label="Nome do episódio ${n}" value="Episódio ${n}">
      <input name="ep-url" type="url" placeholder="Link do YouTube" aria-label="Link do episódio ${n}">`;
    $('episode-list').appendChild(row);
  }

  function syncType() {
    const series = $('title-type').value === 'series';
    $('movie-fields').hidden = series;
    $('series-fields').hidden = !series;
    if (series && !$('episode-list').children.length) addEpisodeRow();
  }
  $('title-type').addEventListener('change', syncType);
  $('add-episode').addEventListener('click', addEpisodeRow);

  async function loadTitles() {
    const titles = await KF.api('/titles?sort=recent');
    $('titles-body').innerHTML = titles.map((t) => `
      <tr data-testid="title-row-${t.id}" data-id="${t.id}" data-name="${KF.esc(t.title)}">
        <td>${KF.esc(t.title)}</td><td>${t.type === 'series' ? 'Série' : 'Filme'}</td>
        <td>${KF.esc(t.genre)}</td><td>${t.year ?? ''}</td>
        <td><button type="button" id="remove-btn" class="danger">Remover</button></td>
      </tr>`).join('');
  }

  $('titles-body').addEventListener('click', async (e) => {
    if (!e.target.closest('#remove-btn')) return;
    const tr = e.target.closest('tr');
    if (!(await confirmRemove(`Remover "${tr.dataset.name}" do catálogo?`))) return;
    try {
      await KF.api(`/admin/titles/${tr.dataset.id}`, { method: 'DELETE' });
      say(`Título "${tr.dataset.name}" removido`, 'success');
      loadTitles();
    } catch (ex) { say(ex.message, 'error'); }
  });

  $('title-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.hidden = true;
    const form = new FormData();
    const type = $('title-type').value;
    form.append('type', type);
    form.append('title', $('title-name').value.trim());
    form.append('genre', $('title-genre').value);
    form.append('description', $('title-description').value);
    const year = $('title-year').value.trim();
    if (year) form.append('year', year);
    // bug 5: ano escrito em texto
    if (year && !/^\d+$/.test(year)) KF.cats.find(5);
    const file = $('title-cover-file').files[0];
    if (file) form.append('cover', file);
    else if ($('title-cover-url').value.trim()) form.append('cover_url', $('title-cover-url').value.trim());
    if (type === 'movie') {
      form.append('video_url', $('title-video-url').value.trim());
    } else {
      const eps = [...$('episode-list').children].map((row, i) => ({
        season: 1,
        number: i + 1,
        name: row.querySelector('[name=ep-name]').value.trim(),
        video_url: row.querySelector('[name=ep-url]').value.trim(),
      }));
      form.append('episodes', JSON.stringify(eps));
      if (eps.length > 3) KF.cats.find(5); // bug 5: série com mais de 3 episódios
    }
    try {
      const t = await KF.api('/admin/titles', { method: 'POST', form });
      say(`Título "${t.title}" adicionado com sucesso`, 'success');
      $('title-form').reset();
      $('episode-list').innerHTML = '';
      syncType();
      loadTitles();
    } catch (ex) { say(ex.message, 'error'); }
  });

  // ---- usuários ----
  async function loadUsers() {
    const users = await KF.api(`/admin/users${$('show-all-users').checked ? '?all=true' : ''}`);
    $('users-body').innerHTML = users.map((u) => `
      <tr data-testid="user-row-${u.id}" data-id="${u.id}" data-name="${KF.esc(u.name)}">
        <td>${KF.esc(u.name)}</td><td>${KF.esc(u.email)}</td><td>${u.role}</td>
        <td>${u.last_seen_at ? new Date(u.last_seen_at).toLocaleString('pt-BR') : '-'}</td>
        <td><button type="button" id="remove-btn" class="danger" ${u.id === me.id ? 'disabled' : ''}>Remover</button></td>
      </tr>`).join('');
  }
  // bug 4: marcar/desmarcar "Mostrar todos" 10 vezes seguidas (qualquer outro clique zera a contagem)
  let showAllToggles = 0;
  document.addEventListener('click', (e) => { if (!e.target.closest('#show-all-label')) showAllToggles = 0; });
  $('show-all-users').addEventListener('change', () => {
    showAllToggles += 1;
    if (showAllToggles === 10) { showAllToggles = 0; KF.cats.find(4); }
    loadUsers();
  });

  $('users-body').addEventListener('click', async (e) => {
    if (!e.target.closest('#remove-btn')) return;
    const tr = e.target.closest('tr');
    if (!(await confirmRemove(`Remover o usuário "${tr.dataset.name}"?`))) return;
    try {
      await KF.api(`/admin/users/${tr.dataset.id}`, { method: 'DELETE' });
      say(`Usuário "${tr.dataset.name}" removido`, 'success');
      loadUsers();
    } catch (ex) { say(ex.message, 'error'); }
  });

  syncType();
  loadTitles();
})();
