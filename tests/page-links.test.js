const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const routes = { '/':'landingpage.html','/auth':'authpage.html','/dashboard':'Dashboard.HTML','/walkers':'walkersearch.html' };

test('local page links, assets and anchor targets exist', () => {
  const files = fs.readdirSync(root);
  const broken = [];
  for (const page of files.filter(file => /\.html$/i.test(file))) {
    const html = fs.readFileSync(path.join(root,page),'utf8');
    for (const [,raw] of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/gi)) {
      const url = new URL(raw,'http://snifr.local/'+page);
      if (url.origin !== 'http://snifr.local') continue;
      let file = routes[url.pathname] || decodeURIComponent(url.pathname.slice(1));
      if (!path.extname(file)) file += '.html';
      const absolute = path.join(root,file);
      if (!fs.existsSync(absolute) || (!file.includes('/') && !files.includes(file))) broken.push(page+' → '+raw);
      else if (url.hash.length > 1 && /\.html$/i.test(file) && !fs.readFileSync(absolute,'utf8').includes('id="'+url.hash.slice(1)+'"'))
        broken.push(page+' → '+raw);
    }
  }
  assert.deepEqual(broken,[]);
});
