const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'walker-profile.js'), 'utf8');
const walker = { id: 'test-walker', role: 'walker', displayName: 'Test Walker' };
const valid = {
  name: 'Test Walker', about: 'Patient dog walker who follows each pet parent’s routine and provides regular updates.',
  experience: '0', hourlyRate: '250.50', services: ['walking'],
  area: 'Kothrud', city: 'Pune', pincode: '411038', image: 'assets/walker.png'
};

function setup(account = walker) {
  const storage = new Map();
  if (account) storage.set('snifrSession', JSON.stringify(account));
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  };
  const context = vm.createContext({ window: {}, localStorage });
  vm.runInContext(source, context);
  return { api: context.window.WalkerProfile, storage, localStorage };
}

test('only a walker session opens the walker flow', () => {
  assert.equal(setup(null).api.session(), null);
  assert.equal(setup({ id: 'owner', role: 'owner' }).api.session(), null);
  assert.equal(setup().api.session().id, walker.id);
});

test('complete profile accepts zero experience and fractional rates', () => {
  assert.equal(Object.keys(setup().api.validate(valid)).length, 0);
});

test('invalid and missing profile fields are rejected', () => {
  const { api } = setup();
  const cases = {
    name: [' ', 'a', 'x'.repeat(81)], about: ['short', 'x'.repeat(1201)],
    experience: ['', '-1', '1.5', '61'], hourlyRate: ['', '0', '-5', 'Infinity', '250.555', '10001'],
    services: [[]], area: [' ', 'x'.repeat(81)], city: [''], pincode: ['000000', '12345', '41103a'], image: ['']
  };
  for (const [field, values] of Object.entries(cases)) {
    for (const value of values) assert.ok(api.validate({ ...valid, [field]: value })[field], `${field}: ${value}`);
  }
});

test('partial drafts resume and remain separate per account', () => {
  const { api } = setup();
  api.save(walker, { name: 'Partial' }, false, 1);
  assert.equal(api.load(walker).profile.name, 'Partial');
  assert.equal(api.load(walker).step, 1);
  assert.equal(api.load({ id: 'another-walker' }), null);
  assert.throws(() => api.save(walker, { name: 'Partial' }, true), /required profile fields/);
});

test('completed drafts preserve updated fields and image', () => {
  const { api } = setup();
  api.save(walker, valid, true, 3);
  const updated = { ...valid, hourlyRate: '350', services: ['walking', 'sitting'], image: 'data:image/jpeg;base64,YQ==' };
  api.save(walker, updated, true, 3);
  const saved = api.load(walker);
  assert.equal(saved.completed, true);
  assert.equal(saved.profile.hourlyRate, '350');
  assert.equal(saved.profile.services.length, 2);
  assert.equal(saved.profile.image, updated.image);
});

test('unsafe images and unknown services cannot complete a draft', () => {
  const { api } = setup();
  assert.throws(() => api.save(walker, { ...valid, image: 'javascript:alert(1)' }, true), /required profile fields/);
  assert.throws(() => api.save(walker, { ...valid, services: ['__proto__', 'training'] }, true), /required profile fields/);
});

test('an account switch blocks writes to the previous account', () => {
  const { api, storage } = setup();
  storage.set('snifrSession', JSON.stringify({ id: 'other', role: 'walker' }));
  assert.throws(() => api.save(walker, valid, true), /sign-in changed/);
  assert.equal(api.load(walker), null);
});

test('storage failures surface an actionable error and preserve the saved draft', () => {
  const { api, localStorage } = setup();
  api.save(walker, valid, true);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => api.save(walker, { ...valid, name: 'New name' }, true), /could not save this draft/);
  assert.equal(api.load(walker).profile.name, valid.name);
});

test('corrupt stored data is not silently replaced', () => {
  const { api, storage } = setup();
  const key = `snifrWalkerDraft:v1:${walker.id}`;
  storage.set(key, '{broken');
  assert.throws(() => api.load(walker));
  assert.equal(storage.get(key), '{broken');
  storage.set(key, JSON.stringify({ version: 1, profile: valid, step: 2.5 }));
  assert.equal(api.load(walker).step, 2);
});
