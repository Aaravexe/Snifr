const fs = require('node:fs/promises');
const path = require('node:path');

function safeFile(dataDirectory, name) {
  if (!/^[a-z0-9-]+\.json$/i.test(name)) throw new Error('Invalid JSON data file name.');
  const file = path.resolve(dataDirectory, name);
  if (!file.startsWith(`${path.resolve(dataDirectory)}${path.sep}`)) throw new Error('Invalid JSON data path.');
  return file;
}

async function readJson(dataDirectory, name, fallback) {
  const file = safeFile(dataDirectory, name);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    if (error instanceof SyntaxError) throw new Error(`${name} contains invalid JSON.`);
    throw error;
  }
}

async function writeJson(dataDirectory, name, data) {
  const file = safeFile(dataDirectory, name);
  await fs.mkdir(dataDirectory, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temporary, file);
  return data;
}

async function appendRecord(dataDirectory, name, property, record) {
  const data = await readJson(dataDirectory, name, { [property]: [] });
  if (!Array.isArray(data[property])) throw new Error(`${name} has an invalid ${property} collection.`);
  data[property].push(record);
  await writeJson(dataDirectory, name, data);
  return record;
}

module.exports = { readJson, writeJson, appendRecord };
