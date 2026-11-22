const express = require('express');
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');

function output(record) {
  return {
    id: String(record._id), name: record.name, email: record.email,
    message: record.message, status: record.status,
    createdAt: record.createdAt, updatedAt: record.updatedAt
  };
}

function validId(value) {
  return mongoose.isObjectIdOrHexString(value);
}

function createMongoFeedbackRouter() {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    try {
      const feedback = await Feedback.create({
        name: req.body?.name,
        email: req.body?.email,
        message: req.body?.message
      });
      res.status(201).json({ success: true, data: { feedback: output(feedback) }, message: 'Feedback saved in local MongoDB.' });
    } catch (error) { next(error); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const feedback = await Feedback.find({}).sort({ createdAt: -1 });
      res.json({ success: true, data: { feedback: feedback.map(output) }, message: 'MongoDB feedback loaded.' });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(400).json({ success: false, data: null, message: 'Invalid feedback ID.' });
      const feedback = await Feedback.findById(req.params.id);
      if (!feedback) return res.status(404).json({ success: false, data: null, message: 'Feedback was not found.' });
      res.json({ success: true, data: { feedback: output(feedback) }, message: 'MongoDB feedback loaded.' });
    } catch (error) { next(error); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(400).json({ success: false, data: null, message: 'Invalid feedback ID.' });
      const feedback = await Feedback.findById(req.params.id);
      if (!feedback) return res.status(404).json({ success: false, data: null, message: 'Feedback was not found.' });
      for (const field of ['name', 'email', 'message', 'status']) {
        if (Object.hasOwn(req.body || {}, field)) feedback[field] = req.body[field];
      }
      await feedback.save();
      res.json({ success: true, data: { feedback: output(feedback) }, message: 'MongoDB feedback updated.' });
    } catch (error) { next(error); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(400).json({ success: false, data: null, message: 'Invalid feedback ID.' });
      const feedback = await Feedback.findById(req.params.id);
      if (!feedback) return res.status(404).json({ success: false, data: null, message: 'Feedback was not found.' });
      await feedback.deleteOne();
      res.json({ success: true, data: null, message: 'MongoDB feedback deleted.' });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createMongoFeedbackRouter;
