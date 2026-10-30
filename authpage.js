const form = document.querySelector('#auth-form');
const email = document.querySelector('#auth-email');
const password = document.querySelector('#auth-password');
const message = document.querySelector('#auth-message');
const submit = form.querySelector('.submit');
const modeButtons = document.querySelectorAll('[data-mode]');
const roleInputs = document.querySelectorAll('[name="role"]');
let mode = 'create';

const accountsReady = fetch('accounts.json')
  .then(response => response.json())
  .then(data => {
    const saved = JSON.parse(localStorage.getItem('snifrUsers') || '[]');
    const merged = [...data.accounts];
    saved.forEach(user => {
      if (!merged.some(account => account.email === user.email)) merged.push(user);
    });
    localStorage.setItem('snifrUsers', JSON.stringify(merged));
    saveJson('users.json', merged).catch(() => {});
    return merged;
  })
  .catch(() => JSON.parse(localStorage.getItem('snifrUsers') || '[]'));

async function saveJson(name, data) {
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  const file = await root.getFileHandle(name, { create: true });
  const writer = await file.createWritable();
  await writer.write(JSON.stringify(data, null, 2));
  await writer.close();
}

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
  document.querySelectorAll('.role-option').forEach(label => label.classList.toggle('selected', label.contains(input)));
}));

form.addEventListener('submit', async event => {
  event.preventDefault();
  const role = document.querySelector('[name="role"]:checked').value;

  if (!email.validity.valid) return show('Enter a valid email address.');
  if (password.value.length < 6) return show('Password must contain at least 6 characters.');

  const users = await accountsReady;
  const existing = users.find(user => user.email === email.value.trim().toLowerCase());

  if (mode === 'create') {
    if (existing) return show('An account with this email already exists.');
    users.push({
      id: `user-${Date.now()}`,
      displayName: email.value.split('@')[0],
      email: email.value.trim().toLowerCase(),
      password: password.value,
      role
    });
    localStorage.setItem('snifrUsers', JSON.stringify(users));
    await saveJson('users.json', users).catch(() => {});
  } else if (!existing || existing.password !== password.value) {
    return show('Email or password is incorrect.');
  }

  const account = users.find(user => user.email === email.value.trim().toLowerCase());
  localStorage.setItem('snifrSession', JSON.stringify(account));
  show(mode === 'create' ? 'Account created. Opening dashboard…' : 'Signed in. Opening dashboard…', true);
  setTimeout(() => location.href = 'Dashboard.HTML', 700);
});

if (new URLSearchParams(location.search).get('role') === 'walker') {
  document.querySelector('[name="role"][value="walker"]').click();
}

if (new URLSearchParams(location.search).get('mode') === 'signin') setMode('signin');
