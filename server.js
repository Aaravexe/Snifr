const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;
const BOOKINGS_FOLDER = path.join(ROOT, 'Snifr Bookings');
const PORT = 3000;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request is too large.');
  }
  return JSON.parse(body || '{}');
}

function bookingFile(bookingId) {
  if (!/^SNIFR-\d+$/.test(bookingId)) throw new Error('Invalid booking ID.');
  return path.join(BOOKINGS_FOLDER, `booking-${bookingId}.json`);
}

function validBooking(data) {
  return data && data.walkerId && data.walker && data.pet && data.date && data.time;
}

async function createBooking(request, response) {
  const data = await readJson(request);
  if (!validBooking(data)) return sendJson(response, 400, { message: 'Booking details are incomplete.' });

  const booking = {
    ...data,
    bookingId: `SNIFR-${Date.now()}`,
    status: 'confirmed',
    submittedAt: new Date().toISOString()
  };

  await fs.mkdir(BOOKINGS_FOLDER, { recursive: true });
  await fs.writeFile(bookingFile(booking.bookingId), JSON.stringify(booking, null, 2), 'utf8');
  sendJson(response, 201, { booking });
}

async function getBooking(bookingId, response) {
  const booking = JSON.parse(await fs.readFile(bookingFile(bookingId), 'utf8'));
  sendJson(response, 200, { booking });
}

async function updateBooking(bookingId, request, response) {
  const changes = await readJson(request);
  const file = bookingFile(bookingId);
  const booking = JSON.parse(await fs.readFile(file, 'utf8'));

  if (!['confirmed', 'cancelled'].includes(changes.status)) {
    return sendJson(response, 400, { message: 'Invalid booking status.' });
  }

  booking.status = changes.status;
  booking.updatedAt = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(booking, null, 2), 'utf8');
  sendJson(response, 200, { booking });
}

async function getLatestBooking(response) {
  let files;
  try {
    files = await fs.readdir(BOOKINGS_FOLDER);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 200, { booking: null });
    throw error;
  }

  const bookings = await Promise.all(files
    .filter(file => /^booking-SNIFR-\d+\.json$/.test(file))
    .map(async file => {
      try {
        return JSON.parse(await fs.readFile(path.join(BOOKINGS_FOLDER, file), 'utf8'));
      } catch {
        return null;
      }
    }));

  const latest = bookings
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0] || null;
  sendJson(response, 200, { booking: latest });
}

async function serveFile(request, response, pathname) {
  const relativePath = pathname === '/' ? 'landingpage.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relativePath);
  const privatePath = relativePath === 'server.js' || relativePath === 'package.json' ||
    relativePath.startsWith('.git') || relativePath.startsWith('Snifr Bookings');

  if (privatePath || !filePath.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403);
    return response.end('Forbidden');
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    });
    if (request.method === 'HEAD') return response.end();
    response.end(file);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500);
    response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  try {
    if (request.method === 'POST' && url.pathname === '/api/bookings') {
      return await createBooking(request, response);
    }
    if (request.method === 'GET' && url.pathname === '/api/bookings/latest') {
      return await getLatestBooking(response);
    }
    if (url.pathname.startsWith('/api/bookings/')) {
      const bookingId = decodeURIComponent(url.pathname.slice('/api/bookings/'.length));
      if (request.method === 'GET') return await getBooking(bookingId, response);
      if (request.method === 'PATCH') return await updateBooking(bookingId, request, response);
    }
    if (url.pathname.startsWith('/api/')) return sendJson(response, 404, { message: 'API route not found.' });
    if (request.method === 'GET' || request.method === 'HEAD') {
      return await serveFile(request, response, url.pathname);
    }
    sendJson(response, 405, { message: 'Method not allowed.' });
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 500;
    sendJson(response, status, { message: status === 404 ? 'Booking not found.' : error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Snifr is running at http://localhost:${PORT}`);
  console.log(`Bookings will be saved in: ${BOOKINGS_FOLDER}`);
});
