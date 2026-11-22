const User = require('../models/User');
const ConsumerProfile = require('../models/ConsumerProfile');
const WalkerProfile = require('../models/WalkerProfile');
const { startSession, revoke, fail, fields, home } = require('../middleware/dashboardAccess');

function destination(role, complete = false) {
  return role === 'walker' ? (complete ? '/walker-dashboard' : '/walker-onboarding') : home(role);
}

async function register(req, res) {
  requireMongo(req, res, () => {});
  const data = fields(req.body, ['displayName', 'email', 'password', 'role', 'city']);
  const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (displayName.length < 2 || displayName.length > 80) throw fail(400, 'Enter your name (2–80 characters).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw fail(400, 'Enter a valid email address.');
  if (!['consumer', 'walker'].includes(data.role)) throw fail(400, 'Choose Consumer or Walker to create your account.');
  if (data.city !== undefined && (typeof data.city !== 'string' || data.city.trim().length > 80)) throw fail(400, 'Enter a city with at most 80 characters.');

  const user = new User({ displayName, email, role: data.role });
  await user.setPassword(data.password);
  await user.save();
  try {
    if (data.role === 'consumer') {
      await new ConsumerProfile({ userId: user._id, city: data.city?.trim() || '' }).save();
    } else {
      await new WalkerProfile({ userId: user._id, name: displayName, status: 'draft' }).save();
    }
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  const account = user.publicAccount();
  const next = destination(data.role, false);
  startSession(req, res, account);
  res.status(201).json({ success: true, data: { user: account, destination: next }, message: 'Account created.' });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || password.length > 200) throw fail(400, 'Enter your email and password.');
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +passwordSalt');
  if (!user || !user.isActive || !await user.matches(password)) throw fail(401, 'Email or password is incorrect.');
  let complete = false;
  if (user.role === 'walker') {
    const profile = await WalkerProfile.findOne({ userId: user._id });
    complete = Boolean(profile?.profileComplete && profile.status === 'published');
  }
  const account = user.publicAccount();
  startSession(req, res, account);
  res.json({ success: true, data: { user: account, destination: destination(user.role, complete) }, message: 'Signed in.' });
}

async function deactivate(req, res) {
  const user = await User.findById(req.user.id);
  if (!user || !user.isActive) throw fail(404, 'Active account not found.');
  user.isActive = false;
  await user.save();
  revoke(req.user.id);
  res.clearCookie('snifr_sid', { path: '/' });
  res.json({ success: true, data: { id: user.id, isActive: false }, message: 'Account deactivated.' });
}

module.exports = { register, login, deactivate };
