require('dotenv').config({ quiet: true });

const User = require('./models/User');
const ConsumerProfile = require('./models/ConsumerProfile');
const WalkerProfile = require('./models/WalkerProfile');
const WalkerAvailability = require('./models/WalkerAvailability');
const Pet = require('./models/Pet');
const rules = require('./services/availabilityRules');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const password = process.argv[2];
if (!password || password.length < 6) {
  console.error('Usage: npm run db:seed -- "a-demo-password"');
  process.exit(1);
}

async function account({ email, displayName, role }) {
  let user = await User.findOne({ email }).select('+passwordHash +passwordSalt');
  if (!user) user = new User({ email, displayName, role });
  user.displayName = displayName;
  user.role = role;
  user.isActive = true;
  await user.setPassword(password);
  await user.save();
  return user;
}

function futureDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  while (rules.today(date) <= rules.today()) date.setUTCDate(date.getUTCDate() + 1);
  return rules.today(date);
}

async function seed() {
  if (!await connectDatabase()) throw new Error('MongoDB Atlas is unavailable.');
  const consumer = await account({ email: 'demo.consumer@snifr.local', displayName: 'Demo Consumer', role: 'consumer' });
  const walkerUser = await account({ email: 'demo.walker@snifr.local', displayName: 'Demo Walker', role: 'walker' });

  await ConsumerProfile.findOneAndUpdate(
    { userId: consumer._id },
    { $set: { city: 'Pune', address: 'Kothrud', phone: '9999999999', emergencyContact: 'Demo Contact' } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  const pet = await Pet.findOneAndUpdate(
    { consumerId: consumer._id, importKey: 'snifr-demo-pet' },
    { $set: { name: 'Sheru', breed: 'Indie', age: 3 }, $setOnInsert: { consumerId: consumer._id, importKey: 'snifr-demo-pet' } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  const walker = await WalkerProfile.findOneAndUpdate(
    { userId: walkerUser._id },
    { $set: { name: 'Demo Walker', about: 'Patient and dependable dog walker who follows each pet routine and shares regular updates.', experience: 3, hourlyRate: 250, services: ['walking', 'drop-in'], area: 'Kothrud', city: 'Pune', pincode: '411038', image: '/assets/walker.png', status: 'published' } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  for (const date of [futureDate(1), futureDate(2)]) {
    await WalkerAvailability.findOneAndUpdate(
      { walkerId: walker._id, date },
      { $setOnInsert: { walkerId: walker._id, date, slots: [
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '16:00', endTime: '17:00' }
      ] } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
  }

  console.log('Snifr demo data is ready.');
  console.log(JSON.stringify({ consumer: consumer.email, walker: walkerUser.email, pet: pet.name, password }, null, 2));
}

seed()
  .catch(error => { console.error(`Seed failed: ${error.message}`); process.exitCode = 1; })
  .finally(disconnectDatabase);
