(async () => {
  const profile = window.WalkerProfile;
  const account = profile.session();
  if (!profile.gate(account)) return;
  const form = document.querySelector('#settings-form');
  const submit = document.querySelector('#save-settings');
  let controller;
  let saved;
  form.inert = true;
  profile.message('Loading your profile…');
  try {
    saved = await profile.initial(account);
    controller = profile.formController(form, saved.profile);
    renderStatus();
    profile.message(new URLSearchParams(location.search).get('setup') === 'complete' && saved.completed
      ? 'Your profile draft is complete and saved. You can update it here any time.' : '', 'success');
    form.inert = false;
  } catch (error) {
    profile.message(error.message || 'Your profile could not be loaded. Check browser storage permissions and reload.', 'error');
    form.inert = false;
    form.querySelectorAll('input, textarea, button').forEach(element => { element.disabled = true; });
    return;
  }

  function renderStatus() {
    const complete = saved.completed && !Object.keys(profile.validate(saved.profile)).length;
    document.querySelector('#incomplete-notice').hidden = complete;
    document.querySelector('#profile-status').textContent = complete ? 'Profile draft complete' : 'Setup incomplete';
    document.querySelector('#last-saved').textContent = saved.savedAt
      ? `Saved ${new Date(saved.savedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'No changes saved yet';
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!controller.imageReady()) return;
    const values = controller.read();
    if (!controller.errors(profile.validate(values))) {
      profile.message('Please check the highlighted fields.', 'error');
      return;
    }
    submit.disabled = true;
    try {
      saved = profile.save(account, values, true, 3);
      controller.markSaved();
      renderStatus();
      profile.message('Changes saved in this browser. Your public listing has not changed.', 'success');
    } catch (error) { profile.message(error.message, 'error'); }
    finally { submit.disabled = false; }
  });

  document.querySelector('#discard-changes').addEventListener('click', () => {
    if (controller.isDirty() && !confirm('Discard your unsaved profile changes?')) return;
    controller.fill(saved.profile);
    profile.message('Showing your last saved details.');
  });
})();
