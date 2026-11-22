const form = document.querySelector('#auth-form');
const email = document.querySelector('#auth-email');
const password = document.querySelector('#auth-password');
const message = document.querySelector('#auth-message');
const submit = form.querySelector('.submit');
const modeButtons = document.querySelectorAll('[data-mode]');
const roleInputs = document.querySelectorAll('[name="role"]');
let mode = 'create';

function show(text, success = false) {
  message.textContent = text;
  message.className = `form-message${success ? ' success' : ''}`;
}

function setMode(nextMode) {
  mode = nextMode;
  modeButtons.forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const creating = mode === 'create';
  document.querySelector('#name-field').hidden = !creating;
  document.querySelector('#city-field').hidden = !creating || selectedRole() !== 'consumer';
  document.querySelector('#role-field').hidden = !creating;
  document.querySelector('#auth-name').required = creating;
  submit.textContent = creating ? 'Create Account' : 'Sign In';
  show('');
}

function selectedRole() { return document.querySelector('[name="role"]:checked')?.value || 'consumer'; }

modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
roleInputs.forEach(input => input.addEventListener('change', () => {
  document.querySelectorAll('.role-option').forEach(label => label.classList.toggle('selected', label.contains(input)));
  document.querySelector('#city-field').hidden = mode !== 'create' || selectedRole() !== 'consumer';
}));

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (!email.validity.valid) return show('Enter a valid email address.');
  if (password.value.length < 6 || password.value.length > 200) return show('Password must contain 6–200 characters.');

  const creating = mode === 'create';
  const payload = { email: email.value.trim().toLowerCase(), password: password.value };
  if (creating) Object.assign(payload, {
    displayName: document.querySelector('#auth-name').value.trim(),
    role: selectedRole(),
    ...(selectedRole() === 'consumer' ? { city: document.querySelector('#auth-city').value.trim() } : {})
  });
  submit.disabled = true;
  try {
    const response = await fetch(creating ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) return show(result.message || 'Account request failed.');
    show(creating ? 'Account created. Opening your Snifr account…' : 'Signed in. Opening your Snifr account…', true);
    setTimeout(() => location.replace(result.data.destination), 300);
  } catch {
    show('Account server is unavailable. Start the website with npm start.');
  } finally {
    submit.disabled = false;
  }
});

if (new URLSearchParams(location.search).get('role') === 'walker') {
  document.querySelector('[name="role"][value="walker"]').click();
}
setMode(new URLSearchParams(location.search).get('mode') === 'signin' ? 'signin' : 'create');
