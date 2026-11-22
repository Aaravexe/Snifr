const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDirectory = path.resolve(__dirname, '..', 'public');
const routes = {
  '/': 'index.html', '/auth': 'auth.html', '/dashboard': null,
  '/walkers': 'walkers.html', '/walker-info': 'walker-info.html',
  '/consumer-dashboard': 'consumer-dashboard.html', '/consumer-settings': 'consumer-settings.html',
  '/my-bookings': 'my-bookings.html', '/walker-bookings': 'walker-bookings.html',
  '/walker-dashboard': 'walker-dashboard.html', '/walker-onboarding': 'walker-onboarding.html',
  '/walker-settings': 'walker-settings.html', '/walker-availability': 'walker-availability.html',
  '/admin': 'admin.html', '/support': 'support.html', '/404': '404.html'
};

test('local page links, assets and anchor targets exist', () => {
  const broken = [];
  const pages = fs.readdirSync(publicDirectory).filter(file => /\.html$/i.test(file));
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDirectory, page), 'utf8');
    for (const [, raw] of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/gi)) {
      const url = new URL(raw, `http://snifr.local/${page}`);
      if (url.origin !== 'http://snifr.local' || url.pathname.startsWith('/api/')) continue;
      if (/^\/walker\/[^/]+$/.test(url.pathname) || routes[url.pathname] === null) continue;
      const relative = routes[url.pathname] || decodeURIComponent(url.pathname.slice(1));
      const absolute = path.resolve(publicDirectory, relative);
      if (!absolute.startsWith(publicDirectory) || !fs.existsSync(absolute)) {
        broken.push(`${page} -> ${raw}`);
      } else if (url.hash.length > 1 && /\.html$/i.test(relative) &&
          !fs.readFileSync(absolute, 'utf8').includes(`id="${url.hash.slice(1)}"`)) {
        broken.push(`${page} -> ${raw}`);
      }
    }
  }
  assert.deepEqual(broken, []);
});
