import { $, api, start, notice } from './dashboard.js';

let user;
const form = $('settings-form');
const profilePath = () => '/api/consumer-profiles/' + encodeURIComponent(user.id);

async function loadProfile() {
  const result = await api(profilePath());
  user = result.user;
  for (const [key, value] of Object.entries({ ...result.profile, displayName: user.displayName, email: user.email })) {
    if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value || '';
  }
}

try {
  user = await start();
  await loadProfile();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    $('save').disabled = true;
    const data = Object.fromEntries(new FormData(form).entries());
    try { await api(profilePath(), 'PATCH', data); notice('Your account settings have been saved.'); }
    catch (error) { notice(error.message); }
    finally { $('save').disabled = false; }
  });
  $('deactivate').addEventListener('click', async event => {
    if (!confirm('Deactivate your Snifr account? You will be signed out.')) return;
    event.currentTarget.disabled = true;
    try { await api('/api/auth/account', 'DELETE'); location.replace('/auth?mode=signin'); }
    catch (error) { notice(error.message); event.currentTarget.disabled = false; }
  });
} catch (error) { notice(error.message); }
