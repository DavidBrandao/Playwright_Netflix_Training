(function () {
  KF.requireAuth();
  KF.renderNav('profile');
  KF.renderFooter();

  const $ = (id) => document.getElementById(id);
  const msg = $('profile-message');

  function fill(u) {
    $('profile-name').value = u.name;
    $('profile-email').value = u.email;
    $('profile-bio').value = u.bio || '';
    $('profile-avatar').src = u.avatar_url || '/img/cover-default.svg';
  }

  function say(text, kind) {
    msg.className = `msg ${kind}`;
    KF.show(msg, text);
  }

  KF.api('/me').then(fill).catch((ex) => say(ex.message, 'error'));

  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.hidden = true;
    const form = new FormData();
    form.append('name', $('profile-name').value.trim());
    form.append('email', $('profile-email').value.trim());
    form.append('bio', $('profile-bio').value);
    if ($('profile-password').value) form.append('password', $('profile-password').value);
    const file = $('profile-avatar-file').files[0];
    if (file) form.append('avatar', file);
    try {
      const user = await KF.api('/me', { method: 'PUT', form });
      KF.setUser(user);
      fill(user);
      $('profile-password').value = '';
      $('profile-avatar-file').value = '';
      KF.renderNav('profile');
      say('Perfil atualizado com sucesso', 'success');
    } catch (ex) {
      say(ex.message, 'error');
    }
  });
})();
