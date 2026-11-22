require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('node:path');
const requestLogger = require('./middleware/requestLogger');
const blockPrivateFiles = require('./middleware/blockPrivateFiles');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const createLocalDataRouter = require('./routes/localDataRoutes');
const createLegacyRouter = require('./routes/legacyRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const ROOT = path.resolve(__dirname, '..');
const page = file => (req, res) => res.sendFile(file, { root: ROOT });

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' }, message: 'Snifr Express server is running.' }));
  app.use(require('./routes/dashboardRoutes')(page));
  app.use('/api/local', createLocalDataRouter());
  app.use('/api', bookingRoutes);
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/walkers', require('./routes/walkerRoutes'));
  app.use('/api', createLegacyRouter(ROOT));

  app.get('/', page('landingpage.html'));
  app.get('/auth', page('authpage.html'));
  app.get('/walkers', page('walkersearch.html'));
  app.get('/walker/:walkerId', (req, res) => res.redirect(`/wakerinfo.html?walker=${encodeURIComponent(req.params.walkerId)}`));
  app.get('/support', page('support.html'));
  app.get('/404', page('404.html'));

  app.use(blockPrivateFiles(ROOT));
  app.use(express.static(ROOT, { index: false, dotfiles: 'deny', fallthrough: true }));
  app.use(notFound(ROOT));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp, ROOT };
