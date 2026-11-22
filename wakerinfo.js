const dateButtons = document.querySelector('.days');
const timeButtons = document.querySelector('.times');
const pet = document.querySelector('#pet-select');
const summary = document.querySelector('#booking-date-time');
const message = document.querySelector('#booking-message');
const dialog = document.querySelector('#confirmation-dialog');
let selectedDate = '';
let selectedTime = '';
let walker = null;
let availability = [];

const session = JSON.parse(localStorage.getItem('snifrSession') || 'null');
const consumerId = session?.id || session?._id || 'demo-consumer';


function stars(rating) {
  return Array.from({ length: 5 }, (_, index) => `<img class="${rating - index >= 1 ? 'full' : rating - index >= .5 ? 'half' : 'empty'}" src="assets/star.svg" alt="">`).join('');
}

function setMessage(text = '', kind = '') { message.textContent = text; message.className = `booking-message${kind ? ` ${kind}` : ''}`; }

async function populatePets() {
  pet.replaceChildren(new Option('Loading pets…',''));
  const res = await fetch('/api/pets');
  const result = await res.json();
  if (!res.ok) {
    pet.replaceChildren(new Option('No pet selected',''));
    throw new Error(res.status === 401 ? 'Sign in as a consumer to choose your pet.' : result.message);
  }
  pet.replaceChildren(new Option(result.data.length ? 'Choose a pet' : 'Add a pet on your dashboard first',''));
  for (const item of result.data) pet.add(new Option(item.name,item._id));
}

function showWalker(data) {
  walker = data;
  document.title = `Snifr | Book ${data.name}`;
  document.querySelector('#walker-name').textContent = data.name;
  document.querySelector('#walker-photo').src = data.image || 'assets/walker.png';
  document.querySelector('#walker-photo').alt = data.name;
  document.querySelector('#walker-about').textContent = data.about || 'A verified Snifr walker.';
  document.querySelector('#walker-walks').textContent = `${data.walksCompleted || 0}+ Walks`;
  document.querySelector('#walker-response').textContent = data.responseTime || 'Usually within an hour';
  document.querySelector('#walker-rating').innerHTML = `<span class="profile-stars">${stars(data.rating || 0)}</span><span>${data.rating || 0} (${data.reviewCount || 0} reviews)</span>`;
  const list = document.querySelector('#reviews-list');
  list.replaceChildren();
  for (const review of data.reviews || []) {
    const card = document.createElement('article'), title = document.createElement('b'), comment = document.createElement('p');
    card.className = 'review card'; title.textContent = review.name + ' · ' + review.rating + '/5'; comment.textContent = review.text;
    card.append(title,comment); list.append(card);
  }
  if (!list.children.length) list.textContent = 'No reviews yet.';
  const rate = Number(data.hourlyRate || 0);
  document.querySelector('#booking-rate').textContent = `₹${rate.toFixed(2)}`;
  document.querySelector('#booking-total').textContent = `₹${(rate + 30).toFixed(2)}`;
}

function updateSummary() { summary.textContent = selectedDate && selectedTime ? `${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} @ ${selectedTime}` : 'Select a date and time'; }

function renderTimes() {
  const day = availability.find(item => item.date === selectedDate);
  selectedTime = '';
  timeButtons.replaceChildren(...(day?.slots || []).map(time => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = time;
    button.addEventListener('click', () => { selectedTime = time; [...timeButtons.children].forEach(item => item.classList.toggle('selected', item === button)); updateSummary(); });
    return button;
  }));
  if (!day?.slots?.length) timeButtons.innerHTML = '<span>No open slots for this date.</span>';
  updateSummary();
}

function renderDates() {
  dateButtons.replaceChildren(...availability.map(item => {
    const date = new Date(`${item.date}T00:00:00`);
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.date = item.date;
    button.innerHTML = `${date.toLocaleDateString('en-US', { weekday: 'short' })}<strong>${date.getDate()}</strong>`;
    button.disabled = !item.slots.length;
    button.addEventListener('click', () => { selectedDate = item.date; [...dateButtons.children].forEach(element => element.classList.toggle('selected', element === button)); renderTimes(); });
    return button;
  }));
}

function isValid() {
  const missing = [];
  if (!walker) missing.push('walker'); if (!pet.value) missing.push('pet'); if (!selectedDate) missing.push('date'); if (!selectedTime) missing.push('time slot');
  if (missing.length) setMessage(`Please select a ${missing.join(', ')}.`, 'error');
  return !missing.length;
}

document.querySelector('#booking-form').addEventListener('submit', event => {
  event.preventDefault(); if (!isValid()) return;
  const cost = Number(walker.hourlyRate) + 30;
  document.querySelector('#confirmation-details').textContent = `${pet.selectedOptions[0].text} with ${walker.name} on ${summary.textContent}. Estimated total: ₹${cost.toFixed(2)}. The server confirms the final rate.`;
  dialog.showModal();
});

document.querySelector('#submit-booking').addEventListener('click', async event => {
  event.preventDefault(); if (!isValid()) return;
  try {
    const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consumerId, walkerId: walker.id, petId: pet.value, petName: pet.selectedOptions[0].text, date: selectedDate, time: selectedTime, durationMinutes: 60 }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.message || 'The booking could not be saved.');
    dialog.close(); setMessage('Booking request saved. Redirecting to My Bookings…', 'success');
    setTimeout(() => { location.href = `my-bookings.html?consumerId=${encodeURIComponent(consumerId)}`; }, 700);
  } catch (error) { dialog.close(); setMessage(error.message, 'error'); }
});

document.querySelector('#cancel-booking').addEventListener('click', () => { selectedDate = ''; selectedTime = ''; pet.value = ''; renderDates(); timeButtons.replaceChildren(); updateSummary(); setMessage(); });

async function loadBookingDetails() {
  const walkerId = new URLSearchParams(location.search).get('walker') || 'priyanka';
  const response = await fetch(`/api/walkers/${encodeURIComponent(walkerId)}/booking-details`);
  const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Walker information could not be loaded.');
  showWalker(result.data.walker); availability = result.data.availability; renderDates();
}

populatePets().catch(error => setMessage(error.message,'error')); updateSummary(); loadBookingDetails().catch(error => setMessage(error.message || 'Start the project with npm start.', 'error'));
