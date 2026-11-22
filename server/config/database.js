const mongoose = require('mongoose');

let lastConnectionError = null;

async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    console.warn('MongoDB is not connected: set MONGODB_URI in .env to enable database-backed modules.');
    return false;
  }

  mongoose.set('strictQuery', true);
  mongoose.connection.on('reconnected', () => require('../controllers/reviewController').repairStandaloneRatings().catch(error => console.error('Rating repair failed:',error.message)));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await require('../controllers/reviewController').repairStandaloneRatings();
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
  return true;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    lastConnectionError = null;
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
    return true;
  } catch (error) {
    lastConnectionError = error;
    if (process.env.MONGO_REQUIRED === 'true') throw error;
    console.warn(`MongoDB is offline: ${error.message}`);
    console.warn('The Express site remains available; MongoDB API routes return 503 until local MongoDB starts.');
    return false;
  }
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

function databaseStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    database: mongoose.connection.name || null,
    lastError: lastConnectionError ? lastConnectionError.message : null
  };
}

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    data: null,
    message: 'Local MongoDB is offline. Start MongoDB, then restart or retry the API request.'
  });
}

module.exports = { connectDatabase, disconnectDatabase, databaseStatus, requireDatabase };
