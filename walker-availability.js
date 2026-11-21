(() => {
  const rules = window.AvailabilityRules;
  const profile = window.WalkerProfile;
  const account = profile.session();
  if (!profile.gate(account)) return;
  const key = `snifrWalkerAvailability:v1:${account.id}`;
  const select = selector => document.querySelector(selector);
  let days = [];
  let storedRaw = null;
  let selectedDate = rules.today();
  let visibleMonth = selectedDate.slice(0, 7);
  let editingId = null;
  let dirty = false;
  let confirmAction = null;
  const dialog = select('#confirm-dialog');
  const slotForm = select('#slot-form');

  function message(text, error = false) {
    select('#availability-message').textContent = text;
    select('#availability-message').className = `form-message ${error ? 'error' : 'success'}`;
  }

  function load() {
    const raw = localStorage.getItem(key);
    let next = [];
    if (raw !== null) {
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { throw new Error('Your saved schedule could not be read. It has not been overwritten.'); }
      if (parsed?.version !== 1) throw new Error('This schedule format is not supported. Your stored data has not been changed.');
      rules.validateDays(parsed.days);
      next = parsed.days;
    }
    days = next;
    storedRaw = raw;
  }

  function persist(transform, success, nextDate = selectedDate) {
    try {
      if (profile.session()?.id !== account.id) throw new Error('Your sign-in changed. Sign in to this walker account again before saving.');
      if (localStorage.getItem(key) !== storedRaw) {
        load(); resetSlot(); render();
        throw new Error('Your schedule changed in another tab. The latest version is now shown; review it and try again.');
      }
      const updated = transform(days);
      const raw = JSON.stringify({ version: 1, days: updated, savedAt: new Date().toISOString() });
      try { localStorage.setItem(key, raw); }
      catch { throw new Error('Your browser could not save the schedule. Allow site storage or free some space, then try again.'); }
      days = updated;
      storedRaw = raw;
      selectedDate = nextDate;
      visibleMonth = selectedDate.slice(0, 7);
      resetSlot(); render(); message(success);
      return true;
    } catch (error) { message(error.message, true); return false; }
  }

  function labelDate(date, options = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) {
    return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: rules.timezone }).format(new Date(`${date}T12:00:00+05:30`));
  }
  function labelTime(time) {
    const [hour, minute] = time.split(':').map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function confirmChange(title, copy, action, acceptText = 'Confirm') {
    select('#confirm-title').textContent = title;
    select('#confirm-copy').textContent = copy;
    select('#accept-confirm').textContent = acceptText;
    confirmAction = action;
    dialog.showModal();
  }
  function withCleanForm(action) {
    if (dirty) confirmChange('Discard this slot edit?', 'Your unsaved start and end times will be discarded.', () => { resetSlot(); action(); }, 'Discard edit');
    else action();
  }
  select('#cancel-confirm').addEventListener('click', () => dialog.close());
  select('#accept-confirm').addEventListener('click', () => { const action = confirmAction; dialog.close(); confirmAction = null; action?.(); });
  dialog.addEventListener('cancel', () => { confirmAction = null; });

  function resetSlot() {
    slotForm.reset(); editingId = null; dirty = false;
    select('#slot-form-heading').textContent = 'Add a time slot';
    select('#save-slot').textContent = 'Add slot';
    select('#cancel-slot-edit').hidden = true;
  }

  function selectDate(date) {
    withCleanForm(() => {
      selectedDate = date; visibleMonth = date.slice(0, 7);
      resetSlot(); render(); message('');
    });
  }

  function renderCalendar() {
    const currentDate = rules.today();
    const [year, month] = visibleMonth.split('-').map(Number);
    select('#calendar-heading').textContent = labelDate(`${visibleMonth}-01`, { month: 'long', year: 'numeric' });
    const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const calendar = select('#calendar-days');
    calendar.replaceChildren();
    for (let index = 0; index < firstWeekday; index++) calendar.append(element('span'));
    for (let dayNumber = 1; dayNumber <= length; dayNumber++) {
      const date = `${visibleMonth}-${String(dayNumber).padStart(2, '0')}`;
      const day = days.find(item => item.date === date);
      const button = element('button', String(dayNumber), 'calendar-day');
      button.type = 'button';
      button.dataset.date = date;
      button.disabled = date < currentDate && !day;
      button.classList.toggle('past', date < currentDate);
      button.classList.toggle('scheduled', !!day);
      button.setAttribute('aria-pressed', String(date === selectedDate));
      button.setAttribute('aria-label', `${labelDate(date)}${day ? `, ${day.slots.length} slots` : ', not scheduled'}${day?.slots.some(slot => slot.status === 'booked') ? ', has bookings' : ''}`);
      if (date === currentDate) button.setAttribute('aria-current', 'date');
      if (day?.slots.length) {
        const marker = element('span', '', `day-marker${day.slots.some(slot => slot.status === 'booked') ? ' booked' : ''}`);
        marker.setAttribute('aria-hidden', 'true'); button.append(marker);
      }
      button.addEventListener('click', () => selectDate(date));
      calendar.append(button);
    }
    select('#availability-date').min = currentDate;
    select('#availability-date').value = selectedDate;
    select('#move-date').min = currentDate;
  }

  function renderSlots() {
    const day = days.find(item => item.date === selectedDate);
    const past = selectedDate < rules.today();
    select('#selected-date-label').textContent = labelDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'short' });
    select('#day-description').textContent = past ? 'Past schedule · remove unused slots or move an unbooked date.' : 'Set specific times when you’re available. All times are IST.';
    select('#scheduled-day').hidden = !day;
    select('#unscheduled-day').hidden = !!day;
    select('#add-selected-date').disabled = past;
    select('#slot-list').replaceChildren();
    if (!day) return;
    const booked = day.slots.some(slot => slot.status === 'booked');
    select('#no-slots').hidden = day.slots.length > 0;
    slotForm.hidden = past;
    select('#move-date').value = selectedDate;
    select('#move-date').disabled = booked;
    select('#move-date-button').disabled = booked;
    select('#delete-date').disabled = booked;
    select('#booked-notice').hidden = !booked;
    for (const slot of [...day.slots].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const row = element('li', undefined, `slot-item ${slot.status}`);
      const info = element('div');
      info.append(element('strong', `${labelTime(slot.startTime)} – ${labelTime(slot.endTime)}`));
      info.append(element('small', slot.status === 'booked' ? 'Booked · protected' : past ? 'Past availability' : 'Available'));
      row.append(info);
      if (slot.status === 'available') {
        const controls = element('div', undefined, 'slot-buttons');
        if (!past) {
          const edit = element('button', 'Edit', 'text-button'); edit.type = 'button';
          edit.setAttribute('aria-label', `Edit ${labelTime(slot.startTime)} slot`);
          edit.addEventListener('click', () => withCleanForm(() => {
            editingId = slot.id;
            select('#start-time').value = slot.startTime;
            select('#end-time').value = slot.endTime;
            select('#slot-form-heading').textContent = 'Edit time slot';
            select('#save-slot').textContent = 'Save slot';
            select('#cancel-slot-edit').hidden = false;
            select('#start-time').focus(); message('');
          }));
          controls.append(edit);
        }
        const remove = element('button', 'Delete', 'text-button danger'); remove.type = 'button';
        remove.setAttribute('aria-label', `Delete ${labelTime(slot.startTime)} slot`);
        remove.addEventListener('click', () => confirmChange('Delete this slot?', `${labelTime(slot.startTime)} – ${labelTime(slot.endTime)} on ${labelDate(selectedDate)} will be removed from your draft.`, () => persist(current => rules.removeSlot(current, selectedDate, slot.id), 'Slot deleted from your browser draft.'), 'Delete slot'));
        controls.append(remove); row.append(controls);
      }
      select('#slot-list').append(row);
    }
  }

  function render() {
    renderCalendar(); renderSlots();
    const upcoming = days.filter(day => day.date >= rules.today());
    const futureSlots = upcoming.flatMap(day => day.slots.filter(slot => new Date(`${day.date}T${slot.startTime}:00+05:30`) > new Date()));
    select('#date-count').textContent = upcoming.length;
    select('#slot-count').textContent = futureSlots.filter(slot => slot.status === 'available').length;
    select('#booked-count').textContent = futureSlots.filter(slot => slot.status === 'booked').length;
    select('#no-dates').hidden = days.length > 0;
    const list = select('#saved-date-list'); list.replaceChildren();
    for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
      const button = element('button'); button.type = 'button';
      button.setAttribute('aria-pressed', String(day.date === selectedDate));
      button.append(element('strong', labelDate(day.date, { day: 'numeric', month: 'short', year: 'numeric' })), element('small', `${day.slots.length} slot${day.slots.length === 1 ? '' : 's'}${day.date < rules.today() ? ' · past' : ''}`));
      button.addEventListener('click', () => selectDate(day.date)); list.append(button);
    }
  }

  function changeMonth(offset) {
    const [year, month] = visibleMonth.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    if (date.getUTCFullYear() < 1970 || date.getUTCFullYear() > 9999) return;
    visibleMonth = date.toISOString().slice(0, 7); renderCalendar();
  }
  select('#previous-month').addEventListener('click', () => changeMonth(-1));
  select('#next-month').addEventListener('click', () => changeMonth(1));
  select('#this-month').addEventListener('click', () => selectDate(rules.today()));
  select('#add-date-form').addEventListener('submit', event => {
    event.preventDefault();
    const date = select('#availability-date').value;
    withCleanForm(() => persist(current => rules.addDate(current, date), 'Date added. Add your available times below.', date));
  });
  select('#add-selected-date').addEventListener('click', () => persist(current => rules.addDate(current, selectedDate), 'Date added. Add your available times below.'));
  slotForm.addEventListener('input', () => { dirty = true; });
  slotForm.addEventListener('submit', event => {
    event.preventDefault();
    const startTime = select('#start-time').value;
    const endTime = select('#end-time').value;
    if (!startTime || !endTime) { message('Enter both a start time and an end time.', true); select(!startTime ? '#start-time' : '#end-time').focus(); return; }
    const id = editingId || crypto.randomUUID();
    persist(current => rules.saveSlot(current, selectedDate, { id, startTime, endTime }, editingId), editingId ? 'Slot updated in your browser draft.' : 'Slot added to your browser draft.');
  });
  select('#cancel-slot-edit').addEventListener('click', () => withCleanForm(() => { resetSlot(); message('Slot edit cancelled.'); }));
  select('#move-date-form').addEventListener('submit', event => {
    event.preventDefault();
    const date = select('#move-date').value;
    withCleanForm(() => persist(current => rules.moveDate(current, selectedDate, date), 'Date and its slots moved.', date));
  });
  select('#delete-date').addEventListener('click', () => confirmChange('Delete this date?', `The date ${labelDate(selectedDate)} and all its unbooked slots will be removed from your draft.`, () => persist(current => rules.removeDate(current, selectedDate), 'Date and its slots deleted.'), 'Delete date'));
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('storage', event => {
    if (event.key === 'snifrSession' || event.key === null) {
      if (profile.session()?.id !== account.id) { dirty = false; dialog.close(); profile.gate(null); return; }
    }
    if (event.key === key || event.key === null) message('Your schedule changed in another tab. Reload to see the latest version before editing.', true);
  });

  try {
    load(); render();
    try {
      const draft = profile.load(account);
      select('#profile-notice').hidden = !!(draft?.completed && !Object.keys(profile.validate(draft.profile)).length);
    } catch { select('#profile-notice').hidden = false; }
  } catch (error) {
    message(error.message || 'Your availability could not be loaded. Allow site storage and reload.', true);
    select('#walker-workspace').querySelectorAll('input, button').forEach(control => { control.disabled = true; });
  }
})();
