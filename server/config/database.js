const mongoose = require('mongoose');

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
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
