const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  message: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
  status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new' }
}, { timestamps: true, strict: 'throw' });

feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
