const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  consumerId: { type: String, required: true, immutable: true, index: true, maxlength: 100 },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  breed: { type: String, required: true, trim: true, maxlength: 100 },
  age: { type: Number, required: true, min: 0, max: 30 },
  importKey: { type: String, immutable: true, maxlength: 100, select: false }
}, { timestamps: true });
schema.index({ consumerId: 1, importKey: 1 }, { unique: true, partialFilterExpression: { importKey: { $type: 'string' } } });
module.exports = mongoose.model('Pet', schema);
