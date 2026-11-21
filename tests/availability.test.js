const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/availability');

const now = new Date('2030-01-01T06:00:00Z'); // 11:30 IST
const date = '2030-01-02';
const slot = (id, startTime, endTime, extra = {}) => ({ id, startTime, endTime, status: 'available', bookingId: null, ...extra });

test('India calendar date is independent of the host timezone', () => {
  assert.equal(rules.today(new Date('2030-01-01T20:00:00Z')), '2030-01-02');
  assert.equal(rules.validDate('2030-02-29'), false);
  assert.equal(rules.validDate('2032-02-29'), true);
  assert.equal(rules.validDate('2030-02-30'), false);
  assert.equal(rules.validDate('2030-13-01'), false);
  assert.equal(rules.validTime('24:00'), false);
  assert.equal(rules.validTime('09:60'), false);
});

test('calendar date CRUD is immutable and rejects duplicate and past dates', () => {
  const original = [];
  const created = rules.addDate(original, date, now);
  assert.equal(original.length, 0);
  assert.equal(created[0].date, date);
  assert.throws(() => rules.addDate(created, date, now), /already/);
  assert.throws(() => rules.addDate([], '2029-12-31', now), /past/);
  const moved = rules.moveDate(created, date, '2030-01-03', now);
  assert.equal(moved[0].date, '2030-01-03');
  assert.equal(created[0].date, date);
  assert.equal(rules.removeDate(moved, '2030-01-03').length, 0);
});

test('slot CRUD preserves identity and returns sorted slots', () => {
  let days = rules.addDate([], date, now);
  days = rules.saveSlot(days, date, slot('later', '14:00', '15:00'), null, now);
  days = rules.saveSlot(days, date, slot('earlier', '09:00', '10:00'), null, now);
  assert.equal(days[0].slots[0].id, 'earlier');
  days = rules.saveSlot(days, date, slot('ignored', '10:00', '11:00'), 'earlier', now);
  assert.equal(days[0].slots[0].id, 'earlier');
  assert.equal(days[0].slots[0].startTime, '10:00');
  days = rules.removeSlot(days, date, 'earlier');
  assert.equal(days[0].slots.length, 1);
  assert.equal(days[0].slots[0].id, 'later');
});

test('overlapping and duplicate slots are rejected but adjacent slots are allowed', () => {
  const days = [{ date, slots: [slot('first', '09:00', '10:00')] }];
  for (const [start, end] of [['09:00', '10:00'], ['08:00', '09:30'], ['09:30', '10:30'], ['08:00', '11:00'], ['09:15', '09:45']]) {
    assert.throws(() => rules.saveSlot(days, date, slot('next', start, end), null, now), /overlaps/);
  }
  assert.equal(rules.saveSlot(days, date, slot('next', '10:00', '11:00'), null, now)[0].slots.length, 2);
  assert.throws(() => rules.saveSlot(days, date, slot('first', '10:00', '11:00'), null, now), /unique ID/);
  assert.equal(days[0].slots.length, 1);
});

test('same-day starts must be strictly in the future and intervals cannot cross midnight', () => {
  const today = [{ date: '2030-01-01', slots: [] }];
  assert.throws(() => rules.saveSlot(today, today[0].date, slot('one', '11:30', '12:30'), null, now), /future/);
  assert.throws(() => rules.saveSlot(today, today[0].date, slot('one', '11:00', '12:30'), null, now), /future/);
  assert.equal(rules.saveSlot(today, today[0].date, slot('one', '11:31', '12:30'), null, now)[0].slots.length, 1);
  assert.throws(() => rules.saveSlot([{ date, slots: [] }], date, slot('one', '23:00', '01:00'), null, now), /End time/);
  assert.throws(() => rules.saveSlot([{ date, slots: [] }], date, slot('one', '12:00', '12:00'), null, now), /End time/);
});

test('booked slots and their dates cannot be edited or removed', () => {
  const days = [{ date, slots: [slot('booked', '09:00', '10:00', { status: 'booked', bookingId: 'booking-1' })] }];
  assert.throws(() => rules.saveSlot(days, date, slot('booked', '10:00', '11:00'), 'booked', now), /Booked/);
  assert.throws(() => rules.removeSlot(days, date, 'booked'), /Booked/);
  assert.throws(() => rules.removeDate(days, date), /Booked/);
  assert.throws(() => rules.moveDate(days, date, '2030-01-03', now), /Booked/);
  assert.equal(rules.saveSlot(days, date, slot('free', '10:00', '11:00'), null, now)[0].slots.length, 2);
});

test('moving dates checks target conflicts and newly past times', () => {
  const days = [{ date, slots: [slot('first', '09:00', '10:00')] }, { date: '2030-01-03', slots: [] }];
  assert.throws(() => rules.moveDate(days, date, '2030-01-03', now), /already/);
  assert.throws(() => rules.moveDate(days, date, '2030-01-01', now), /future/);
});

test('corrupt stored schedules fail validation', () => {
  assert.throws(() => rules.validateDays(null));
  assert.throws(() => rules.validateDays([{ date, slots: [] }, { date, slots: [] }]), /more than one/);
  assert.throws(() => rules.validateDay({ date, slots: [slot('x', '09:00', '10:00', { status: 'booked' })] }), /reference a booking/);
  assert.throws(() => rules.validateDay({ date, slots: [slot('x', '09:00', '10:00', { bookingId: 'booking' })] }), /reference a booking/);
});
