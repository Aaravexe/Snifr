const fs = require('node:fs/promises');
const path = require('node:path');

const storeFile = path.join(__dirname, '..', '..', 'data', 'bookings.json');

async function readAll() {
  try {
    const parsed = JSON.parse(await fs.readFile(storeFile, 'utf8'));
    return Array.isArray(parsed.bookings) ? parsed.bookings : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveAll(bookings) {
  await fs.mkdir(path.dirname(storeFile), { recursive: true });
  await fs.writeFile(storeFile, JSON.stringify({ bookings }, null, 2), 'utf8');
}

module.exports = { readAll, saveAll };
