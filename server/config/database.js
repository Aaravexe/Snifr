const mongoose = require('mongoose');

let lastConnectionError = null;
let listenersInstalled = false;

function installListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  mongoose.connection.on('error', error => { lastConnectionError = error; });
  mongoose.connection.on('reconnected', () => {
    lastConnectionError = null;
    require('../controllers/reviewController').repairStandaloneRatings()
      .catch(error => console.error('Rating repair failed:', error.message));
  });
}

async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    const error = new Error('Set the MongoDB Atlas MONGODB_URI in .env.');
    if (process.env.MONGO_REQUIRED === 'true') throw error;
    console.warn(error.message);
    return false;
  }
  if (process.env.MONGODB_ATLAS_ONLY === 'true' && !uri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_ATLAS_ONLY is enabled. Use the mongodb+srv:// connection string from Atlas.');
  }

  mongoose.set('strictQuery', true);
  installListeners();
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
    lastConnectionError = null;
    await require('../controllers/reviewController').repairStandaloneRatings();
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
    return true;
  } catch (error) {
    lastConnectionError = error;
    if (process.env.MONGO_REQUIRED === 'true') throw error;
    console.warn(`MongoDB Atlas is unavailable: ${error.message}`);
    console.warn('The Express site remains available only when MONGO_REQUIRED=false. MongoDB API routes return 503 until Atlas reconnects.');
    return false;
  }
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

function databaseStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    connected: mongoose.connection.readyState === 1,
    state: states[mongoose.connection.readyState] || 'unknown',
    database: mongoose.connection.name || null,
    lastError: lastConnectionError ? lastConnectionError.message : null
  };
}

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    data: null,
    message: 'MongoDB Atlas is unavailable. Check the Atlas network access list, database user, and MONGODB_URI.'
  });
}

module.exports = { connectDatabase, disconnectDatabase, databaseStatus, requireDatabase };
