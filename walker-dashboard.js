import { api,start,notice,button,row,list,panel,bookingTime,today,ordered,id } from './dashboard.js';

function schedule() {
  return panel(['profile','dates'],async () => {
    const { profile,availability } = await api('/api/dashboard/walker');
    list('profile',profile ? [row(profile.name || 'Walker profile',
      (profile.profileComplete ? 'Complete' : 'Incomplete') + ' · ' + profile.status + ' · ' + profile.reviewCount + ' reviews')] : [],
      'Complete your walker profile to publish your listing.');
    const dates = availability.filter(d => d.date >= today()).map(d => {
      const slots = d.slots.filter(s => s.status === 'available' && new Date(d.date+'T'+s.startTime+':00+05:30') > new Date());
      return slots.length ? row(d.date,slots.map(s => s.startTime + '–' + s.endTime + ' IST').join(', ')) : null;
    }).filter(Boolean);
    list('dates',dates,'No available dates scheduled.');
  });
}
async function change(b,status) {
  if (!confirm('Mark the walk for ' + b.petName + ' as ' + status + '?')) return;
  await api('/api/bookings/' + id(b),'PATCH',{status});
  notice('Booking ' + status + '.'); await Promise.all([bookings(),schedule()]);
}
function bookings() {
  return panel(['requests','upcoming','summary'],async () => {
    const records = ordered(await api('/api/bookings'));
    const requests = records.filter(b => b.status === 'pending');
    const upcoming = records.filter(b => b.status === 'accepted' && b.date >= today());
    list('requests',requests.map(b => row(b.petName,bookingTime(b),button('Accept',() => change(b,'accepted')),button('Reject',() => change(b,'rejected')))), 'No pending requests.');
    list('upcoming',upcoming.map(b => row(b.petName,bookingTime(b),button('Mark completed',() => change(b,'completed')))), 'No upcoming walks.');
    const states = ['pending','accepted','completed','rejected','cancelled'];
    const earnings = records.filter(b => b.status === 'completed').reduce((sum,b) => sum + b.rate,0);
    list('summary',[row('₹' + earnings.toLocaleString('en-IN') + ' earned',states.map(s => records.filter(b => b.status === s).length + ' ' + s).join(' · '))]);
  });
}
try { await start(); await Promise.all([schedule(),bookings()]); } catch(error) { notice(error.message); }
