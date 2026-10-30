const petsList = document.querySelector('#pets-list');
const bookingBox = document.querySelector('#recent-booking');
const petDialog = document.querySelector('#pet-dialog');
const petForm = document.querySelector('#pet-form');

async function saveJson(name, data) {
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  const file = await root.getFileHandle(name, { create: true });
  const writer = await file.createWritable();
  await writer.write(JSON.stringify(data, null, 2));
  await writer.close();
}

function load(key, fallback) {
  return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
}

function bookingFromUrl() {
  const value = new URLSearchParams(location.search).get('booking');
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function updateBookingFile(booking) {
  if (!window.showDirectoryPicker) {
    throw new Error('Folder saving is supported in Chrome and Edge.');
  }

  const selectedFolder = await window.showDirectoryPicker({
    id: 'snifr-bookings',
    mode: 'readwrite'
  });
  const bookingsFolder = await selectedFolder.getDirectoryHandle('Snifr Bookings');
  const fileName = new URLSearchParams(location.search).get('file') || `booking-${booking.bookingId}.json`;
  const file = await bookingsFolder.getFileHandle(fileName);
  const writer = await file.createWritable();
  await writer.write(JSON.stringify(booking, null, 2));
  await writer.close();
}

function renderPets() {
  const pets = load('snifrPets', [
    { name: 'Sheru', breed: 'Golden Retriever', age: 2 },
    { name: 'Pinky', breed: 'Corgi', age: 1 }
  ]);
  localStorage.setItem('snifrPets', JSON.stringify(pets));
  petsList.innerHTML = pets.map(pet => `
    <div class="pet"><img src="assets/walker.png" alt="${pet.name}">
      <div><strong>${pet.name}</strong><small>${pet.breed}, ${pet.age} yr${pet.age === 1 ? '' : 's'}</small></div>
    </div>`).join('');
}

function renderBooking() {
  const booking = bookingFromUrl();
  if (!booking) return;
  bookingBox.innerHTML = `
    <img src="assets/figma-user-img.png" alt="${booking.walker}">
    <div><strong>${booking.walker}</strong><small>${booking.date}, ${booking.time} · ${booking.duration} for ${booking.pet}</small></div>
    <em>${booking.status.toUpperCase()}</em>
    <button class="cancel-latest" type="button">Cancel</button>`;
  bookingBox.querySelector('.cancel-latest').addEventListener('click', async () => {
    if (!confirm('Cancel this booking?')) return;
    booking.status = 'cancelled';
    try {
      await updateBookingFile(booking);
      const params = new URLSearchParams(location.search);
      params.set('booking', JSON.stringify(booking));
      history.replaceState(null, '', `${location.pathname}?${params}`);
      renderBooking();
    } catch (error) {
      if (error.name !== 'AbortError') alert(error.message || 'The booking file could not be updated.');
    }
  });
}

document.querySelector('#walker-search-form').addEventListener('submit', event => {
  event.preventDefault();
  const location = document.querySelector('#location-search').value.trim();
  if (location) window.location.href = `walkersearch.html?location=${encodeURIComponent(location)}`;
});

document.querySelector('#open-pet-form').addEventListener('click', () => petDialog.showModal());

petForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.querySelector('#pet-name').value.trim();
  const breed = document.querySelector('#pet-breed').value.trim();
  const age = Number(document.querySelector('#pet-age').value);
  const message = document.querySelector('#pet-message');

  if (!name || !breed || !Number.isFinite(age) || age < 0 || age > 30) {
    message.textContent = 'Enter a valid name, breed, and age.';
    return;
  }

  const pets = load('snifrPets', []);
  pets.push({ name, breed, age });
  localStorage.setItem('snifrPets', JSON.stringify(pets));
  await saveJson('pets.json', pets).catch(() => {});
  petForm.reset();
  message.textContent = '';
  petDialog.close();
  renderPets();
});

const session = load('snifrSession', null);
if (session) {
  document.querySelector('#welcome-title').textContent = `Welcome back, ${session.displayName || session.email.split('@')[0]}!`;
  document.querySelector('.profile-button').addEventListener('click', () => {
    location.href = session.walkerId ? `wakerinfo.html?walker=${session.walkerId}` : 'authpage.html';
  });
} else {
  document.querySelector('.profile-button').addEventListener('click', () => location.href = 'authpage.html?mode=signin');
}
renderPets();
renderBooking();
