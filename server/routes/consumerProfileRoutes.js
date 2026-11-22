const router = require('express').Router();
const ConsumerProfile = require('../models/ConsumerProfile');
const User = require('../models/User');
const { identify, allow, requireMongo, validId, fail, fields } = require('../middleware/dashboardAccess');

const limits = { phone: 30, address: 240, city: 80, profileImage: 1500, emergencyContact: 120 };
function setProfileFields(profile, data) {
  for (const [key, raw] of Object.entries(data)) {
    if (typeof raw !== 'string') throw fail(400, `Enter a valid ${key}.`);
    const value = raw.trim();
    if (value.length > limits[key]) throw fail(400, `${key} is too long.`);
    if (key === 'profileImage' && value && !/^assets\/[\w-]+\.(png|jpe?g|webp)$/.test(value) &&
      !/^\/uploads\/[\w/-]+\.(png|jpe?g|webp)$/.test(value) && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
      let safeHttps = false;
      try { safeHttps = new URL(value).protocol === 'https:'; } catch {}
      if (!safeHttps) throw fail(400, 'Use an HTTPS image URL or a supported uploaded image.');
    }
    profile[key] = value;
  }
}

router.use(identify, allow('consumer', 'admin'), requireMongo);
router.param('userId', (req, res, next, value) => { req.profileUserId = validId(value); next(); });
router.use('/:userId', async (req, res, next) => {
  if (req.user.role !== 'admin' && req.profileUserId !== req.user.id) throw fail(403, 'You can only manage your own Consumer profile.');
  const user = await User.findOne({ _id: req.profileUserId, role: 'consumer' });
  if (!user) throw fail(404, 'Consumer account not found.');
  req.profileUser = user;
  next();
});

router.get('/:userId', async (req, res) => {
  const profile = await ConsumerProfile.findOne({ userId: req.profileUserId });
  if (!profile) throw fail(404, 'Consumer profile not found.');
  res.json({ success: true, data: { user: req.profileUser.publicAccount(), profile }, message: 'Consumer profile loaded.' });
});

router.post('/:userId', async (req, res) => {
  if (await ConsumerProfile.exists({ userId: req.profileUserId })) throw fail(409, 'This Consumer profile already exists.');
  const data = fields(req.body, ['phone', 'address', 'city', 'profileImage', 'emergencyContact']);
  const profile = new ConsumerProfile({ userId: req.profileUserId });
  setProfileFields(profile, data);
  await profile.save();
  res.status(201).json({ success: true, data: { user: req.profileUser.publicAccount(), profile }, message: 'Consumer profile created.' });
});

router.patch('/:userId', async (req, res) => {
  const data = fields(req.body, ['displayName', 'email', 'phone', 'address', 'city', 'profileImage', 'emergencyContact']);
  const user = req.profileUser;
  const profile = await ConsumerProfile.findOne({ userId: req.profileUserId });
  if (!profile) throw fail(404, 'Consumer profile not found.');
  if ('displayName' in data) {
    if (typeof data.displayName !== 'string' || data.displayName.trim().length < 2 || data.displayName.trim().length > 80) throw fail(400, 'Enter your name (2–80 characters).');
    user.displayName = data.displayName.trim();
  }
  if ('email' in data) {
    if (typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) || data.email.trim().length > 254) throw fail(400, 'Enter a valid email address.');
    user.email = data.email.trim().toLowerCase();
  }
  const profileData = Object.fromEntries(Object.entries(data).filter(([key]) => key in limits));
  setProfileFields(profile, profileData);
  await user.save();
  await profile.save();
  res.json({ success: true, data: { user: user.publicAccount(), profile }, message: 'Consumer profile saved.' });
});

router.delete('/:userId', async (req, res) => {
  const result = await ConsumerProfile.deleteOne({ userId: req.profileUserId });
  if (!result.deletedCount) throw fail(404, 'Consumer profile not found.');
  res.json({ success: true, data: { userId: req.profileUserId }, message: 'Consumer profile removed.' });
});

module.exports = router;
