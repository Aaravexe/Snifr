const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Booking', unique: true, immutable: true },
  consumerId: { type: String, required: true, index: true, immutable: true },
  walkerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'WalkerProfile', index: true, immutable: true },
  rating: { type: Number, min: 0.5, max: 5, required: true, validate: {
    validator: value => Number.isInteger(value * 2), message: 'Choose a rating in half-star steps.'
  } },
  comment: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true });
module.exports = mongoose.model('Review', schema);
