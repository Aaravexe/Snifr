// These compatibility routes preserve the current account and booking pages
// while their owners later migrate those modules to role-aware MongoDB APIs.
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { startSession } = require('../middleware/dashboardAccess');
const User = require('../models/User');

async function readAccounts(file) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(data.accounts) ? data.accounts : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function publicAccount(account) {
  const { password, passwordHash, passwordSalt, ...safeAccount } = account;
  return safeAccount;
}

function passwordMatches(password, account) {
  if (!account.passwordHash || !account.passwordSalt) return account.password === password;
  const savedHash = Buffer.from(account.passwordHash, 'hex');
  const enteredHash = crypto.scryptSync(password, account.passwordSalt, savedHash.length);
  return crypto.timingSafeEqual(savedHash, enteredHash);
}

function bookingFile(directory, id) {
  if (!/^SNIFR-\d+$/.test(id)) {
    const error = new Error('Invalid booking ID.');
    error.status = 400;
    throw error;
  }
  return path.join(directory, `booking-${id}.json`);
}

function createLegacyRouter(root) {
  const router = express.Router();
  const sampleAccounts = path.join(root, 'accounts.json');
  const accountsDirectory = path.join(root, 'Snifr Accounts');
  const localAccounts = path.join(accountsDirectory, 'accounts.json');
  const bookingsDirectory = path.join(root, 'Snifr Bookings');

  router.post('/accounts/register', async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const role = req.body?.role === 'walker' ? 'walker' : 'owner';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
      if (password.length < 6) return res.status(400).json({ message: 'Password must contain at least 6 characters.' });
      const allAccounts = [...await readAccounts(sampleAccounts), ...await readAccounts(localAccounts)];
      if (allAccounts.some(account => account.email.toLowerCase() === email)) return res.status(409).json({ message: 'An account with this email already exists.' });
      if (User.db.readyState === 1) {
        const user = new User({ email, displayName: email.split('@')[0], role: role === 'owner' ? 'consumer' : role });
        await user.setPassword(password);
        await user.save();
        const account = user.publicAccount();
        startSession(req, res, account);
        return res.status(201).json({ account });
      }
      const passwordSalt = crypto.randomBytes(16).toString('hex');
      const account = { id: `user-${Date.now()}`, displayName: email.split('@')[0], email, role, passwordSalt, passwordHash: crypto.scryptSync(password, passwordSalt, 64).toString('hex'), createdAt: new Date().toISOString() };
      const accounts = await readAccounts(localAccounts);
      accounts.push(account);
      await fs.mkdir(accountsDirectory, { recursive: true });
      await fs.writeFile(localAccounts, JSON.stringify({ accounts }, null, 2), 'utf8');
      startSession(req, res, account);
      res.status(201).json({ account: publicAccount(account) });
    } catch (error) { next(error); }
  });

  router.post('/accounts/login', async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (User.db.readyState === 1) {
        const user = await User.findOne({ email }).select('+passwordHash +passwordSalt');
        if (user) {
          if (!user.isActive || !await user.matches(password)) return res.status(401).json({ message: 'Email or password is incorrect.' });
          const account = user.publicAccount();
          startSession(req, res, account);
          return res.json({ account });
        }
      }
      const account = [...await readAccounts(sampleAccounts), ...await readAccounts(localAccounts)].find(item => item.email.toLowerCase() === email);
      if (!account || !passwordMatches(password, account)) return res.status(401).json({ message: 'Email or password is incorrect.' });
      if (User.db.readyState === 1) {
        const user = new User({ email, displayName:account.displayName, role:account.role === 'owner' ? 'consumer' : account.role,
          legacyId:account.id, legacyWalkerId:account.walkerId });
        await user.setPassword(password);
        await user.save();
        const migrated = user.publicAccount();
        startSession(req,res,migrated);
        return res.json({ account:migrated });
      }
      startSession(req, res, account);
      res.json({ account: publicAccount(account) });
    } catch (error) { next(error); }
  });

  router.post('/bookings', async (req, res, next) => {
    try {
      const details = req.body || {};
      if (!details.walkerId || !details.walker || !details.pet || !details.date || !details.time) return res.status(400).json({ message: 'Booking details are incomplete.' });
      const booking = { ...details, bookingId: `SNIFR-${Date.now()}`, status: 'confirmed', submittedAt: new Date().toISOString() };
      await fs.mkdir(bookingsDirectory, { recursive: true });
      await fs.writeFile(bookingFile(bookingsDirectory, booking.bookingId), JSON.stringify(booking, null, 2), 'utf8');
      res.status(201).json({ booking });
    } catch (error) { next(error); }
  });

  router.get('/bookings/latest', async (req, res, next) => {
    try {
      const files = await fs.readdir(bookingsDirectory).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
      const bookings = await Promise.all(files.filter(file => /^booking-SNIFR-\d+\.json$/.test(file)).map(async file => JSON.parse(await fs.readFile(path.join(bookingsDirectory, file), 'utf8'))));
      bookings.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
      res.json({ booking: bookings[0] || null });
    } catch (error) { next(error); }
  });

  router.get('/bookings/:id', async (req, res, next) => {
    try { res.json({ booking: JSON.parse(await fs.readFile(bookingFile(bookingsDirectory, req.params.id), 'utf8')) }); }
    catch (error) { next(error); }
  });

  router.patch('/bookings/:id', async (req, res, next) => {
    try {
      if (!['confirmed', 'cancelled'].includes(req.body?.status)) return res.status(400).json({ message: 'Invalid booking status.' });
      const file = bookingFile(bookingsDirectory, req.params.id);
      const booking = JSON.parse(await fs.readFile(file, 'utf8'));
      booking.status = req.body.status;
      booking.updatedAt = new Date().toISOString();
      await fs.writeFile(file, JSON.stringify(booking, null, 2), 'utf8');
      res.json({ booking });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createLegacyRouter;
