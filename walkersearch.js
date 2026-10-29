(() => {
  const dateInput = document.querySelector('#walker-date');
  const grid = document.querySelector('.walker-grid');
  const count = document.querySelector('.walker-heading p');
  const noWalkers = document.querySelector('.no-walkers');
  const defaults = { date: dateInput.value, time: '', rating: 0, sort: 'match' };
  const state = { ...defaults };
  let walkers = [];
  const close = element => element.removeAttribute('open');
  const label = (selector, value) => { document.querySelector(`${selector} summary span`).textContent = value; };
  const formatDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  function updateLabels() {
    label('.date-dropdown', formatDate(state.date));
    label('.filter-dropdown:nth-of-type(2)', state.time ? document.querySelector(`[data-time="${state.time}"]`).textContent : 'Any time');
    label('.filter-dropdown:nth-of-type(3)', state.rating ? `${state.rating} Stars` : 'Any rating');
    label('.filter-sort', `Sort by: ${document.querySelector(`[data-sort="${state.sort}"]`).textContent}`);
  }

  function cardFor(walker) {
    const card = document.createElement('article');
    card.className = 'walker-card';
    const stars = Array.from({ length: 5 }, (_, index) => `<span class="rating-star ${walker.rating - index >= 1 ? 'full' : walker.rating - index >= .5 ? 'half' : 'empty'}" aria-hidden="true">★</span>`).join('');
    card.innerHTML = `<div class="card-top"><img class="avatar" src="${walker.image}" alt="${walker.name}"><div><h2></h2><div class="rating"><span class="stars" aria-label="${walker.rating} out of 5 stars">${stars}</span> (${walker.reviewCount})</div></div></div><div class="card-footer"><div><span>Hourly Rate</span><strong>₹${walker.hourlyRate}/hr</strong></div><a href="wakerinfo.html?walker=${encodeURIComponent(walker.id)}">View Profile</a></div>`;
    card.querySelector('h2').textContent = walker.name;
    return card;
  }

  function render() {
    const visible = walkers.filter(walker => walker.availableDates.includes(state.date) && (!state.time || walker.availableTimes.includes(state.time)) && (state.rating === 5 ? walker.rating === 5 : walker.rating >= state.rating));
    visible.sort((a, b) => state.sort === 'rating' ? b.rating - a.rating || a.matchRank - b.matchRank : state.sort === 'rate' ? a.hourlyRate - b.hourlyRate : a.matchRank - b.matchRank);
    grid.replaceChildren(...visible.map(cardFor));
    grid.hidden = visible.length === 0;
    noWalkers.hidden = visible.length !== 0;
    count.textContent = `${visible.length} active walker${visible.length === 1 ? '' : 's'} found`;
  }

  dateInput.addEventListener('change', () => { state.date = dateInput.value; updateLabels(); render(); });
  document.querySelectorAll('[data-time]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); state.time = link.dataset.time; close(link.closest('details')); updateLabels(); render(); }));
  document.querySelectorAll('[data-rating]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); state.rating = Number(link.dataset.rating); close(link.closest('details')); updateLabels(); render(); }));
  document.querySelectorAll('[data-sort]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); state.sort = link.dataset.sort; close(link.closest('details')); updateLabels(); render(); }));
  document.querySelectorAll('.clear-filters, .no-results-reset').forEach(button => button.addEventListener('click', () => { Object.assign(state, defaults); dateInput.value = state.date; document.querySelectorAll('.filter-dropdown').forEach(close); updateLabels(); render(); }));

  fetch('walkers.json')
    .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then(data => { if (!Array.isArray(data)) throw new Error('walkers.json must contain an array'); walkers = data; updateLabels(); render(); })
    .catch(error => { console.error('Unable to load walkers.json:', error); count.textContent = 'Unable to load walkers.'; noWalkers.hidden = false; noWalkers.querySelector('h2').textContent = 'Walker information is unavailable'; noWalkers.querySelector('p').textContent = 'Please refresh the page and try again.'; });
})();
