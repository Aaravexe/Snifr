const router = require('express').Router();
const User = require('../models/User');
const Walker = require('../models/WalkerProfile');
const Pet = require('../models/Pet');
const Booking = require('../models/Booking');
const { allow, requireMongo, fields, validId, fail, revoke } = require('../middleware/dashboardAccess');
router.use(allow('admin'), requireMongo);
router.get('/', async (req, res) => {
  res.json({ success: true, data: (await User.find().sort({ displayName: 1 })).map(user => user.publicAccount()), message: 'Users loaded.' });
});
router.param('id', async (req, res, next, id) => {
  req.account = await User.findById(validId(id));
  if (!req.account) throw fail(404, 'User not found.');
  next();
});
router.get('/:id', (req,res) => res.json({ success: true, data: req.account.publicAccount(), message: 'User loaded.' }));
async function save(req, res) {
  const create = !req.account;
  const data = fields(req.body, create ? ['email','displayName','role','password'] : ['displayName','email','password','isActive']);
  const user = req.account || new User();
  if (data.isActive === false && user.id === req.user.id) throw fail(409, 'Use a different admin account to deactivate this account.');
  for (const key of ['email','displayName','role','isActive']) if (key in data) user.set(key, data[key]);
  if (create || 'password' in data) await user.setPassword(data.password);
  await user.save();
  if ('password' in data || !user.isActive) revoke(user.id);
  res.status(create ? 201 : 200).json({ success: true, data: user.publicAccount(), message: 'User saved.' });
}
router.post('/', save);
router.patch('/:id', save);
router.delete('/:id', async (req,res) => {
  const id = req.account.id;
  if (id === req.user.id || await Walker.exists({ userId: id }) || await Pet.exists({ consumerId: id }) || await Booking.exists({ consumerId: id }))
    throw fail(409, 'This account is in use. Deactivate it or remove its associated records first.');
  await req.account.deleteOne();
  revoke(id);
  res.json({ success: true, data: { id }, message: 'User deleted.' });
});
module.exports = router;
