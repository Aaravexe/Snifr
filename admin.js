import { $, id, api, start, notice, button, node, row, list, editor, petFields, reviewFields, bookingTime, today } from './dashboard.js';

const names = ['Users','Walkers','Availability','Bookings','Pets','Reviews'];
let active = 'Users', walkerId = '', generation = 0;
const text = (key,label,more = {}) => ({key,label,...more});
const options = (records,label) => records.map(r => [id(r),label(r)]);
const userLabel = u => u.displayName + ' · ' + u.email;
const walkerLabel = w => w.name || 'Draft for ' + w.userId;
const collectionPath = () => active === 'Availability' ? '/api/walkers/' + encodeURIComponent(walkerId) + '/availability' : '/api/' + active.toLowerCase();
const titles = {
  Users: userLabel, Walkers: walkerLabel, Availability: r => r.date, Bookings: r => r.petName + ' with ' + r.walkerName,
  Pets: r => r.name, Reviews: r => r.rating + ' / 5 stars'
};
const subtitles = {
  Users: r => r.role + ' · ' + (r.isActive ? 'Active' : 'Inactive'), Walkers: r => r.status + ' · ₹' + (r.hourlyRate ?? 0) + '/hr',
  Availability: r => r.slots.map(s => s.startTime + '–' + s.endTime + ' ' + s.status).join(', ') || 'No slots',
  Bookings: bookingTime, Pets: r => r.breed + ' · Age ' + r.age, Reviews: r => r.comment || 'Booking ' + r.bookingId
};
async function formFields(name,r) {
  switch (name) {
    case 'Users': return [text('displayName','Display name',{maxLength:80}),text('email','Email',{type:'email'}),
      ...(r ? [text('isActive','Account status',{options:[['true','Active'],['false','Inactive']],parse:v => v === 'true'})] :
        [text('role','Account type',{options:['consumer','walker','admin']})]),
      text('password',r ? 'New password (optional)' : 'Password',{type:'password',optional:!!r,omitBlank:true,maxLength:200})];
    case 'Walkers': {
      const owner = r ? [] : [text('userId','Walker account',{options:options((await api('/api/users')).filter(u => u.role === 'walker' && u.isActive),userLabel)})];
      return [...owner,text('name','Walker name',{maxLength:80}),text('about','Biography',{type:'textarea',maxLength:1200}),
        text('experience','Years of experience',{type:'number',min:0,max:60}),text('hourlyRate','Hourly rate (₹)',{type:'number',min:1,max:10000,step:.01}),
        text('services','Services (walking, sitting, drop-in)',{format:v => v.join(', '),parse:v => v.split(',').map(x => x.trim())}),
        text('area','Area'),text('city','City'),text('pincode','PIN code',{pattern:'[1-9][0-9]{5}'}),
        text('image','Profile image URL or asset path',{value:'assets/walker.png'}),text('status','Listing status',{options:['draft','published']})];
    }
    case 'Availability': return [text('date','Date',{type:'date',min:today()}),
      text('slots','Time slots, one per line (09:00–10:00)',{type:'textarea',optional:true,format:slots => slots.map(s => s.startTime+'–'+s.endTime).join('\n'),
        parse:v => v ? v.split('\n').map(line => {
          const match = /^(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})$/.exec(line.trim());
          if (!match) throw new Error('Enter each time range as HH:mm–HH:mm.');
          const old = r?.slots.find(s => s.startTime === match[1] && s.endTime === match[2]);
          return { ...(old ? {_id:old._id} : {}), startTime:match[1], endTime:match[2] };
        }) : []})];
    case 'Pets': return [...(r ? [] : [text('consumerId','Pet owner',{options:options((await api('/api/users')).filter(u => u.role === 'consumer' && u.isActive),userLabel)})]),...petFields];
    case 'Reviews': return [...(r ? [] : [text('bookingId','Completed walk',{options:options((await api('/api/bookings')).filter(b => b.status === 'completed'),b => titles.Bookings(b)+' · '+b.date)})]),...reviewFields];
    case 'Bookings': {
      const notes = text('notes','Notes',{type:'textarea',maxLength:500,optional:true});
      const date = text('date','Walk date',{type:'date',min:today()});
      const time = text('time','Start time (e.g. 9:00 AM)',{pattern:'([1-9]|1[0-2]):[0-5][0-9] (AM|PM)'});
      if (r) return [...(['pending','accepted'].includes(r.status) ? [date,time] : []),
        text('status','Booking status',{options:['pending','accepted','rejected','completed','cancelled']}),notes];
      const [pets,walkers] = await Promise.all([api('/api/pets'),api('/api/walkers')]);
      return [text('petId','Pet and owner',{options:options(pets,p => p.name + ' · ' + p.consumerId)}),
        text('walkerId','Walker',{options:options(walkers.filter(w => w.status === 'published'),walkerLabel)}),
        date,time,text('durationMinutes','Walk duration in minutes',{options:['30','60','90','120','180','240'],parse:Number}),notes];
    }
  }
}
async function edit(record) {
  const name = active, path = collectionPath(), version = generation;
  const fields = await formFields(name,record);
  if (version !== generation) return;
  editor((record ? 'Edit ' : 'Add ') + ({Availability:'availability',Bookings:'booking',Reviews:'review',Users:'user',Walkers:'walker',Pets:'pet'})[name],fields,record,async data => {
    if (name === 'Bookings' && !record) {
      const pet = await api('/api/pets/' + encodeURIComponent(data.petId)); data.consumerId = pet.consumerId; data.petName = pet.name;
    }
    if (record && name === 'Bookings') {
      for (const k of ['time','date','status']) if (data[k] === record[k]) delete data[k];
    }
    await api(path + (record ? '/' + encodeURIComponent(id(record)) : ''),record ? 'PATCH' : 'POST',data);
    notice('Saved.'); await load();
  });
}
async function remove(record) {
  if (!confirm('Delete ' + titles[active](record) + '?')) return;
  await api(collectionPath() + '/' + encodeURIComponent(id(record)),'DELETE');
  notice('Record deleted.'); await load();
}
async function load() {
  const version = ++generation;
  $('collection').textContent = active; $('records').textContent = 'Loading…'; $('parent').replaceChildren(); $('add').disabled = true;
  for (const b of $('tabs').children) { b.setAttribute('aria-pressed',String(b.textContent === active)); b.className = b.textContent === active ? '' : 'quiet'; }
  try {
    if (active === 'Availability') {
      const walkers = await api('/api/walkers'); if (version !== generation) return;
      if (!walkers.length) { $('records').textContent = 'Create a walker before adding availability.'; return; }
      const select = node('select'), label = node('label','Walker');
      for (const w of walkers) select.add(new Option(walkerLabel(w),id(w)));
      if (walkers.some(w => id(w) === walkerId)) select.value = walkerId;
      walkerId = select.value; select.onchange = () => { walkerId = select.value; load(); };
      label.append(select); $('parent').append(label);
    }
    const records = await api(collectionPath()); if (version !== generation) return;
    list('records',records.map(r => row(titles[active](r),subtitles[active](r),button('Edit',() => edit(r)),button('Delete',() => remove(r)))),'No records in this collection.');
    $('add').disabled = false;
  } catch (error) { if (version === generation) $('records').replaceChildren(node('p',error.message),button('Retry',load)); }
}
try {
  await start();
  for (const name of names) $('tabs').append(button(name,async () => { active = name; notice(''); await load(); }));
  $('add').onclick = () => edit().catch(error => notice(error.message));
  await load();
} catch (error) { notice(error.message); }
