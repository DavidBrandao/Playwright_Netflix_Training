(function () {
  const err = document.getElementById('register-error');
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    if (!name || !email || !password) return KF.show(err, 'Preencha todos os campos');
    if (password !== confirm) return KF.show(err, 'As senhas não conferem');
    try {
      await KF.api('/auth/register', { method: 'POST', json: { name, email, password } });
      location.href = '/login.html?registered=1';
    } catch (ex) {
      KF.show(err, ex.message);
    }
  });
})();
