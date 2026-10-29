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
    // bug 2: avatar acima do limite de 2 MB
    if (file && file.size > 2 * 1024 * 1024) KF.cats.find(2);
    // bug 3: bio com exatamente 280 caracteres ou com emoji
    const bio = $('profile-bio').value;
    if (bio.length === 280 || /\p{Extended_Pictographic}/u.test(bio)) KF.cats.find(3);
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
