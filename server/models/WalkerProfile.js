const mongoose = require('mongoose');

const services = ['walking', 'sitting', 'drop-in'];
const validRate = value => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
const validImage = value => typeof value === 'string' && value.length <= 1500000 && (
  /^\/?assets\/[\w-]+\.(png|jpe?g|webp)$/.test(value) ||
  /^\/uploads\/[\w/-]+\.(png|jpe?g|webp)$/.test(value) ||
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || (() => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  })()
);
const integer = { validator: Number.isInteger, message: '{PATH} must be a whole number.' };
const requiredWhenPublished = function () { return this.status === 'published'; };
const text = (minlength, maxlength) => ({ type: String, trim: true, minlength, maxlength, required: requiredWhenPublished });

const walkerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  name: text(2, 80),
  about: text(40, 1200),
  experience: { type: Number, min: 0, max: 60, validate: integer, required: requiredWhenPublished },
  hourlyRate: {
    type: Number, min: 1, max: 10000, required: requiredWhenPublished,
    validate: { validator: validRate, message: 'Rate must have at most two decimal places.' }
  },
  services: {
    type: [{ type: String, enum: services }], default: [],
    validate: [
      { validator: values => new Set(values).size === values.length, message: 'Choose each service only once.' },
      { validator: function (values) { return this.status !== 'published' || values.length > 0; }, message: 'Select a service before publishing.' }
    ]
  },
  area: text(2, 80),
  city: text(2, 80),
  pincode: { type: String, trim: true, match: /^[1-9]\d{5}$/, required: requiredWhenPublished },
  image: {
    type: String, trim: true, maxlength: 1500000, required: requiredWhenPublished,
    validate: {
      validator: validImage,
      message: 'Use a supported image upload or HTTPS image URL.'
    }
  },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', required: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0, min: 0, validate: integer },
  walksCompleted: { type: Number, default: 0, min: 0, validate: integer }
}, { timestamps: true, optimisticConcurrency: true, strict: 'throw', toJSON: { virtuals: true }, toObject: { virtuals: true } });

walkerProfileSchema.index({ userId: 1 }, { unique: true });
walkerProfileSchema.index({ status: 1, city: 1, hourlyRate: 1 });

walkerProfileSchema.virtual('profileComplete').get(function () {
  const inRange = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
  return inRange(this.name, 2, 80) && inRange(this.about, 40, 1200) &&
    Number.isInteger(this.experience) && this.experience >= 0 && this.experience <= 60 &&
    validRate(this.hourlyRate) && this.hourlyRate >= 1 && this.hourlyRate <= 10000 &&
    Array.isArray(this.services) && this.services.length > 0 && this.services.every(value => services.includes(value)) && new Set(this.services).size === this.services.length &&
    inRange(this.area, 2, 80) && inRange(this.city, 2, 80) && /^[1-9]\d{5}$/.test(this.pincode) && validImage(this.image);
});

// Publishing is a deliberate document operation so cross-field validators run.
walkerProfileSchema.methods.publish = async function () {
  const oldStatus = this.status;
  this.status = 'published';
  try { await this.validate(); }
  catch (error) { this.status = oldStatus; throw error; }
  return this;
};

module.exports = mongoose.models.WalkerProfile || mongoose.model('WalkerProfile', walkerProfileSchema);
