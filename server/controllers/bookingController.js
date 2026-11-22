const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const WalkerProfile = require('../models/WalkerProfile');
const Availability = require('../models/WalkerAvailability');
const Review = require('../models/Review');
const rules = require('../../shared/availability');
const { fail } = require('../middleware/dashboardAccess');
const { readAll, saveAll } = require('../services/bookingStore');
const { readBackups, writeBackup, removeBackup } = require('../services/bookingJsonBackup');

const ACTIVE_STATUSES = ['pending', 'accepted'];
const ALLOWED_STATUSES = ['accepted', 'rejected', 'completed', 'cancelled'];
const PLATFORM_FEE = 30;
const fallbackWalkersFile = path.join(__dirname, '..', '..', 'walkers.json');
const response = (res, status, data = null, message = '') => res.status(status).json({ success: status < 400, data, message });
const serialize = item => item && typeof item.toObject === 'function' ? item.toObject() : item;
const idOf = item => String(item?._id || item?.id || item?.bookingId || '');
const mongoReady = () => mongoose.connection.readyState === 1;

function idQuery(value) {
  const matches = [{ _id: value }, { id: value }, { userId: value }];
  if (mongoose.isValidObjectId(value)) matches.unshift({ _id: new mongoose.Types.ObjectId(value) });
  return { $or: matches };
}

function dateIsFuture(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const selected = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(selected.getTime()) && selected > today;
}

function standardTime(value) {
  return /^([1-9]|1[0-2]):[0-5]\d\s(AM|PM)$/.test(String(value));
}

async function allBookings() {
  return mongoReady() ? Booking.find().lean() : readAll();
}

async function findBooking(id) {
  if (mongoReady()) return mongoose.isObjectIdOrHexString(id) ? Booking.findById(id).lean() : null;
  return (await readAll()).find(item => idOf(item) === String(id)) || null;
}

async function persistBooking(booking, isNew = false) {
  let saved;
  if (mongoReady()) {
    saved = isNew ? await Booking.create(booking) : await Booking.findByIdAndUpdate(booking._id, booking, { returnDocument:'after', runValidators: true });
    saved = serialize(saved);
  } else {
    const bookings = await readAll();
    const record = { ...booking, _id: booking._id || `booking-${Date.now()}`, updatedAt: new Date().toISOString() };
    if (isNew) record.createdAt = record.updatedAt;
    const index = bookings.findIndex(item => idOf(item) === idOf(record));
    if (index < 0) bookings.push(record); else bookings[index] = record;
    await saveAll(bookings);
    saved = record;
  }
  await writeBackup(saved);
  return saved;
}

async function loadFallbackWalker(walkerId) {
  const parsed = JSON.parse(await fs.readFile(fallbackWalkersFile, 'utf8'));
  return (parsed.walkers || []).find(item => item.id === walkerId) || null;
}

async function getWalkerDetails(walkerId) {
  if (mongoReady() && mongoose.isObjectIdOrHexString(walkerId)) {
    const w = await WalkerProfile.findOne({ _id: walkerId, status: 'published' });
    if (!w) return null;
    const reviews = await Review.find({ walkerId }).select('rating comment').sort({ createdAt: -1 }).limit(20).lean();
    return { id: w.id, name:w.name, hourlyRate:w.hourlyRate, image:w.image, about:w.about,
      walksCompleted:w.walksCompleted, rating:w.rating, reviewCount:w.reviewCount,
      reviews:reviews.map(r => ({ name:'Verified consumer', rating:r.rating, text:r.comment })) };
  }
  const walker = await loadFallbackWalker(walkerId);
  return walker && { id: walker.id, name: walker.name, hourlyRate: walker.hourlyRate, image: walker.image, about: walker.about, rating: walker.rating, reviewCount: walker.reviewCount, reviews: walker.reviews || [] };
}

async function timeIsAvailable(walkerId, date, time, exceptId = '') {
  const conflicting = (await allBookings()).some(item =>
    String(item.walkerId) === String(walkerId) && item.date === date && item.time === time &&
    ACTIVE_STATUSES.includes(item.status) && idOf(item) !== String(exceptId)
  );
  if (conflicting) return false;

  if (!mongoReady() || !mongoose.isObjectIdOrHexString(walkerId)) return true;
  const day = await Availability.findOne({ walkerId, date }).lean();
  return day?.slots.some(s => displayTime(s.startTime) === time && (s.status === 'available' || String(s.bookingId) === exceptId));
}

function displayTime(value) {
  const [h,m] = value.split(':');
  return (Number(h) % 12 || 12) + ':' + m + (Number(h) < 12 ? ' AM' : ' PM');
}

