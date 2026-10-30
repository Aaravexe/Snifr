/* Shared navigation behaviour for the five-page prototype. */
document.addEventListener('DOMContentLoaded', () => {
  const session = JSON.parse(localStorage.getItem('snifrSession') || 'null');
  const startButton = document.querySelector('#get-started');
  const signInLink = document.querySelector('.signin');

  if (session) {
    startButton.href = 'Dashboard.HTML';
    signInLink.href = 'Dashboard.HTML';
    signInLink.textContent = 'My Dashboard';
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  document.querySelectorAll('.page-nav a, .site-footer a').forEach((link) => {
    link.addEventListener('pointerdown', () => link.classList.add('is-pressed'));
    link.addEventListener('pointerup', () => link.classList.remove('is-pressed'));
    link.addEventListener('pointerleave', () => link.classList.remove('is-pressed'));
  });
});
