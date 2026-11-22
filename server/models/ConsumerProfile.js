const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  address: { type: String, trim: true, maxlength: 240, default: '' },
  city: { type: String, trim: true, maxlength: 80, default: '' },
  profileImage: { type: String, trim: true, maxlength: 1500, default: '' },
  emergencyContact: { type: String, trim: true, maxlength: 120, default: '' }
}, { timestamps: true, optimisticConcurrency: true, strict: 'throw' });

schema.index({ userId: 1 }, { unique: true });
module.exports = mongoose.models.ConsumerProfile || mongoose.model('ConsumerProfile', schema);
