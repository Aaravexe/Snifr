const express = require('express');
const path = require('node:path');
const { readJson, appendRecord } = require('../services/jsonStore');

const DATA_DIRECTORY = path.join(__dirname, '..', 'data');

function createLocalDataRouter() {
  const router = express.Router();

  router.get('/feedback', async (req, res, next) => {
    try {
      const data = await readJson(DATA_DIRECTORY, 'feedback.json', { feedback: [] });
      res.json({ success: true, data, message: 'Feedback loaded.' });
    } catch (error) { next(error); }
  });

  router.post('/feedback', async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const message = String(req.body?.message || '').trim();
      if (name.length < 2 || name.length > 80) {
        const error = new Error('Enter a name between 2 and 80 characters.'); error.status = 400; throw error;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const error = new Error('Enter a valid email address.'); error.status = 400; throw error;
      }
      if (message.length < 10 || message.length > 1000) {
        const error = new Error('Feedback must be between 10 and 1,000 characters.'); error.status = 400; throw error;
      }
      const feedback = { id: `feedback-${Date.now()}`, name, email, message, createdAt: new Date().toISOString() };
      await appendRecord(DATA_DIRECTORY, 'feedback.json', 'feedback', feedback);
      res.status(201).json({ success: true, data: { feedback }, message: 'Thanks for your feedback.' });
    } catch (error) { next(error); }
  });

  router.get('/walkers', async (req, res, next) => {
    try {
      const data = await readJson(path.join(__dirname, '..', '..'), 'walkers.json', { walkers: [] });
      res.json({ success: true, data, message: 'Local walker seed data loaded.' });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createLocalDataRouter;
