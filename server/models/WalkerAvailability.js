const mongoose = require('mongoose');
const rules = require('../services/availabilityRules');

const slotSchema = new mongoose.Schema({
  startTime: { type: String, required: true, validate: { validator: rules.validTime, message: 'Use HH:mm for the start time.' } },
  endTime: { type: String, required: true, validate: { validator: rules.validTime, message: 'Use HH:mm for the end time.' } },
  status: { type: String, enum: ['available', 'booked'], default: 'available', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null }
}, { strict: 'throw' });

const availabilitySchema = new mongoose.Schema({
  walkerId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalkerProfile', required: true, immutable: true },
  date: { type: String, required: true, validate: { validator: rules.validDate, message: 'Use a valid YYYY-MM-DD date.' } },
  timezone: { type: String, enum: [rules.timezone], default: rules.timezone, required: true },
  slots: { type: [slotSchema], default: [], required: true }
}, { timestamps: true, optimisticConcurrency: true, strict: 'throw' });

availabilitySchema.index({ walkerId: 1, date: 1 }, { unique: true });
availabilitySchema.index({ date: 1, 'slots.status': 1 });

function plainDay(document) {
  return {
    date: document.date,
    slots: (document.slots || []).map(slot => ({
      id: String(slot._id), startTime: slot.startTime, endTime: slot.endTime,
      status: slot.status, bookingId: slot.bookingId ? String(slot.bookingId) : null
    }))
  };
}

function snapshot(document) { document.$locals.originalSchedule = plainDay(document); }
availabilitySchema.post('init', snapshot);
availabilitySchema.post('save', snapshot);

availabilitySchema.pre('validate', function () {
  const current = plainDay(this);
  const previous = this.$locals.originalSchedule;
  try {
    rules.validateDay(current);
    if (this.isNew || !previous || previous.date !== current.date) rules.assertFuture(current.date);
    for (const slot of current.slots) {
      const old = previous?.slots.find(item => item.id === slot.id);
      if (!old || previous.date !== current.date || old.startTime !== slot.startTime || old.endTime !== slot.endTime) {
        rules.assertFuture(current.date, slot.startTime);
      }
    }
    // An active booking cannot be moved or deleted by a profile editor.
    for (const old of previous?.slots || []) {
      if (old.status !== 'booked') continue;
      const slot = current.slots.find(item => item.id === old.id);
      if (!slot || previous.date !== current.date || old.startTime !== slot.startTime || old.endTime !== slot.endTime) {
        throw new Error('Booked slots cannot be moved or deleted. Cancel the booking first.');
      }
    }
  } catch (error) { this.invalidate('slots', error.message); }
});

function assignDay(document, day) {
  document.date = day.date;
  document.slots = day.slots.map(({ id, ...slot }) => ({ _id: id, ...slot }));
  return document;
}

// These mutate the document only. The controller must authorize, then await save().
availabilitySchema.methods.addSlot = function (startTime, endTime) {
  const next = rules.saveSlot([plainDay(this)], this.date, { id: String(new mongoose.Types.ObjectId()), startTime, endTime });
  return assignDay(this, next[0]);
};
availabilitySchema.methods.updateSlot = function (id, startTime, endTime) {
  const next = rules.saveSlot([plainDay(this)], this.date, { startTime, endTime }, String(id));
  return assignDay(this, next[0]);
};
availabilitySchema.methods.removeSlot = function (id) {
  return assignDay(this, rules.removeSlot([plainDay(this)], this.date, String(id))[0]);
};
availabilitySchema.methods.moveToDate = function (date) {
  return assignDay(this, rules.moveDate([plainDay(this)], this.date, date)[0]);
};
availabilitySchema.methods.assertCanDelete = function () {
  rules.removeDate([plainDay(this)], this.date);
  return this;
};

availabilitySchema.pre('deleteOne', { document: true, query: false }, function () { this.assertCanDelete(); });

module.exports = mongoose.models.WalkerAvailability || mongoose.model('WalkerAvailability', availabilitySchema);
