require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('node:path');
const requestLogger = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const createLocalDataRouter = require('./routes/localDataRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const createMongoFeedbackRouter = require('./routes/mongoFeedbackRoutes');
const { databaseStatus, requireDatabase } = require('./config/database');
const { identify } = require('./middleware/dashboardAccess');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const page = file => (req, res) => res.sendFile(file, { root: PUBLIC });

function preserveQuery(destination) {
  return (req, res) => {
    const query = req.originalUrl.includes('?') ? `?${req.originalUrl.split('?').slice(1).join('?')}` : '';
    res.redirect(301, `${destination}${query}`);
  };
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(identify);

  app.use(require('./routes/dashboardRoutes')(page));
  app.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok', mongodb: databaseStatus() }, message: 'Snifr Express server is running.' }));
  app.use('/api/local', createLocalDataRouter());
  app.use('/api', bookingRoutes);
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/consumer-profiles', require('./routes/consumerProfileRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/walkers', require('./routes/walkerRoutes'));
  app.use('/api/pets', require('./routes/petRoutes'));
  app.use('/api/reviews', require('./routes/reviewRoutes'));
  app.use('/api/feedback', requireDatabase, createMongoFeedbackRouter());

  app.get('/', page('index.html'));
  app.get('/auth', page('auth.html'));
  app.get('/walkers', page('walkers.html'));
  app.get('/walker-info', page('walker-info.html'));
  app.get('/walker/:walkerId', (req, res) => res.redirect(`/walker-info?walker=${encodeURIComponent(req.params.walkerId)}`));
  app.get('/support', page('support.html'));
  app.get('/404', page('404.html'));

  app.get('/landingpage.html', preserveQuery('/'));
  app.get('/index.html', preserveQuery('/'));
  app.get('/authpage.html', preserveQuery('/auth'));
  app.get('/auth.html', preserveQuery('/auth'));
  app.get('/walkersearch.html', preserveQuery('/walkers'));
  app.get('/walkers.html', preserveQuery('/walkers'));
  app.get('/wakerinfo.html', preserveQuery('/walker-info'));
  app.get('/walker-info.html', preserveQuery('/walker-info'));
  app.get('/Dashboard.HTML', preserveQuery('/dashboard'));
  app.get('/support.html', preserveQuery('/support'));

  app.use(express.static(PUBLIC, { index: false, dotfiles: 'deny', fallthrough: true }));
  app.use(notFound(PUBLIC));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp, ROOT, PUBLIC };
