const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const WalkerProfile = require('../server/models/WalkerProfile');
const WalkerAvailability = require('../server/models/WalkerAvailability');
const id = () => new mongoose.Types.ObjectId();
const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
const past = '2020-01-01';
const complete = () => ({ userId: id(), name: 'Test Walker', about: 'Patient dog walker with experience caring for senior dogs and giving regular updates.', experience: 0, hourlyRate: 250.50, services: ['walking'], area: 'Kothrud', city: 'Pune', pincode: '411038', image: 'assets/walker.png' });
const schedule = (extra = {}) => ({ walkerId: id(), date: tomorrow, slots: [{ startTime: '09:00', endTime: '10:00' }], ...extra });

test('profile supports an incomplete registration marker but cannot publish it', async () => {
  const document = new WalkerProfile({ userId: id() });
  await document.validate();
  assert.equal(document.status, 'draft');
  assert.equal(document.profileComplete, false);
  await assert.rejects(document.publish(), { name: 'ValidationError' });
  assert.equal(document.status, 'draft');
});

test('complete profiles publish and serialize their completion state', async () => {
  const document = new WalkerProfile(complete());
  await document.publish();
  assert.equal(document.status, 'published');
  assert.equal(document.profileComplete, true);
  assert.equal(document.toJSON().profileComplete, true);
});

test('profile schema rejects bad field values and incomplete published profiles', async () => {
  const invalid = [
    { hourlyRate: -1 }, { hourlyRate: 5.123 }, { hourlyRate: Infinity }, { experience: 1.5 },
    { name: ' ' }, { about: 'short' }, { pincode: '12345' }, { services: ['unknown'] },
    { services: ['walking', 'walking'] }, { services: [], status: 'published' },
    { image: 'javascript:alert(1)' }, { rating: 6 }, { reviewCount: -1 }
  ];
  for (const values of invalid) await assert.rejects(new WalkerProfile({ ...complete(), ...values }).validate());
});

test('models declare references, timestamps, concurrency checks and uniqueness indexes', () => {
  assert.equal(WalkerProfile.schema.path('userId').options.ref, 'User');
  assert.equal(WalkerAvailability.schema.path('walkerId').options.ref, 'WalkerProfile');
  assert.equal(WalkerAvailability.schema.options.optimisticConcurrency, true);
  assert.ok(WalkerProfile.schema.path('createdAt'));
  assert.ok(WalkerAvailability.schema.path('updatedAt'));
  assert.ok(WalkerProfile.schema.indexes().some(([fields, options]) => fields.userId === 1 && options.unique));
  assert.ok(WalkerAvailability.schema.indexes().some(([fields, options]) => fields.walkerId === 1 && fields.date === 1 && options.unique));
});

test('availability model rejects past dates, overlaps, malformed intervals and booking mismatches', async () => {
  for (const values of [
    { date: past }, { date: '2030-02-30' }, { timezone: 'UTC' },
    { slots: [{ startTime: '09:00', endTime: '09:00' }] },
    { slots: [{ startTime: '25:00', endTime: '26:00' }] },
    { slots: [{ startTime: '09:00', endTime: '10:00' }, { startTime: '09:30', endTime: '10:30' }] },
    { slots: [{ startTime: '09:00', endTime: '10:00', status: 'booked' }] },
    { slots: [{ startTime: '09:00', endTime: '10:00', bookingId: id() }] }
  ]) await assert.rejects(new WalkerAvailability(schedule(values)).validate());
});

test('availability model exposes slot CRUD and date moves without touching MongoDB', async () => {
  const document = new WalkerAvailability(schedule({ slots: [] }));
  document.addSlot('09:00', '10:00');
  const slotId = document.slots[0]._id;
  document.updateSlot(slotId, '10:00', '11:00');
  assert.equal(String(document.slots[0]._id), String(slotId));
  assert.equal(document.slots[0].startTime, '10:00');
  await document.validate();
  document.removeSlot(slotId);
  assert.equal(document.slots.length, 0);
  document.moveToDate('2099-01-01');
  assert.equal(document.date, '2099-01-01');
});

test('model helper methods protect booked slots', () => {
  const document = new WalkerAvailability(schedule({ slots: [{ startTime: '09:00', endTime: '10:00', status: 'booked', bookingId: id() }] }));
  const slotId = document.slots[0]._id;
  assert.throws(() => document.updateSlot(slotId, '11:00', '12:00'), /Booked/);
  assert.throws(() => document.removeSlot(slotId), /Booked/);
  assert.throws(() => document.moveToDate('2099-01-01'), /Booked/);
  assert.throws(() => document.assertCanDelete(), /Booked/);
});

test('historical loaded schedules remain valid but new past slots are rejected', async () => {
  const document = WalkerAvailability.hydrate({ _id: id(), ...schedule({ date: past }), slots: [{ _id: id(), startTime: '09:00', endTime: '10:00', status: 'available', bookingId: null }] });
  await document.validate();
  document.slots.push({ startTime: '11:00', endTime: '12:00' });
  await assert.rejects(document.validate(), /past/);
});

test('direct document edits cannot remove or move a loaded booked slot', async () => {
  for (const change of [doc => { doc.slots = []; }, doc => { doc.slots[0].endTime = '11:00'; }, doc => { doc.date = '2099-01-01'; }]) {
    const document = WalkerAvailability.hydrate({ _id: id(), ...schedule({ slots: [{ _id: id(), startTime: '09:00', endTime: '10:00', status: 'booked', bookingId: id() }] }) });
    change(document);
    await assert.rejects(document.validate(), /Booked/);
  }
});
