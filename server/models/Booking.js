const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  consumerId: { type: String, required: true, index: true },
  walkerId: { type: String, required: true, index: true },
  petId: { type: String, required: true },
  petName: { type: String, required: true, trim: true },
  walkerName: { type: String, required: true, trim: true },
  date: { type: String, required: true }, // YYYY-MM-DD, stored in the walker's local timezone
  time: { type: String, required: true, trim: true },
  durationMinutes: { type: Number, default: 60, min: 30, max: 240 },
  rate: { type: Number, required: true, min: 0 },
  platformFee: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  notes: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true, versionKey: false });

bookingSchema.index({ walkerId: 1, date: 1, time: 1, status: 1 });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
