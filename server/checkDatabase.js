require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase, databaseStatus } = require('./config/database');

async function checkDatabase() {
  const connected = await connectDatabase();
  if (!connected) throw new Error('MongoDB Atlas did not connect. Check MONGODB_URI, the database user, and the Atlas IP access list.');
  const ping = await mongoose.connection.db.admin().ping();
  const collections = (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray())
    .map(item => item.name).sort();
  console.log(JSON.stringify({ ...databaseStatus(), ping, collections }, null, 2));
}

checkDatabase()
  .catch(error => { console.error(`Database check failed: ${error.message}`); process.exitCode = 1; })
  .finally(disconnectDatabase);
