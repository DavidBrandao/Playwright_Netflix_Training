(function () {
  const TOKEN_KEY = 'kathflix.token';
  const USER_KEY = 'kathflix.user';

  const KF = {
    getToken: () => localStorage.getItem(TOKEN_KEY),
    getUser() {
      try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    },
    setSession(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    setUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user)); },
    clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },

    async api(path, { method = 'GET', json, form } = {}) {
      const headers = {};
      const token = KF.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      let body;
      if (form) body = form;
      else if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
      const res = await fetch(`/api${path}`, { method, headers, body });
      if (res.status === 204) return null;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && token && !path.startsWith('/auth/login')) {
          KF.clearSession();
          location.href = '/login.html';
        }
        throw new Error(data.error || `Erro ${res.status}`);
      }
      return data;
    },

    requireAuth() {
      const user = KF.getUser();
      if (!KF.getToken() || !user) { location.href = '/login.html'; throw new Error('redirect'); }
      return user;
    },

    alertsEnabled() {
      const q = new URLSearchParams(location.search).get('alerts');
      if (q === 'off') return false;
      return localStorage.getItem('kathflix.alerts') !== 'off';
    },

    youtubeEmbed(url) {
      const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      return m ? `https://www.youtube.com/embed/${m[1]}` : '';
    },

    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    show(el, text) { el.textContent = text; el.hidden = false; },

    renderNav(active) {
      const user = KF.getUser();
      const el = document.getElementById('nav');
      el.innerHTML = `
        <header class="nav">
          <a class="logo" href="/home.html" id="nav-logo" data-testid="nav-logo">KATHFLIX</a>
          <nav>
            <a href="/home.html" id="nav-home" data-testid="nav-home" class="${active === 'home' ? 'active' : ''}">Início</a>
            <a href="/profile.html" id="nav-profile" data-testid="nav-profile" class="${active === 'profile' ? 'active' : ''}">Perfil</a>
            ${user.role === 'admin' ? `<a href="/admin.html" id="nav-admin" data-testid="nav-admin" class="${active === 'admin' ? 'active' : ''}">Admin</a>` : ''}
          </nav>
          <span id="nav-username" data-testid="nav-username">${KF.esc(user.name)}</span>
          <button type="button" id="nav-logout" data-testid="nav-logout" class="secondary">Sair</button>
        </header>`;
      document.getElementById('nav-logout').addEventListener('click', async () => {
        try { await KF.api('/auth/logout', { method: 'POST' }); } catch { /* sessão já inválida */ }
        KF.clearSession();
        location.href = '/login.html';
      });
    },

    renderFooter() {
      const f = document.createElement('footer');
      f.className = 'site-footer';
      f.textContent = '© KathFlix — projeto de treinamento de automação';
      document.body.appendChild(f);
    },
  };

  window.KF = KF;
})();
