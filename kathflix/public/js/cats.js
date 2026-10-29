(function () {
  KF.requireAuth();
  KF.renderNav('cats');
  KF.renderFooter();

  const grid = document.getElementById('cats-grid');

  // Gato não encontrado = quadrado preto, sem <img> (a imagem nem é baixada).
  function slot(id, label, found, src) {
    return `<div class="cat-slot ${found ? 'found' : 'locked'}" id="${id}" data-testid="${id}" data-found="${found}" aria-label="${label}${found ? '' : ' (não encontrado)'}">
      ${found ? `<img src="${src}" alt="${label}">` : '<span aria-hidden="true">?</span>'}
    </div>`;
  }

  function render(state) {
    const found = new Set(state.found);
    document.getElementById('cats-counter').textContent = `Você encontrou ${found.size} de ${state.total} gatos da sorte`;
    let html = '';
    for (const n of state.cats) html += slot(`cat-${n}`, `Gato da sorte ${n}`, found.has(n), KF.cats.catImg(n));
    html += slot('cat-parabens', 'Parabéns', state.complete, KF.cats.CONGRATS_IMG);
    if (state.complete) html = `<p class="cats-congrats-line" data-testid="cats-complete-text">${KF.cats.CONGRATS_TEXT}</p>` + html;
    grid.innerHTML = html;
  }

  document.getElementById('cats-reset').addEventListener('click', async () => {
    try {
      await KF.api('/me/cats', { method: 'DELETE' });
      render(await KF.cats.load());
    } catch (ex) { grid.textContent = ex.message; }
  });

  KF.cats.load().then(render).catch((ex) => {
    grid.textContent = ex.message;
  });
})();
