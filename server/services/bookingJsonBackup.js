const fs = require('node:fs/promises');
const path = require('node:path');

const backupFolder = () => process.env.SNIFR_BACKUP_DIR || path.join(__dirname, '..', '..', 'Snifr Bookings');
const backupFile = () => path.join(backupFolder(), 'bookings-backup.json');

async function readBackups() {
  try {
    const parsed = JSON.parse(await fs.readFile(backupFile(), 'utf8'));
    return Array.isArray(parsed.bookings) ? parsed.bookings : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeBackup(booking) {
  const bookings = await readBackups();
  const id = String(booking._id || booking.id || booking.bookingId);
  const item = { ...booking, _id: id, backedUpAt: new Date().toISOString() };
  const position = bookings.findIndex(record => String(record._id) === id);
  if (position === -1) bookings.push(item);
  else bookings[position] = item;
  await fs.mkdir(backupFolder(), { recursive: true });
  await fs.writeFile(backupFile(), JSON.stringify({ bookings }, null, 2), 'utf8');
  return item;
}

async function removeBackup(id) {
  const bookings = await readBackups();
  const remaining = bookings.filter(record => String(record._id) !== String(id));
  await fs.mkdir(backupFolder(), { recursive: true });
  await fs.writeFile(backupFile(), JSON.stringify({ bookings: remaining }, null, 2), 'utf8');
}

module.exports = { readBackups, writeBackup, removeBackup };
