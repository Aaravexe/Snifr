const test = require('node:test');
const assert = require('node:assert/strict');
const booking = require('../server/controllers/bookingController');

function call(handler, request) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); }
    };
    handler(request, response, reject);
  });
}

test('booking lifecycle rejects a duplicate slot and reopens it after cancellation', async () => {
  const details = await call(booking.getBookingDetails, { params: { walkerId: 'priyanka' } });
  assert.equal(details.status, 200);
  const day = details.body.data.availability.find(item => item.slots.length);
  assert.ok(day, 'an available test slot is required');

  const request = {
    body: {
      consumerId: `test-consumer-${Date.now()}`,
      walkerId: 'priyanka',
      petId: 'test-pet',
      petName: 'Test Pet',
      date: day.date,
      time: day.slots[0],
      durationMinutes: 60
    }
  };
  const created = await call(booking.createBooking, request);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'pending');

  const duplicate = await call(booking.createBooking, request);
  assert.equal(duplicate.status, 409);

  const id = created.body.data._id;
  const cancelled = await call(booking.updateBooking, { params: { id }, body: { status: 'cancelled' } });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'cancelled');

  const removed = await call(booking.deleteBooking, { params: { id } });
  assert.equal(removed.status, 200);
});
