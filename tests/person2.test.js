const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { createApp } = require('../server/app');
const User = require('../server/models/User');
const Walker = require('../server/models/WalkerProfile');

test('Person 2 account, profile and role flows through Express and MongoDB', { skip: !process.env.SNIFR_TEST_MONGO_URI }, async t => {
  await mongoose.connect(process.env.SNIFR_TEST_MONGO_URI, { dbName: 'snifr_person2_' + randomUUID().replaceAll('-', '') });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const app = createApp();
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  function client() {
    let cookie = '';
    return async (path, method = 'GET', body, status = 200) => {
      const response = await fetch(base + path, { method, redirect: 'manual', headers: { cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      cookie = response.headers.getSetCookie()[0]?.split(';')[0] || cookie;
      const text = await response.text();
      assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 240)}`);
      return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
    };
  }

  const consumer = client(), walker = client(), stranger = client(), admin = client();
  const password = 'person2-password-123';
  const registration = await consumer('/api/auth/register', 'POST', { displayName: 'Casey Consumer', email: 'CASEY@example.test', password, role: 'consumer', city: 'Pune' }, 201);
  const account = registration.data.user;
  assert.equal(registration.data.destination, '/consumer-dashboard');
  assert.equal('passwordHash' in account || 'passwordSalt' in account, false);
  assert.ok((await consumer('/consumer-dashboard')).includes('<!doctype html>'));
  const profilePath = '/api/consumer-profiles/' + account.id;
  assert.equal((await consumer(profilePath)).data.profile.city, 'Pune');
  await stranger(profilePath, 'GET', undefined, 401);
  await consumer(profilePath, 'PATCH', { displayName: 'Casey C', email: 'casey@example.test', phone: '555-0100', address: '1 Main Street', city: 'Jaipur', profileImage: '', emergencyContact: 'Alex 555-0199' });
  assert.equal((await consumer(profilePath)).data.user.displayName, 'Casey C');
  await consumer('/api/auth/register', 'POST', { displayName: 'Duplicate', email: 'CASEY@example.test', password, role: 'consumer' }, 409);

  await consumer('/api/auth/password', 'PATCH', { currentPassword: password, newPassword: 'new-person2-password-456' });
  await consumer('/api/auth/logout', 'POST');
  await consumer('/api/auth/login', 'POST', { email: account.email, password }, 401);
  assert.equal((await consumer('/api/auth/login', 'POST', { email: account.email, password: 'new-person2-password-456' })).data.destination, '/consumer-dashboard');

  const walkerRegistration = await walker('/api/auth/register', 'POST', { displayName: 'Wally Walker', email: 'wally@example.test', password, role: 'walker' }, 201);
  assert.equal(walkerRegistration.data.destination, '/walker-onboarding');
  const walkerProfile = await Walker.findOne({ userId: walkerRegistration.data.user.id });
  Object.assign(walkerProfile, { name: 'Wally Walker', about: 'An experienced and caring walker offering dependable neighborhood walks for pets.', experience: 3,
    hourlyRate: 250, services: ['walking'], area: 'Central', city: 'Pune', pincode: '411001', image: 'assets/walker.png', status: 'published' });
  await walkerProfile.save();

  const adminAccount = new User({ displayName: 'Admin', email: 'admin@example.test', role: 'admin' });
  await adminAccount.setPassword(password); await adminAccount.save();
  assert.equal((await admin('/api/auth/login', 'POST', { email: adminAccount.email, password })).data.destination, '/admin');
  await walker('/api/auth/logout', 'POST');
  assert.equal((await walker('/api/auth/login', 'POST', { email: 'wally@example.test', password })).data.destination, '/walker-dashboard');
  assert.ok((await walker('/walker-dashboard')).includes('<!doctype html>'));
  await walker(profilePath, 'GET', undefined, 403);

  assert.equal((await admin('/api/users')).data.some(user => 'passwordHash' in user || 'passwordSalt' in user), false);
  const extra = (await admin('/api/users', 'POST', { email: 'extra@example.test', displayName: 'Extra', role: 'consumer', password }, 201)).data;
  assert.equal((await admin('/api/users/' + extra.id, 'PATCH', { displayName: 'Updated' })).data.displayName, 'Updated');
  await admin('/api/users/' + extra.id, 'DELETE');
  await admin(profilePath, 'DELETE');
  await consumer(profilePath, 'POST', { city: 'Jaipur' }, 201);
  assert.equal((await consumer(profilePath)).data.profile.city, 'Jaipur');
  await admin(profilePath, 'DELETE');
  await consumer('/api/auth/account', 'DELETE');
  await consumer('/api/auth/login', 'POST', { email: account.email, password: 'new-person2-password-456' }, 401);
});
