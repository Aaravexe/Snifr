import { $, id, api, start, notice, button, link, row, list, panel, editor, petFields, reviewFields, today, ordered, bookingTime } from './dashboard.js';

let user;
function editPet(pet) {
  editor(pet ? 'Edit pet' : 'Add pet', petFields, pet, async data => {
    await api('/api/pets' + (pet ? '/' + id(pet) : ''), pet ? 'PATCH' : 'POST', data);
    notice('Pet saved.'); await pets();
  });
}
function legacyPets() {
  // The old key was shared across accounts. Let the signed-in owner claim individual pets.
  const raw = localStorage.getItem('snifrPets');
  if (!raw) return [];
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error('This browser’s old pet list could not be read.');
  return entries;
}
async function importPet(index, original) {
  if (!confirm('Import ' + original.name + ' into ' + user.displayName + '’s account?')) return;
  const entries = legacyPets(), pet = entries[index];
  if (!pet || JSON.stringify(pet) !== JSON.stringify(original)) return pets();
  if (pet.importOwner && pet.importOwner !== user.id) throw new Error('Finish this import from its original account.');
  pet.importKey ||= crypto.randomUUID();
  pet.importOwner = user.id;
  localStorage.setItem('snifrPets',JSON.stringify(entries));
  await api('/api/pets','POST',{ name:pet.name, breed:pet.breed, age:Number(pet.age), importKey:pet.importKey });
  const remaining = legacyPets().filter(entry => entry.importKey !== pet.importKey);
  if (remaining.length) localStorage.setItem('snifrPets',JSON.stringify(remaining));
  else localStorage.removeItem('snifrPets');
  notice('Pet imported.'); await pets();
}
function pets() {
  return panel(['pets'],async () => {
    const records = await api('/api/pets');
    list('pets', records.map(p => row(p.name,p.breed + ' · ' + p.age + ' years',
      button('Edit',() => editPet(p)), button('Delete',async () => {
        if (!confirm('Delete ' + p.name + '?')) return;
        await api('/api/pets/' + id(p),'DELETE'); notice('Pet deleted.'); await pets();
      }))), 'Add your first pet to book a walk.');
    try {
      legacyPets().forEach((pet,i) => {
        if (pet && (!pet.importOwner || pet.importOwner === user.id)) $('pets').append(row(pet.name,'Saved in this browser',button('Import pet',() => importPet(i,pet))));
      });
    } catch { $('pets').append('The old browser pet list could not be imported.'); }
  });
}
function editReview(booking,review) {
  editor(review ? 'Edit review' : 'Review your walk',reviewFields,review,async data => {
    await api('/api/reviews' + (review ? '/' + id(review) : ''),review ? 'PATCH' : 'POST',review ? data : { ...data, bookingId:id(booking) });
    notice('Review saved.'); await Promise.all([bookings(),reviews(),recommendations()]);
  });
}
function bookings() {
  return panel(['upcoming','history'], async () => {
    const all = ordered(await api('/api/bookings'));
    const upcoming = b => ['pending','accepted'].includes(b.status) && b.date >= today();
    const render = b => row(b.petName + ' with ' + b.walkerName,bookingTime(b),link('Manage booking','/my-bookings'));
    list('upcoming',all.filter(upcoming).map(render),'No upcoming bookings.');
    const history = all.filter(b => !upcoming(b)).reverse();
    list('history',history.map(render),'Completed and past bookings will appear here.');
    const completed = history.filter(b => b.status === 'completed');
    if (completed.length) {
      const existing = await api('/api/reviews');
      for (const b of completed.filter(b => !existing.some(r => r.bookingId === id(b)))) {
        const index = history.indexOf(b);
        $('history').children[index].append(button('Write a review',() => editReview(b)));
      }
    }
  });
}
function reviews() {
  return panel(['reviews'],async () => {
    const records = await api('/api/reviews');
    list('reviews',records.map(r => row(r.rating + ' / 5 stars',r.comment || 'Walk review',
      button('Edit',() => editReview(null,r)), button('Delete',async () => {
        if (!confirm('Delete this review?')) return;
        await api('/api/reviews/' + id(r),'DELETE'); notice('Review deleted.');
        await Promise.all([reviews(),bookings(),recommendations()]);
      }))), 'Your reviews will appear here after a completed walk.');
  });
}
function recommendations() {
  return panel(['walkers'],async () => {
    const walkers = await api('/api/walkers');
    list('walkers',walkers.slice(0,6).map(w => row(w.name,w.city + ' · ₹' + w.hourlyRate + '/hr · ' +
      (w.reviewCount ? Number(w.rating).toFixed(1) + '/5 (' + w.reviewCount + ' reviews)' : 'No reviews yet'),
      link('View walker','/walker/' + encodeURIComponent(id(w))))),'No published walkers yet.');
  });
}
try {
  user = await start();
  const welcomeName = $('welcome-name');
  if (welcomeName) welcomeName.textContent = user.displayName;
  $('add-pet').onclick = () => editPet();
  await Promise.all([pets(),recommendations(),bookings(),reviews()]);
} catch (error) { notice(error.message); }
