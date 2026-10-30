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
  modeButtons.forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  submit.textContent = mode === 'create' ? 'Create Account' : 'Sign In';
  show('');
}

modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));

roleInputs.forEach(input => input.addEventListener('change', () => {
  document.querySelectorAll('.role-option').forEach(label => {
    label.classList.toggle('selected', label.contains(input));
  });
}));

form.addEventListener('submit', async event => {
  event.preventDefault();
  const emailValue = email.value.trim().toLowerCase();
  const role = document.querySelector('[name="role"]:checked').value;

  if (!email.validity.valid) return show('Enter a valid email address.');
  if (password.value.length < 6) return show('Password must contain at least 6 characters.');

  try {
    const endpoint = mode === 'create' ? '/api/accounts/register' : '/api/accounts/login';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailValue, password: password.value, role })
    });
    const result = await response.json();

    if (!response.ok) return show(result.message || 'Account request failed.');

    localStorage.setItem('snifrSession', JSON.stringify(result.account));
    show(mode === 'create' ? 'Account created. Opening dashboard...' : 'Signed in. Opening dashboard...', true);
    setTimeout(() => location.href = 'Dashboard.HTML', 700);
  } catch {
    show('Account server is unavailable. Start the website with npm start.');
  }
});

const parameters = new URLSearchParams(location.search);
if (parameters.get('role') === 'walker') {
  document.querySelector('[name="role"][value="walker"]').click();
}
if (parameters.get('mode') === 'signin') setMode('signin');
