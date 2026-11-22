const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Walker = require('../models/WalkerProfile');
const Review = require('../models/Review');
const { fields, validId, fail } = require('../middleware/dashboardAccess');

function scope(user) {
  return user.role === 'admin' ? {} : { consumerId: { $in:[user.id,user.legacyId].filter(Boolean) } };
}
function changes(body, create) {
  fields(body, create ? ['bookingId','rating','comment'] : ['rating','comment']);
  const result = {};
  if (create || 'rating' in body) {
    if (typeof body.rating !== 'number' || !Number.isInteger(body.rating * 2) || body.rating < 0.5 || body.rating > 5)
      throw fail(400, 'Choose a rating from 0.5 to 5 in half-star steps.');
    result.rating = body.rating;
  }
  if ('comment' in body) {
    if (typeof body.comment !== 'string' || body.comment.trim().length > 1000)
      throw fail(400, 'Use up to 1,000 characters for your review.');
    result.comment = body.comment.trim();
  }
  return result;
}
async function completed(bookingId, user, session) {
  const booking = await Booking.findOne({ _id: validId(bookingId), ...scope(user) }).session(session);
  if (!booking) throw fail(404, 'Booking not found.');
  if (booking.status !== 'completed') throw fail(409, 'Reviews open after a walk is completed.');
  if (!mongoose.isObjectIdOrHexString(booking.walkerId)) {
    const account = await User.findOne({ legacyWalkerId:booking.walkerId }).session(session);
    const profile = account && await Walker.findOne({ userId:account._id }).session(session);
    if (!profile) throw fail(409, 'This booking needs a saved walker profile before it can be reviewed.');
    // Historical bookings keep their original identifiers.
    booking.walkerId = profile.id;
  }
  return booking;
}
async function stats(walkerId, session) {
  const [summary] = await Review.aggregate([
    { $match: { walkerId } },
    { $group: { _id:null, rating:{ $avg:'$rating' }, reviewCount:{ $sum:1 } } }
  ]).session(session);
  return { rating:summary?.rating ?? 0, reviewCount:summary?.reviewCount ?? 0 };
}

// On a standalone server, use the walker's version to reject a stale aggregate.
// Reconnect also repairs a write interrupted between the two collections.
async function refreshRating(walkerId) {
  for (;;) {
    const walker = await Walker.findById(walkerId).select('__v').lean();
    if (!walker) return;
    const summary = await stats(walker._id,null);
    const result = await Walker.updateOne({ _id:walkerId, __v:walker.__v }, { $set:summary, $inc:{__v:1} });
    if (result.matchedCount) return;
  }
}
async function repairStandaloneRatings() {
  const hello = await mongoose.connection.db.admin().command({ hello:1 });
  if (hello.setName || hello.msg === 'isdbgrid') return;
  const ids = await Review.distinct('walkerId');
  const walkers = Walker.find({ $or:[{ _id:{ $in:ids } },{ reviewCount:{ $gt:0 } }] }).select('_id').lean().cursor();
  for await (const walker of walkers) await refreshRating(walker._id);
}

async function mutate(req, res, operation) {
  const create = operation === 'create';
  const remove = operation === 'delete';
  const values = remove ? {} : changes(req.body, create);
  const selector = create ? null : { _id: validId(req.params.id), ...scope(req.user) };
  try {
    const write = async session => {
      let review;
      if (create) {
        const booking = await completed(req.body.bookingId, req.user, session);
        review = new Review({ ...values, bookingId: booking._id, consumerId: booking.consumerId, walkerId: booking.walkerId });
      } else {
        review = await Review.findOne(selector).session(session);
        if (!review) throw fail(404, 'Review not found.');
        if (!remove) {
          await completed(review.bookingId, req.user, session);
          review.set(values);
        }
      }
      // Take the same walker write lock before computing ratings for concurrent reviews.
      const walker = session ? await Walker.findByIdAndUpdate(review.walkerId, { $inc: { __v: 1 } }, { session }) : await Walker.exists({ _id:review.walkerId });
      if (!walker && !remove) throw fail(409, 'The walker profile is unavailable.');
      if (remove) await review.deleteOne({ session });
      else await review.save({ session });
      if (walker && session) await Walker.updateOne({ _id:walker._id }, { $set:await stats(review.walkerId,session) }, { session });
      if (walker && !session) await refreshRating(review.walkerId);
      return remove ? { id: review.id } : review.toObject();
    };
    const hello = await mongoose.connection.db.admin().command({hello:1});
    const result = hello.setName || hello.msg === 'isdbgrid' ? await mongoose.connection.transaction(write) : await write(null);
    res.status(create ? 201 : 200).json({ success: true, data: result, message: 'Review and walker rating updated.' });
  } catch (error) {
    if (error.code === 11000) throw fail(409, 'This booking already has a review.');
    throw error;
  }
}
async function list(req, res) {
  res.json({ success: true, data: await Review.find(scope(req.user)).sort({ createdAt: -1 }), message: 'Reviews loaded.' });
}
async function get(req, res) {
  const review = await Review.findOne({ _id: validId(req.params.id), ...scope(req.user) });
  if (!review) throw fail(404, 'Review not found.');
  res.json({ success: true, data: review, message: 'Review loaded.' });
}
module.exports = { repairStandaloneRatings, list, get, create: (req,res) => mutate(req,res,'create'), update: (req,res) => mutate(req,res,'update'), remove: (req,res) => mutate(req,res,'delete') };
