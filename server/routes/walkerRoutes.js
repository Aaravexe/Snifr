const router = require('express').Router();
const Walker = require('../models/WalkerProfile');
const Availability = require('../models/WalkerAvailability');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const User = require('../models/User');
const { allow, requireMongo, validId, fields, fail } = require('../middleware/dashboardAccess');

router.use(requireMongo);
const canWrite = allow('walker','admin');
const profileFields = ['name','about','experience','hourlyRate','services','area','city','pincode','image','status'];
router.param('id', async (req,res,next,id) => {
  req.walker = await Walker.findById(validId(id));
  if (!req.walker) throw fail(404, 'Walker not found.');
  if (req.user?.role !== 'admin' && String(req.walker.userId) !== req.user?.id &&
      (req.method !== 'GET' || req.walker.status !== 'published')) throw fail(403, 'This profile belongs to another walker.');
  next();
});
router.get('/', async (req,res) => {
  const query = req.user?.role === 'admin' ? {} : { status: 'published' };
  if (req.query.city) query.city = new RegExp(`^${String(req.query.city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (req.query.minRating !== undefined) {
    const rating = Number(req.query.minRating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(rating * 2)) throw fail(400, 'Minimum rating must use 0.5-star steps from 0 to 5.');
    query.rating = { $gte: rating };
  }
  if (req.query.maxRate !== undefined) {
    const rate = Number(req.query.maxRate);
    if (!Number.isFinite(rate) || rate <= 0) throw fail(400, 'Maximum rate must be a positive number.');
    query.hourlyRate = { $lte: rate };
  }
  if (req.query.date || req.query.time) {
    const availability = { 'slots.status': 'available' };
    if (req.query.date) availability.date = String(req.query.date);
    if (req.query.time) {
      const time = String(req.query.time);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw fail(400, 'Time must use HH:mm.');
      availability.slots = { $elemMatch: { status: 'available', startTime: time } };
      delete availability['slots.status'];
    }
    query._id = { $in: await Availability.distinct('walkerId', availability) };
  }
  const sorts = { rating: { rating: -1, reviewCount: -1 }, rate: { hourlyRate: 1, rating: -1 }, newest: { createdAt: -1 } };
  const sort = sorts[req.query.sort] || { reviewCount: -1, rating: -1, name: 1 };
  const walkers = await Walker.find(query).sort(sort);
  res.json({ success: true, data: walkers, message: 'Walkers loaded.' });
});
router.get('/:id', (req,res) => res.json({ success: true, data: req.walker, message: 'Walker loaded.' }));
async function saveProfile(req,res) {
  const create = !req.walker;
  const data = fields(req.body, create && req.user.role === 'admin' ? [...profileFields,'userId'] : profileFields);
  let profile = req.walker;
  if (create) {
    const userId = validId(req.user.role === 'admin' ? data.userId : req.user.id);
    if (!await User.exists({ _id: userId, role: 'walker', isActive: true })) throw fail(400, 'Select an active walker account.');
    profile = new Walker({ userId });
  }
  for (const key of profileFields) if (key in data) profile.set(key,data[key]);
  await profile.save();
  res.status(create ? 201 : 200).json({ success: true, data: profile, message: 'Walker saved.' });
}
router.post('/', canWrite, saveProfile);
router.patch('/:id', canWrite, saveProfile);
router.delete('/:id', canWrite, async (req,res) => {
  const id = req.walker.id;
  if (await Availability.exists({ walkerId: id }) || await Booking.exists({ walkerId: id }) || await Review.exists({ walkerId: id }))
    throw fail(409, 'Remove the linked records before deleting this walker.');
  await req.walker.deleteOne();
  res.json({ success: true, data: { id }, message: 'Walker deleted.' });
});
router.get('/:id/availability', async (req,res) => {
  const data = await Availability.find({ walkerId: req.walker._id }).sort({ date: 1 });
  res.json({ success: true, data, message: 'Availability loaded.' });
});
router.param('day', async (req,res,next,id) => {
  req.day = await Availability.findOne({ _id: validId(id), walkerId: req.walker._id });
  if (!req.day) throw fail(404, 'Availability not found.');
  next();
});
router.get('/:id/availability/:day', (req,res) => res.json({ success: true, data: req.day, message: 'Availability loaded.' }));
async function saveDay(req,res) {
  const data = fields(req.body, ['date','slots','version']);
  if (req.day && data.version !== undefined && req.day.__v !== data.version) throw fail(409, 'This schedule changed. Reload before editing.');
  const day = req.day || new Availability({ walkerId: req.walker._id });
  if ('date' in data) day.date = data.date;
  if ('slots' in data) {
    if (!Array.isArray(data.slots)) throw fail(400, 'Enter a list of time slots.');
    day.slots = data.slots.map(slot => {
      fields(slot, ['_id','startTime','endTime']);
      const old = slot._id && day.slots.id(validId(slot._id));
      return { ...slot, status: old?.status || 'available', bookingId: old?.bookingId || null };
    });
  }
  await day.save();
  res.status(req.day ? 200 : 201).json({ success: true, data: day, message: 'Availability saved.' });
}
router.post('/:id/availability', canWrite, saveDay);
router.patch('/:id/availability/:day', canWrite, saveDay);
router.delete('/:id/availability/:day', canWrite, async (req,res) => {
  if (req.day.slots.some(slot => slot.status === 'booked')) throw fail(409, 'Resolve booked slots before deleting this date.');
  await req.day.deleteOne();
  res.json({ success: true, data: { id: req.day.id }, message: 'Date removed.' });
});
module.exports = router;
