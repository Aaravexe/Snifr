const path = require('node:path');

const blockedTopLevel = new Set(['server', 'data', 'node_modules', 'tests', 'snifr bookings', 'snifr accounts']);
const blockedFiles = new Set(['server.js', 'package.json', 'package-lock.json', 'accounts.json', '.env', '.env.example']);

function blockPrivateFiles(root) {
  return (req, res, next) => {
    const rawPath = decodeURIComponent(req.path || '/');
    const relative = path.relative(root, path.resolve(root, `.${rawPath}`));
    const normalized = relative.split(path.sep).join('/').toLowerCase();
    const firstPart = normalized.split('/')[0];
    const outsideRoot = normalized.startsWith('../') || normalized === '..';
    const isPrivate = firstPart.startsWith('.') || blockedTopLevel.has(firstPart) || blockedFiles.has(normalized);
    if (outsideRoot || isPrivate) return res.status(403).type('text').send('Forbidden');
    next();
  };
}

module.exports = blockPrivateFiles;
