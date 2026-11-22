const crypto = require('node:crypto');
const mongoose = require('mongoose');

const sessions = new Map();
const cookie = 'snifr_sid';
const lifetime = 8 * 60 * 60 * 1000;

function sessionKey(req) {
  return (req.headers.cookie || '').split(';').map(item => item.trim())
    .find(item => item.startsWith(cookie + '='))?.slice(cookie.length + 1);
}

// Bridge the existing authenticated account handlers until the shared auth router lands.
function startSession(req, res, account) {
  sessions.delete(sessionKey(req));
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expires <= now) sessions.delete(key);
  }
  const key = crypto.randomBytes(32).toString('hex');
  const id = String(account._id || account.id);
  const user = { id, role: account.role === 'owner' ? 'consumer' : account.role,
    displayName: account.displayName, walkerId: account.walkerId, legacyId:account.legacyId };
  sessions.set(key, { user, expires: now + lifetime });
  res.cookie(cookie, key, { httpOnly: true, secure: req.secure, sameSite: 'lax', maxAge: lifetime, path: '/' });
}

function identify(req, res, next) {
  const session = sessions.get(sessionKey(req));
  if (!req.user && session?.expires > Date.now()) req.user = session.user;
  next();
}

function logout(req, res) {
  sessions.delete(sessionKey(req));
  res.clearCookie(cookie, { path: '/' });
  res.json({ success: true, data: null, message: 'Signed out.' });
}

function revoke(id) {
  for (const [key, session] of sessions) if (session.user.id === id) sessions.delete(key);
}

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function allow(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(fail(401, 'Please sign in to continue.'));
    if (!roles.includes(req.user.role)) return next(fail(403, 'Your account cannot access this resource.'));
    next();
  };
}

function requireMongo(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  res.status(503).json({ success: false, data: null, message: 'The database is unavailable. Try again after MongoDB connects.' });
}

function validId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) throw fail(400, 'Enter a valid record ID.');
  return value;
}

function fields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length ||
      Object.keys(body).some(key => !allowed.includes(key))) throw fail(400, 'Check the fields in this form.');
  return body;
}

const home = role => ({ consumer: '/consumer-dashboard', walker: '/walker-dashboard', admin: '/admin' })[role] || '/auth?mode=signin';
module.exports = { startSession, identify, logout, revoke, allow, requireMongo, validId, fields, fail, home };
