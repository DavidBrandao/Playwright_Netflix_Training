(function () {
  const params = new URLSearchParams(location.search);
  if (params.get('alerts') === 'off') localStorage.setItem('kathflix.alerts', 'off');
  if (params.get('alerts') === 'on') localStorage.removeItem('kathflix.alerts');

  if (KF.getToken() && KF.getUser()) { location.href = '/home.html'; return; }

  const err = document.getElementById('login-error');
  if (params.get('registered')) KF.show(document.getElementById('login-success'), 'Cadastro realizado! Faça login para continuar.');

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) return KF.show(err, 'Informe e-mail e senha');
    try {
      const { token, user } = await KF.api('/auth/login', { method: 'POST', json: { email, password } });
      KF.setSession(token, user);
      if (KF.alertsEnabled()) {
        sessionStorage.setItem('kathflix.promo', '1');
        alert(`Bem-vindo ao KathFlix, ${user.name}!`);
      }
      location.href = '/home.html';
    } catch (ex) {
      KF.show(err, ex.message);
    }
  });
})();
