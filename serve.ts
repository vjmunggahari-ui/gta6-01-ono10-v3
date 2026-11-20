// Solmar Bay — local static server for the screenshot pipeline.
// Run: node --experimental-strip-types serve.ts [port]  (default 8080)
// Serves the workdir root so /game/index.html loads with its modules.
// No-store cache headers so the headless screenshots always see fresh files.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const port = Number(process.argv[2] || 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
    if (path === '/') path = '/game/index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`Solmar Bay server on http://127.0.0.1:${port}/`);
});
