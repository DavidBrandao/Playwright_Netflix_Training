// Gatos da Sorte: 5 bugs escondidos. Cada um mostra um gato; o progresso fica salvo por usuário (API /api/me/cats).
(function () {
  const TOTAL = 5;
  const PENDING_KEY = 'kathflix.pendingCats'; // gato achado antes do login (ex.: bug 1) — enviado ao logar
  const catImg = (n) => `/img/gato_da_sorte/${n}.jpeg`;
  const CONGRATS_IMG = '/img/gato_da_sorte/parabens.jpeg';
  const CONGRATS_TEXT = 'Parabéns, você encontrou todos os gatos da sorte';

  const params = new URLSearchParams(location.search);
  if (params.get('bugs') === 'off') localStorage.setItem('kathflix.bugs', 'off');
  if (params.get('bugs') === 'on') localStorage.removeItem('kathflix.bugs');

  function readPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch { return []; }
  }

  const cats = {
    TOTAL,
    catImg,
    CONGRATS_IMG,
    CONGRATS_TEXT,
    state: null,

    enabled: () => localStorage.getItem('kathflix.bugs') !== 'off',

    async load() {
      cats.state = await KF.api('/me/cats');
      cats.updateBadge();
      return cats.state;
    },

    updateBadge() {
      const el = document.getElementById('nav-cats-count');
      if (el && cats.state) el.textContent = `${cats.state.found.length}/${TOTAL}`;
    },

    // Chamado pelas telas quando o aluno aciona um bug. Só mostra o gato na primeira vez.
    async find(n) {
      if (!cats.enabled()) return;
      if (!KF.getToken()) {
        const pending = readPending();
        if (pending.includes(n)) return;
        localStorage.setItem(PENDING_KEY, JSON.stringify([...pending, n]));
        cats.showCat(n, { remaining: TOTAL - pending.length - 1 });
        return;
      }
      try {
        const r = await KF.api(`/me/cats/${n}`, { method: 'POST' });
        cats.state = r;
        cats.updateBadge();
        if (r.newlyFound) cats.showCat(n, { remaining: TOTAL - r.found.length, thenCongrats: r.complete });
      } catch { /* o bug nunca deve atrapalhar a tela */ }
    },

    async flushPending() {
      const pending = readPending();
      localStorage.removeItem(PENDING_KEY);
      for (const n of pending) {
        try { await KF.api(`/me/cats/${n}`, { method: 'POST' }); } catch { /* ignora */ }
      }
    },

    showCat(n, { remaining = 0, thenCongrats = false } = {}) {
      closeLayer('lucky-cat-layer');
      const layer = document.createElement('div');
      layer.id = 'lucky-cat-layer';
      layer.className = 'cat-layer';
      layer.innerHTML = `
        <div id="lucky-cat-popup" class="cat-popup" role="dialog" aria-label="Gato da sorte ${n}" data-testid="lucky-cat-popup" data-cat="${n}">
          <button type="button" id="lucky-cat-close" class="cat-close" aria-label="Fechar" data-testid="lucky-cat-close">×</button>
          <img id="lucky-cat-img" data-testid="lucky-cat-img" src="${catImg(n)}" alt="Gato da sorte ${n}">
          <p id="lucky-cat-text" data-testid="lucky-cat-text">Você encontrou um <s>bug</s> gato da sorte.</p>
          <p id="lucky-cat-remaining" data-testid="lucky-cat-remaining">${remainingText(n, remaining)}</p>
        </div>`;
      document.body.appendChild(layer);
      const close = () => { closeLayer('lucky-cat-layer'); if (thenCongrats) cats.showCongrats(); };
      layer.querySelector('#lucky-cat-close').addEventListener('click', close);
      layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      layer.querySelector('#lucky-cat-close').focus();
    },

    showCongrats() {
      closeLayer('cats-congrats');
      const layer = document.createElement('div');
      layer.id = 'cats-congrats';
      layer.className = 'cat-layer';
      layer.setAttribute('data-testid', 'cats-congrats');
      layer.innerHTML = `
        <div class="cat-popup cat-congrats" role="dialog" aria-label="Parabéns">
          <button type="button" id="cats-congrats-close" class="cat-close" aria-label="Fechar" data-testid="cats-congrats-close">×</button>
          <img data-testid="cats-congrats-img" src="${CONGRATS_IMG}" alt="Parabéns">
          <p id="cats-congrats-text" data-testid="cats-congrats-text">${CONGRATS_TEXT}</p>
        </div>
        <canvas class="confetti" data-testid="confetti-canvas"></canvas>`;
      document.body.appendChild(layer);
      layer._stop = confetti(layer.querySelector('canvas'));
      const close = () => closeLayer('cats-congrats');
      layer.querySelector('#cats-congrats-close').addEventListener('click', close);
      layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      layer.querySelector('#cats-congrats-close').focus();
    },
  };

  function remainingText(n, remaining) {
    if (remaining <= 0) return `Você achou o gato ${n}, não falta nenhum!`;
    return `Você achou o gato ${n}, ${remaining === 1 ? "falta 1" : "faltam " + remaining}`;
  }

  function closeLayer(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el._stop) el._stop();
    el.remove();
  }

  function confetti(canvas) {
    const ctx = canvas.getContext('2d');
    const colors = ['#e50914', '#f5c518', '#2ecc71', '#3498db', '#e67e22', '#ffffff', '#ff6fb5'];
    const fit = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    fit();
    addEventListener('resize', fit);
    const rand = (a, b) => a + Math.random() * (b - a);
    const pieces = Array.from({ length: 180 }, (_, i) => ({
      x: rand(0, canvas.width), y: rand(-canvas.height, 0), w: rand(6, 12), h: rand(8, 16),
      vx: rand(-1.2, 1.2), vy: rand(2, 6), rot: rand(0, 6.28), vr: rand(-0.2, 0.2), c: colors[i % colors.length],
    }));
    let raf;
    (function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y > canvas.height + 20) { p.y = -20; p.x = rand(0, canvas.width); }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    })();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
  }

  KF.cats = cats;
})();
