const state = { date: '', time: '', rating: 0, sort: 'match' };
const grid = document.querySelector('.walker-grid');
const count = document.querySelector('.walker-heading p');
const empty = document.querySelector('.no-walkers');
const dateInput = document.querySelector('#walker-date');
let walkers = [];

const starIcons = rating => Array.from({ length: 5 }, (_, index) => {
  const type = rating - index >= 1 ? 'full' : rating - index >= .5 ? 'half' : 'empty';
  return `<span class="rating-star ${type}"><img src="assets/star.svg" alt=""></span>`;
}).join('');

function card(walker) {
  const element = document.createElement('article');
  element.className = 'walker-card';
  element.innerHTML = `
    <div class="card-top"><img class="avatar" src="${walker.image}" alt="${walker.name}">
      <div><h2>${walker.name}</h2><div class="rating"><span class="stars">${starIcons(walker.rating)}</span> (${walker.reviewCount})</div></div>
    </div>
    <div class="card-footer"><div><span>Hourly Rate</span><strong>₹${walker.hourlyRate}/hr</strong></div>
      <a href="${walker.profilePage}?walker=${walker.id}">View Profile</a></div>`;
  return element;
}

function render() {
  const results = walkers.filter(walker =>
    (!state.date || walker.availableDates.includes(state.date)) &&
    (!state.time || walker.availableTimes.includes(state.time)) &&
    walker.rating >= state.rating
  );

  results.sort((a, b) => state.sort === 'rating'
    ? b.rating - a.rating
    : state.sort === 'rate'
      ? a.hourlyRate - b.hourlyRate
      : a.matchRank - b.matchRank);

  grid.replaceChildren(...results.map(card));
  grid.hidden = results.length === 0;
  empty.hidden = results.length > 0;
  count.textContent = `${results.length} active walker${results.length === 1 ? '' : 's'} found`;
}

function choose(selector, key, label) {
  document.querySelectorAll(selector).forEach(option => option.addEventListener('click', event => {
    event.preventDefault();
    state[key] = key === 'rating' ? Number(option.dataset[key]) : option.dataset[key];
    option.closest('details').querySelector('summary span').textContent = label(option);
    option.closest('details').open = false;
    render();
  }));
}

dateInput.addEventListener('change', () => {
  state.date = dateInput.value;
  const label = state.date ? new Date(`${state.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Any date';
  document.querySelector('.date-dropdown summary span').textContent = label;
  document.querySelector('.date-dropdown').open = false;
  render();
});

choose('[data-time]', 'time', option => option.textContent);
choose('[data-rating]', 'rating', option => `${option.dataset.rating} Stars & up`);
choose('[data-sort]', 'sort', option => `Sort by: ${option.textContent}`);

function clearFilters() {
  Object.assign(state, { date: '', time: '', rating: 0, sort: 'match' });
  dateInput.value = '';
  document.querySelector('.date-dropdown summary span').textContent = 'Any date';
  document.querySelectorAll('.filter-dropdown').forEach((box, index) => {
    box.open = false;
    if (index === 1) box.querySelector('summary span').textContent = 'Any time';
    if (index === 2) box.querySelector('summary span').textContent = 'Any rating';
    if (box.classList.contains('filter-sort')) box.querySelector('summary span').textContent = 'Sort by: Best Match';
  });
  render();
}

document.querySelectorAll('.clear-filters, .no-results-reset').forEach(button => button.addEventListener('click', clearFilters));

fetch('walkers.json')
  .then(response => {
    if (!response.ok) throw new Error('Could not read walkers.json');
    return response.json();
  })
  .then(data => {
    walkers = data.walkers;
    clearFilters();
  })
  .catch(() => {
    grid.hidden = true;
    empty.hidden = false;
    empty.querySelector('h2').textContent = 'Walker data could not be loaded';
    empty.querySelector('p').textContent = 'Open the project with Live Server to load the local JSON file.';
    count.textContent = '0 active walkers found';
  });
