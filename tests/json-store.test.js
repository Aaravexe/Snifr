const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { readJson, writeJson, appendRecord } = require('../server/services/jsonStore');

test('JSON store writes, reads and appends only approved JSON names', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'snifr-json-store-'));
  try {
    assert.deepEqual(await readJson(directory, 'feedback.json', { feedback: [] }), { feedback: [] });
    await writeJson(directory, 'feedback.json', { feedback: [{ id: 'one' }] });
    await appendRecord(directory, 'feedback.json', 'feedback', { id: 'two' });
    assert.deepEqual(await readJson(directory, 'feedback.json', {}), { feedback: [{ id: 'one' }, { id: 'two' }] });
    await assert.rejects(() => readJson(directory, '../accounts.json', {}), /Invalid JSON data file name/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
