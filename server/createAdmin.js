// Run locally with access to the evaluation database. Never create an administrator over public registration.
require('dotenv').config({ quiet: true });
const { randomBytes } = require('node:crypto');
const User = require('./models/User');
const { connectDatabase, disconnectDatabase } = require('./config/database');
(async () => {
  const email = process.argv[2];
  if (!email) throw new Error('Usage: node server/createAdmin.js your-email@example.com');
  if (!await connectDatabase()) throw new Error('Set MONGODB_URI first.');
  await User.init();
  if (await User.exists({ email: email.trim().toLowerCase() })) throw new Error('This email already has an account.');
  const password = randomBytes(20).toString('base64url');
  const admin = new User({ email, displayName: 'Administrator', role: 'admin' });
  await admin.setPassword(password);
  await admin.save();
  console.log('Admin created. Store this generated password privately:', password);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(disconnectDatabase);
