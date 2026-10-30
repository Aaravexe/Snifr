const dateButtons = [...document.querySelectorAll('.date-option')];
const timeButtons = [...document.querySelectorAll('.time-option')];
const pet = document.querySelector('#pet-select');
const summary = document.querySelector('#booking-date-time');
const message = document.querySelector('#booking-message');
const dialog = document.querySelector('#confirmation-dialog');
let selectedDate = '';
let selectedTime = '';
let walker = null;

async function saveBookingFile(booking) {
  if (!window.showDirectoryPicker) {
    throw new Error('Folder saving is supported in Chrome and Edge. Open the website with Live Server.');
  }

  const selectedFolder = await window.showDirectoryPicker({
    id: 'snifr-bookings',
    mode: 'readwrite'
  });
  const bookingsFolder = await selectedFolder.getDirectoryHandle('Snifr Bookings', { create: true });
  const fileName = `booking-${booking.bookingId}.json`;
  const file = await bookingsFolder.getFileHandle(fileName, { create: true });
  const writer = await file.createWritable();
  await writer.write(JSON.stringify(booking, null, 2));
  await writer.close();
  return fileName;
}

function stars(rating) {
  return Array.from({ length: 5 }, (_, index) => {
    const left = rating - index;
    const type = left >= 1 ? 'full' : left >= .5 ? 'half' : 'empty';
    return `<img class="${type}" src="assets/star.svg" alt="">`;
  }).join('');
}

function showWalker(data) {
  walker = data;
  document.title = `Snifr | Book ${data.name}`;
  document.querySelector('#walker-name').textContent = data.name;
  document.querySelector('#walker-photo').src = data.image;
  document.querySelector('#walker-photo').alt = data.name;
  document.querySelector('#walker-about').textContent = data.about;
  document.querySelector('#walker-walks').textContent = `${data.walksCompleted}+ Walks`;
  document.querySelector('#walker-response').textContent = data.responseTime;
  document.querySelector('#walker-rating').innerHTML = `<span class="profile-stars">${stars(data.rating)}</span><span>${data.rating} (${data.reviewCount} reviews)</span>`;
  document.querySelector('#reviews-list').innerHTML = data.reviews.map(review => `
    <div class="review card"><b>${review.name}</b><span class="stars">${stars(review.rating)}</span><p>${review.text}</p></div>
  `).join('');

  const total = data.hourlyRate + 30;
  document.querySelector('#booking-rate').textContent = `₹${data.hourlyRate.toFixed(2)}`;
  document.querySelector('#booking-total').textContent = `₹${total.toFixed(2)}`;

  dateButtons.forEach((button, index) => {
    const value = data.availableDates[index];
    button.hidden = !value;
    if (!value) return;
    const date = new Date(`${value}T00:00:00`);
    button.dataset.date = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    button.innerHTML = `${date.toLocaleDateString('en-US', { weekday: 'short' })}<strong>${date.getDate()}</strong>`;
  });
}

function select(buttons, chosen) {
  buttons.forEach(button => {
    const active = button === chosen;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', active);
  });
}

function updateSummary() {
  summary.textContent = selectedDate && selectedTime ? `${selectedDate} @ ${selectedTime}` : 'Select a date and time';
  message.textContent = '';
}

dateButtons.forEach(button => button.addEventListener('click', () => {
  selectedDate = button.dataset.date;
  select(dateButtons, button);
  updateSummary();
}));

timeButtons.forEach(button => button.addEventListener('click', () => {
  selectedTime = button.textContent.trim();
  select(timeButtons, button);
  updateSummary();
}));

function valid() {
  const missing = [];
  if (!walker) missing.push('walker');
  if (!pet.value) missing.push('pet');
  if (!selectedDate) missing.push('date');
  if (!selectedTime) missing.push('time slot');
  message.textContent = missing.length ? `Please select a ${missing.join(', ')}.` : '';
  message.className = `booking-message${missing.length ? ' error' : ''}`;
  return missing.length === 0;
}

document.querySelector('#booking-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!valid()) return;
  const total = walker.hourlyRate + 30;
  document.querySelector('#confirmation-details').textContent = `${pet.value} with ${walker.name} on ${selectedDate} at ${selectedTime}. Total cost: ₹${total.toFixed(2)}.`;
  dialog.showModal();
});

document.querySelector('#submit-booking').addEventListener('click', async event => {
  event.preventDefault();
  if (!valid()) return dialog.close();
  const booking = {
    bookingId: `SNIFR-${Date.now()}`,
    walkerId: walker.id,
    walker: walker.name,
    pet: pet.value,
    duration: '60 Minute Walk',
    date: selectedDate,
    time: selectedTime,
    rate: walker.hourlyRate,
    platformServiceFee: 30,
    totalCost: walker.hourlyRate + 30,
    status: 'confirmed',
    submittedAt: new Date().toISOString()
  };
  try {
    const fileName = await saveBookingFile(booking);
    dialog.close();
    message.textContent = 'Booking saved in the Snifr Bookings folder. Opening dashboard...';
    message.className = 'booking-message success';
    const bookingData = encodeURIComponent(JSON.stringify(booking));
    setTimeout(() => {
      location.href = `Dashboard.HTML?booking=${bookingData}&file=${encodeURIComponent(fileName)}`;
    }, 700);
  } catch (error) {
    if (error.name === 'AbortError') {
      message.textContent = 'Folder selection was cancelled. Your booking was not submitted.';
    } else {
      message.textContent = error.message || 'The booking file could not be saved.';
    }
    message.className = 'booking-message error';
    dialog.close();
  }
});

document.querySelector('#cancel-booking').addEventListener('click', () => {
  if (!confirm('Clear your booking selections?')) return;
  selectedDate = '';
  selectedTime = '';
  pet.value = '';
  select(dateButtons, null);
  select(timeButtons, null);
  updateSummary();
});

const walkerId = new URLSearchParams(location.search).get('walker') || 'priyanka';
fetch('walkers.json')
  .then(response => response.json())
  .then(data => showWalker(data.walkers.find(item => item.id === walkerId) || data.walkers[0]))
  .catch(() => {
    message.textContent = 'Walker information could not be loaded. Open this project with Live Server.';
    message.className = 'booking-message error';
  });

select(dateButtons, null);
select(timeButtons, null);
pet.value = '';
updateSummary();
