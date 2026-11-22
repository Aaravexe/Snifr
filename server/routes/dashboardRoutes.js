const express = require('express');
const mongoose = require('mongoose');
const Walker = require('../models/WalkerProfile');
const Availability = require('../models/WalkerAvailability');
const { identify, logout, allow, requireMongo, home } = require('../middleware/dashboardAccess');

function dashboardRoutes(page) {
  const router = express.Router();
  router.use(identify);
  router.get('/api/dashboard/session', allow('consumer','walker','admin'), (req, res) =>
    res.json({ success: true, data: req.user, message: 'Signed in.' }));
  router.post('/api/dashboard/logout', logout);
  router.use('/api/pets', require('./petRoutes'));
  router.use('/api/reviews', require('./reviewRoutes'));
  router.get('/api/dashboard/walker', allow('walker'), requireMongo, async (req, res) => {
    const profile = mongoose.isObjectIdOrHexString(req.user.id) ? await Walker.findOne({ userId: req.user.id }) : null;
    const walkerId = profile?.id || req.user.walkerId || req.user.id;
    const availability = profile ? await Availability.find({ walkerId: profile._id }).sort({ date: 1 }).lean() : [];
    res.json({ success: true, data: { walkerId, profile: profile && { profileComplete: profile.profileComplete,
      name: profile.name, status: profile.status, rating: profile.rating, reviewCount: profile.reviewCount }, availability }, message: 'Walker dashboard loaded.' });
  });
  router.get(['/dashboard','/Dashboard.HTML'], (req, res) => res.redirect(home(req.user?.role)));
  for (const [role, slug] of [['consumer','consumer-dashboard'],['walker','walker-dashboard'],['admin','admin']]) {
    router.get(['/' + slug, '/' + slug + '.html'], (req, res) => {
      res.set('Cache-Control', 'private, no-store');
      if (req.user?.role !== role) return res.redirect(home(req.user?.role));
      page(slug + '.html')(req, res);
    });
  }
  for (const [role, paths] of [['consumer',['my-bookings']],['walker',['walker-bookings','walker-onboarding','walker-settings','walker-availability']]]) {
    for (const slug of paths) router.get(['/'+slug,'/'+slug+'.html'], (req,res) => {
      res.set('Cache-Control','private, no-store');
      if (req.user?.role !== role) return res.redirect(home(req.user?.role));
      page(slug+'.html')(req,res);
    });
  }
  return router;
}
module.exports = dashboardRoutes;
