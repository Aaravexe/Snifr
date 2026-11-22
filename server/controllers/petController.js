const Pet = require('../models/Pet');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { fail, fields, validId } = require('../middleware/dashboardAccess');

const scope = user => user.role === 'admin' ? {} : { consumerId: user.id };
function payload(body, allowed) {
  const values = fields(body, allowed);
  for (const [key, value] of Object.entries(values)) {
    if (key === 'age' ? typeof value !== 'number' || !Number.isFinite(value) : typeof value !== 'string' || !value.trim())
      throw fail(400, 'Enter a name, breed and numeric age.');
  }
  return values;
}
function selector(req) {
  return { _id: validId(req.params.id), ...scope(req.user) };
}
async function list(req, res) {
  res.json({ success: true, data: await Pet.find(scope(req.user)).sort({ createdAt: 1 }), message: 'Pets loaded.' });
}
async function send(res, query) {
  const pet = await query;
  if (!pet) throw fail(404, 'Pet not found.');
  res.json({ success: true, data: pet, message: 'Pet record loaded.' });
}
async function create(req, res) {
  const admin = req.user.role === 'admin';
  const values = payload(req.body, ['name','breed','age','importKey', ...(admin ? ['consumerId'] : [])]);
  const consumerId = admin ? values.consumerId?.trim() : req.user.id;
  if (!consumerId) throw fail(400, 'Select the consumer who owns this pet.');
  if (admin && !await User.exists({ _id:validId(consumerId),role:'consumer',isActive:true })) throw fail(400, 'Select an active consumer.');
  const data = { ...values, consumerId };
  // Legacy browser imports may be retried after a partial upload or lost response.
  if (data.importKey) {
    const query = { consumerId, importKey: data.importKey };
    const pet = new Pet(data);
    await pet.validate();
    try {
      await Pet.updateOne(query, { $setOnInsert: data }, { upsert: true });
    } catch (error) { if (error.code !== 11000) throw error; }
    return send(res, Pet.findOne(query));
  }
  res.status(201).json({ success: true, data: await Pet.create(data), message: 'Pet added.' });
}
async function update(req, res) {
  return send(res, Pet.findOneAndUpdate(selector(req), { $set: payload(req.body, ['name','breed','age']) }, { returnDocument: 'after', runValidators: true }));
}
async function remove(req, res) {
  const pet = await Pet.findOne(selector(req));
  if (!pet) throw fail(404, 'Pet not found.');
  if (await Booking.exists({ petId: String(pet._id), status: { $in: ['pending','accepted'] } }))
    throw fail(409, 'Finish or cancel this pet’s active bookings before deleting it.');
  await pet.deleteOne();
  res.json({ success: true, data: { id: pet.id }, message: 'Pet deleted.' });
}
module.exports = { list, get: (req, res) => send(res, Pet.findOne(selector(req))), create, update, remove };
