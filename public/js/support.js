const form = document.querySelector('#feedback-form');
const status = document.querySelector('#feedback-status');

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (data.name.trim().length < 2 || !form.email.validity.valid || data.message.trim().length < 10) {
    status.textContent = 'Enter your name, a valid email address, and a message of at least 10 characters.';
    status.className = 'error';
    return;
  }
  try {
    const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Feedback could not be saved.');
    form.reset();
    status.textContent = result.message;
    status.className = 'success';
  } catch (error) {
    status.textContent = error.message || 'MongoDB Atlas is unavailable. Check the server configuration and try again.';
    status.className = 'error';
  }
});