async function updateAvailability(booking, available) {
  if (!mongoReady() || !mongoose.isObjectIdOrHexString(booking.walkerId)) return;
  const [clock,period] = booking.time.split(' '), [h,m] = clock.split(':');
  const startTime = String(Number(h) % 12 + (period === 'PM' ? 12 : 0)).padStart(2,'0') + ':' + m;
  const slot = available ? { startTime, bookingId:booking._id } : { startTime, $or:[{ status:'available' },{ bookingId:booking._id }] };
  const result = await Availability.updateOne({ walkerId:booking.walkerId, date:booking.date, slots:{ $elemMatch:slot } },
    { $set:{ 'slots.$.status':available ? 'available' : 'booked','slots.$.bookingId':available ? null : booking._id }, $inc:{ __v:1 } });
  if (!available && !result.matchedCount) throw fail(409, 'This time slot is unavailable.');
}

async function createBooking(req, res, next) {
  try {
    const { consumerId, walkerId, petId, petName, date, time, durationMinutes = 60, notes = '' } = req.body;
    if (![consumerId, walkerId, petId, petName, date, time].every(value => String(value || '').trim())) return response(res, 400, null, 'Consumer, walker, pet, date and time are required.');
    if (!dateIsFuture(date)) return response(res, 400, null, 'Choose a future date.');
    if (!standardTime(time)) return response(res, 400, null, 'Choose a valid time slot.');
    if (![30, 60, 90, 120, 180, 240].includes(Number(durationMinutes))) return response(res, 400, null, 'Choose a supported walk duration.');
    const walker = await getWalkerDetails(String(walkerId));
    if (!walker || !Number.isFinite(walker.hourlyRate)) return response(res, 404, null, 'Walker profile could not be found.');
    if (mongoReady()) {
      const [consumer, savedPet] = await Promise.all([
        mongoose.connection.db.collection('users').findOne(idQuery(String(consumerId))),
        mongoose.connection.db.collection('pets').findOne(idQuery(String(petId)))
      ]);
      if (!consumer && req.user?.id !== consumerId) return response(res, 404, null, 'Consumer account could not be found.');
      if (!savedPet) return response(res, 404, null, 'Pet could not be found.');
      if (String(savedPet.consumerId) !== String(consumerId)) return response(res, 403, null, 'Choose a pet belonging to this consumer.');
    }
    if (!(await timeIsAvailable(String(walkerId), date, time))) return response(res, 409, null, 'That time slot has just been booked. Please choose another slot.');
    const rate = Number((walker.hourlyRate * Number(durationMinutes) / 60).toFixed(2));
    const booking = await persistBooking({ consumerId: String(consumerId), walkerId: String(walkerId), petId: String(petId), petName: String(petName).trim(), walkerName: walker.name, date, time, durationMinutes: Number(durationMinutes), rate, platformFee: PLATFORM_FEE, total: rate + PLATFORM_FEE, status: 'pending', notes: String(notes).trim() }, true);
    await updateAvailability(booking, false);
    response(res, 201, booking, 'Booking request created and backed up locally.');
  } catch (error) { next(error); }
}

async function listBookings(req, res, next) {
  try {
    let bookings = (await allBookings()).filter(item => !req.bookingScope || req.bookingScope(item));
    const { consumerId, walkerId, status } = req.query;
    if (consumerId) bookings = bookings.filter(item => String(item.consumerId) === String(consumerId));
    if (walkerId) bookings = bookings.filter(item => String(item.walkerId) === String(walkerId));
    if (status) bookings = bookings.filter(item => item.status === status);
    bookings.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    response(res, 200, bookings, 'Bookings loaded.');
  } catch (error) { next(error); }
}

async function getBooking(req, res, next) {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking) return response(res, 404, null, 'Booking not found.');
    response(res, 200, booking, 'Booking loaded.');
  } catch (error) { next(error); }
}

async function getLatestBooking(req, res, next) {
  try {
    const bookings = (await allBookings()).filter(item => !req.bookingScope || req.bookingScope(item));
    const latest = bookings.sort((a, b) => Date.parse(b.createdAt || b.updatedAt || 0) - Date.parse(a.createdAt || a.updatedAt || 0))[0] || null;
    response(res, 200, latest, latest ? 'Latest booking loaded.' : 'No bookings found.');
  } catch (error) { next(error); }
}

