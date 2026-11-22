const crypto = require('node:crypto');
const { promisify } = require('node:util');
const mongoose = require('mongoose');
const scrypt = promisify(crypto.scrypt);
const schema = new mongoose.Schema({
  displayName: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  role: { type: String, enum: ['consumer','walker','admin'], required: true },
  passwordSalt: { type: String, required: true, select: false },
  passwordHash: { type: String, required: true, select: false },
  legacyId: { type:String, immutable:true },
  legacyWalkerId: { type:String, immutable:true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, optimisticConcurrency: true });
schema.methods.setPassword = async function (value) {
  if (typeof value !== 'string' || value.length < 6 || value.length > 200)
    throw Object.assign(new Error('Use a password between 6 and 200 characters.'), { status: 400 });
  this.passwordSalt = crypto.randomBytes(16).toString('hex');
  this.passwordHash = (await scrypt(value, this.passwordSalt, 64)).toString('hex');
};
schema.methods.matches = async function (value) {
  return typeof value === 'string' && value.length <= 200 && crypto.timingSafeEqual(await scrypt(value, this.passwordSalt, 64), Buffer.from(this.passwordHash,'hex'));
};
schema.methods.publicAccount = function () {
  const { id, displayName, email, role, isActive } = this;
  return { id, displayName, email, role, isActive, ...(this.legacyId && {legacyId:this.legacyId}), ...(this.legacyWalkerId && {walkerId:this.legacyWalkerId}) };
};
module.exports = mongoose.model('User', schema);
