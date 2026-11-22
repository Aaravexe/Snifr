/* Calendar dates and wall-clock times are always in Asia/Kolkata (UTC+05:30).
   Shared by the browser draft editor and the MongoDB availability model. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AvailabilityRules = factory();
})(typeof window === 'object' ? window : globalThis, () => {
  const timezone = 'Asia/Kolkata';

  function today(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

  function assertFuture(date, startTime, now = new Date()) {
    if (!validDate(date)) throw new Error('Choose a valid calendar date.');
    if (date < today(now)) throw new Error('Availability cannot be added or moved to a past date.');
    if (startTime !== undefined && (!validTime(startTime) || new Date(`${date}T${startTime}:00+05:30`).getTime() <= now.getTime())) {
      throw new Error('Choose a start time in the future (India time).');
    }
  }

  function validateDay(day) {
    if (!day || !validDate(day.date) || !Array.isArray(day.slots)) throw new Error('Availability contains an invalid date or slot list.');
    const ids = new Set();
    for (const slot of day.slots) {
      if (!slot || !slot.id || ids.has(String(slot.id))) throw new Error('Each slot must have a unique ID.');
      ids.add(String(slot.id));
      if (!validTime(slot.startTime) || !validTime(slot.endTime) || slot.startTime >= slot.endTime) throw new Error('End time must be after start time on the same day.');
      if (!['available', 'booked'].includes(slot.status)) throw new Error('Invalid slot status.');
      if ((slot.status === 'booked') !== !!slot.bookingId) throw new Error('Booked slots must reference a booking; available slots cannot.');
    }
    const sorted = [...day.slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let index = 1; index < sorted.length; index++) {
      if (sorted[index].startTime < sorted[index - 1].endTime) throw new Error('This time overlaps an existing slot. Choose a different time.');
    }
    return true;
  }

  function validateDays(days) {
    if (!Array.isArray(days)) throw new Error('The saved availability could not be read.');
    const dates = new Set();
    for (const day of days) {
      validateDay(day);
      if (dates.has(day.date)) throw new Error('There is more than one record for this date.');
      dates.add(day.date);
    }
    return true;
  }

  function change(days, action) {
    validateDays(days);
    const copy = JSON.parse(JSON.stringify(days));
    action(copy);
    validateDays(copy);
    copy.forEach(day => day.slots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return copy.sort((a, b) => a.date.localeCompare(b.date));
  }

  function findDay(days, date) {
    const day = days.find(item => item.date === date);
    if (!day) throw new Error('This date no longer exists. Select another date.');
    return day;
  }

  function assertEditable(slot) {
    if (slot.status === 'booked' || slot.bookingId) throw new Error('Booked slots cannot be changed or deleted. Manage the booking first.');
  }

  function addDate(days, date, now) {
    assertFuture(date, undefined, now);
    return change(days, copy => {
      if (copy.some(day => day.date === date)) throw new Error('This date is already on your calendar. Select it to add a slot.');
      copy.push({ date, slots: [] });
    });
  }

  function moveDate(days, date, nextDate, now) {
    assertFuture(nextDate, undefined, now);
    return change(days, copy => {
      const day = findDay(copy, date);
      if (date === nextDate) throw new Error('Choose a different date to move this schedule.');
      if (copy.some(item => item.date === nextDate)) throw new Error('The new date already has a schedule. Add slots to that date instead.');
      day.slots.forEach(slot => { assertEditable(slot); assertFuture(nextDate, slot.startTime, now); });
      day.date = nextDate;
    });
  }

  function removeDate(days, date) {
    return change(days, copy => {
      findDay(copy, date).slots.forEach(assertEditable);
      copy.splice(copy.findIndex(day => day.date === date), 1);
    });
  }

  function saveSlot(days, date, slot, editingId = null, now) {
    assertFuture(date, slot.startTime, now);
    return change(days, copy => {
      const day = findDay(copy, date);
      const next = { id: editingId || slot.id, startTime: slot.startTime, endTime: slot.endTime, status: 'available', bookingId: null };
      if (editingId) {
        const index = day.slots.findIndex(item => item.id === editingId);
        if (index < 0) throw new Error('This slot no longer exists.');
        assertEditable(day.slots[index]);
        day.slots[index] = next;
      } else day.slots.push(next);
    });
  }

  function removeSlot(days, date, id) {
    return change(days, copy => {
      const day = findDay(copy, date);
      const index = day.slots.findIndex(slot => slot.id === id);
      if (index < 0) throw new Error('This slot no longer exists.');
      assertEditable(day.slots[index]);
      day.slots.splice(index, 1);
    });
  }

  return { timezone, today, validDate, validTime, assertFuture, validateDay, validateDays, addDate, moveDate, removeDate, saveSlot, removeSlot };
});