async function updateBooking(req, res, next) {
  try {
    const original = await findBooking(req.params.id);
    if (!original) return response(res, 404, null, 'Booking not found.');
    const { date, time, status, notes } = req.body;
    const booking = { ...original };
    if (date || time) {
      const nextDate = date || booking.date;
      const nextTime = time || booking.time;
      if (!dateIsFuture(nextDate) || !standardTime(nextTime)) return response(res, 400, null, 'Enter a future date and valid time slot.');
      if (!ACTIVE_STATUSES.includes(booking.status)) return response(res, 400, null, 'Only pending or accepted bookings can be rescheduled.');
      if (!(await timeIsAvailable(booking.walkerId, nextDate, nextTime, req.params.id))) return response(res, 409, null, 'The requested reschedule slot is not available.');
      await updateAvailability(booking, true);
      booking.date = nextDate;
      booking.time = nextTime;
      await updateAvailability(booking, false);
    }
    if (notes !== undefined) booking.notes = String(notes).trim();
    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) return response(res, 400, null, 'Invalid booking status.');
      if (booking.status === 'completed' && status !== 'completed') return response(res, 400, null, 'Completed walks cannot be changed.');
      booking.status = status;
      await updateAvailability(booking, ['rejected', 'cancelled'].includes(status));
    }
    const saved = await persistBooking(booking);
    response(res, 200, saved, 'Booking updated and JSON backup synchronized.');
  } catch (error) { next(error); }
}

async function deleteBooking(req, res, next) {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking) return response(res, 404, null, 'Booking not found.');
    if (mongoReady() && await Review.exists({ bookingId: req.params.id })) return response(res,409,null,'Remove the booking review before deleting this booking.');
    if (mongoReady()) await Booking.findByIdAndDelete(req.params.id);
    else await saveAll((await readAll()).filter(item => idOf(item) !== String(req.params.id)));
    await updateAvailability(booking, true);
    await removeBackup(req.params.id);
    response(res, 200, { id: req.params.id }, 'Booking deleted and its availability slot reopened.');
  } catch (error) { next(error); }
}

async function getBookingDetails(req, res, next) {
  try {
    const walker = await getWalkerDetails(req.params.walkerId);
    if (!walker) return response(res, 404, null, 'Walker profile could not be found.');
    if (mongoReady() && mongoose.isObjectIdOrHexString(walker.id)) {
      const days = await Availability.find({ walkerId:walker.id, date:{ $gt:rules.today() } }).sort({ date:1 }).lean();
      const availability = days.map(d => ({ date:d.date, slots:d.slots.filter(s => s.status === 'available').map(s => displayTime(s.startTime)) }));
      return response(res,200,{walker,availability},'Walker and available times loaded.');
    }
    const localDate = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const dates = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + index + 1);
      return localDate(date);
    });
    const all = await allBookings();
    const availability = dates.map(date => ({ date, slots: ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'].filter(time => !all.some(item => String(item.walkerId) === String(req.params.walkerId) && item.date === date && item.time === time && ACTIVE_STATUSES.includes(item.status))) }));
    response(res, 200, { walker, availability }, 'Walker profile and available booking slots loaded.');
  } catch (error) { next(error); }
}

async function localBackups(req, res, next) {
  try { response(res, 200, await readBackups(), 'Local JSON booking backup loaded.'); } catch (error) { next(error); }
}

// Scope the existing booking handlers to the identity verified at sign-in.
async function bindBookingScope(req, res, next) {
  const user = req.user;
  if (user.role === 'admin') return next();
  const consumer = user.role === 'consumer';
  let owner = user.id;
  if (!consumer) {
    const profile = mongoReady() && mongoose.isObjectIdOrHexString(owner)
      ? await WalkerProfile.findOne({ userId: owner }).select('_id') : null;
    owner = profile?.id || user.walkerId || owner;
  }
  const owners = [owner,consumer ? user.legacyId : user.walkerId].filter(Boolean).map(String);
  req.bookingScope = item => owners.includes(String(consumer ? item.consumerId : item.walkerId));
  if (req.method === 'POST') {
    if (!consumer) return response(res, 403, null, 'Only consumers can request a walk.');
    if (!req.body) return response(res, 400, null, 'Enter the booking details.');
    req.body.consumerId = owner;
  }
  const id = req.path.split('/')[1];
  if (id && id !== 'latest') {
    const booking = await findBooking(id);
    if (!booking || !req.bookingScope(booking)) return response(res, 404, null, 'Booking not found.');
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const allowed = consumer ? ['date','time','notes','status'] : ['status'];
      const transitions = consumer ? ['cancelled'] : booking.status === 'pending' ? ['accepted','rejected'] : ['completed','cancelled'];
      if (!ACTIVE_STATUSES.includes(booking.status) || Object.keys(body).some(key => !allowed.includes(key)) ||
          (body.status && !transitions.includes(body.status))) return response(res, 403, null, 'This booking change is unavailable.');
    }
    if (req.method === 'DELETE' && (!consumer || !['rejected','cancelled'].includes(booking.status)))
      return response(res, 403, null, 'Only a cancelled or rejected booking can be removed.');
  }
  next();
}
module.exports = { createBooking, listBookings, getBooking, getLatestBooking, updateBooking, deleteBooking, getBookingDetails, localBackups, bindBookingScope };
