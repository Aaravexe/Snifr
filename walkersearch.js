// Use local assets instead of design-export URLs.
document.querySelectorAll('img[src*="figma.com/api/mcp/asset"]').forEach(image => {
  image.src = image.src.endsWith('.png') ? 'assets/walker.png' : 'assets/star.svg';
});

(() => {
  const dateInput = document.querySelector('#walker-date');
  const timeDropdown = document.querySelectorAll('.filter-dropdown')[1];
  const ratingDropdown = document.querySelectorAll('.filter-dropdown')[2];
  const sortDropdown = document.querySelector('.filter-sort');
  const cards = [...document.querySelectorAll('.walker-card')];
  const grid = document.querySelector('.walker-grid');
  const count = document.querySelector('.walker-heading p');
  const state = { date: dateInput.value, time: '', rating: 0, sort: 'match' };

  const close = dropdown => dropdown.removeAttribute('open');
  const label = (selector, value) => {
    document.querySelector(`${selector} summary span`).textContent = value;
  };

  function renderRatings() {
    cards.forEach(card => {
      const stars = card.querySelector('.stars');
      const rating = Number(card.dataset.rating);
      stars.replaceChildren(...Array.from({ length: 5 }, (_, index) => {
        const star = document.createElement('span');
        const value = rating - index;
        star.className = `rating-star ${value >= 1 ? 'full' : value >= 0.5 ? 'half' : 'empty'}`;
        star.textContent = '★';
        star.setAttribute('aria-hidden', 'true');
        return star;
      }));
    });
  }

  function availabilityScore(card) {
    const dateMatch = card.dataset.dates.split(',').includes(state.date) ? 2 : 0;
    const timeMatch = state.time && card.dataset.times.split(',').includes(state.time) ? 1 : 0;
    return dateMatch + timeMatch;
  }

  function applyFilters() {
    const visible = cards.filter(card => {
      const rating = Number(card.dataset.rating);
      const ratingMatches = state.rating === 5 ? rating === 5 : rating >= state.rating;
      return card.dataset.dates.split(',').includes(state.date)
        && (!state.time || card.dataset.times.split(',').includes(state.time))
        && ratingMatches;
    });

    visible.sort((a, b) => state.sort === 'rating'
      ? Number(b.dataset.rating) - Number(a.dataset.rating) || availabilityScore(b) - availabilityScore(a)
      : state.sort === 'rate'
        ? Number(a.dataset.rate) - Number(b.dataset.rate)
        : availabilityScore(b) - availabilityScore(a) || Number(b.dataset.rating) - Number(a.dataset.rating) || Number(a.dataset.match) - Number(b.dataset.match));
    cards.forEach(card => { card.hidden = !visible.includes(card); });
    visible.forEach(card => grid.appendChild(card));
    count.textContent = `${visible.length} active walker${visible.length === 1 ? '' : 's'} found`;
  }

  dateInput.addEventListener('change', () => {
    state.date = dateInput.value;
    const date = new Date(`${state.date}T00:00:00`);
    label('.date-dropdown', date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    applyFilters();
  });
  document.querySelectorAll('[data-time]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); state.time = link.dataset.time;
    label('.filter-dropdown:nth-of-type(2)', link.textContent); close(timeDropdown); applyFilters();
  }));
  document.querySelectorAll('.rating-menu [data-rating]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); state.rating = Number(link.dataset.rating);
    label('.filter-dropdown:nth-of-type(3)', `${link.dataset.rating} Stars`); close(ratingDropdown); applyFilters();
  }));
  document.querySelectorAll('[data-sort]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); state.sort = link.dataset.sort;
    label('.filter-sort', `Sort by: ${link.textContent}`); close(sortDropdown); applyFilters();
  }));
  renderRatings();
  applyFilters();
})();
