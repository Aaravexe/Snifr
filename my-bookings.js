function escapeText(value) {
  const element = document.createElement('span'); element.textContent = value; return element.innerHTML;
}
const list = document.querySelector('#booking-list');
const message = document.querySelector('#message');
const session = JSON.parse(localStorage.getItem('snifrSession') || 'null');

const setMessage = (text = '', type = '') => { message.textContent = text; message.className = `message ${type}`; };
const formatDate = date => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

async function api(path, options) { const res = await fetch(path, options); const body = await res.json(); if (!res.ok) throw new Error(body.message || 'Request failed.'); return body.data; }
function render(bookings) {
  if (!bookings.length) { list.innerHTML = '<div class="empty"><h2>No bookings yet</h2><p>Find a walker to create your first booking.</p><a class="button" href="walkersearch.html">Find Walkers</a></div>'; return; }
  list.innerHTML = bookings.map(booking => `<article class="booking-card" data-id="${booking._id}"><div class="booking-head"><div><h2>${escapeText(booking.walkerName)}</h2><p class="subtle">Walk for ${escapeText(booking.petName)}</p></div><span class="status ${booking.status}">${booking.status}</span></div><div class="details"><span>${formatDate(booking.date)}</span><span>${booking.time}</span><span>${booking.durationMinutes} min</span><strong>₹${booking.total}</strong></div><div class="actions">${['pending','accepted'].includes(booking.status) ? '<button class="button secondary" data-action="reschedule">Reschedule</button><button class="button danger" data-action="cancel">Cancel</button>' : ''}${['cancelled','rejected'].includes(booking.status) ? '<button class="button secondary" data-action="delete">Delete</button>' : ''}</div><form class="reschedule-form"><label>Date<input name="date" type="date" min="${new Date().toISOString().slice(0,10)}" required></label><label>Time<input name="time" type="text" placeholder="e.g. 2:00 PM" pattern="([1-9]|1[0-2]):[0-5][0-9] (AM|PM)" required></label><button class="button" type="submit">Save change</button></form></article>`).join('');
}
async function load() { try { render(await api('/api/bookings')); } catch (error) { setMessage(error.message, 'error'); } }
list.addEventListener('click', async event => { const action = event.target.dataset.action; if (!action) return; const card = event.target.closest('[data-id]'); if (action === 'reschedule') return card.querySelector('.reschedule-form').classList.toggle('open'); if (!confirm(`Are you sure you want to ${action} this booking?`)) return; try { if (action === 'delete') await api(`/api/bookings/${card.dataset.id}`, { method: 'DELETE' }); else await api(`/api/bookings/${card.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }); setMessage(`Booking ${action}d successfully.`, 'success'); load(); } catch (error) { setMessage(error.message, 'error'); } });
list.addEventListener('submit', async event => { if (!event.target.matches('.reschedule-form')) return; event.preventDefault(); const card = event.target.closest('[data-id]'); const data = Object.fromEntries(new FormData(event.target)); try { await api(`/api/bookings/${card.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); setMessage('Booking rescheduled successfully.', 'success'); load(); } catch (error) { setMessage(error.message, 'error'); } });
load();
