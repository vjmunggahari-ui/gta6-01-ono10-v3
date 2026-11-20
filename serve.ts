// Solmar Bay — local static server for the screenshot pipeline.
// Run: node --experimental-strip-types serve.ts [port]  (default 8080)
// Serves game/ at / and screenshots/ at /screenshots/. Read-only, no
// directory listings, no path traversal.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.argv[2] ?? 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function resolvePath(urlPath: string): string | null {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/') p = '/game/index.html';
  else if (p.startsWith('/src/')) p = '/game' + p;
  else if (p.startsWith('/game/') || p.startsWith('/screenshots/')) p = p;
  else return null;
  const full = normalize(join(root, p));
  if (!full.startsWith(root + sep)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  try {
    const full = resolvePath(req.url ?? '/');
    if (!full) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found\n');
      return;
    }
    const data = await readFile(full);
    res.writeHead(200, { 'content-type': TYPES[extname(full)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
  }
});

server.listen(port, () => {
  console.log(`Solmar Bay server on http://localhost:${port}/`);
});
