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
  element.innerHTML = '<div class="card-top"><img class="avatar" alt=""><div><h2></h2><div class="rating"></div></div></div><div class="card-footer"><div><span>Hourly Rate</span><strong></strong></div><a>View Profile</a></div>';
  element.querySelector('img').src = walker.image;
  element.querySelector('h2').textContent = walker.name;
  const rating = element.querySelector('.rating'); rating.innerHTML = starIcons(walker.rating);
  rating.append(' (' + walker.reviewCount + ')');
  element.querySelector('strong').textContent = '₹' + walker.hourlyRate + '/hr';
  element.querySelector('a').href = '/walker/' + encodeURIComponent(walker._id);
  return element;
}

function render() {
  const results = walkers.filter(walker =>
    ((!state.date && !state.time) || walker.times.some(s => (!state.date || state.date === s.date) && (!state.time || state.time === s.period))) &&
    walker.rating >= state.rating
  );

  results.sort((a, b) => state.sort === 'rating'
    ? b.rating - a.rating
    : state.sort === 'rate'
      ? a.hourlyRate - b.hourlyRate
      : b.reviewCount - a.reviewCount);

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

async function read(path) {
  const response = await fetch(path);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message);
  return result.data;
}
grid.replaceChildren(); count.textContent = 'Loading walkers…';
read('/api/walkers')
  .then(async data => {
    walkers = await Promise.all(data.filter(w => w.status === 'published').map(async w => {
      const dates = await read('/api/walkers/' + encodeURIComponent(w._id) + '/availability');
      const times = dates.flatMap(d => d.slots.filter(s => s.status === 'available' && new Date(d.date+'T'+s.startTime+':00+05:30') > new Date()).map(s => {
        const h = Number(s.startTime.slice(0,2));
        return { date:d.date,period:h >= 8 && h < 12 ? 'morning' : h >= 12 && h < 16 ? 'afternoon' : h >= 16 && h < 20 ? 'evening' : '' };
      }));
      return {...w,times};
    }));
    clearFilters();
  })
  .catch(error => {
    grid.hidden = true;
    empty.hidden = false;
    empty.querySelector('h2').textContent = 'Walker data could not be loaded';
    empty.querySelector('p').textContent = error.message || 'Reload to try again.';
    count.textContent = '0 active walkers found';
  });
