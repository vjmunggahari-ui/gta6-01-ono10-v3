// Solmar Bay — tiny local static server for the screenshot pipeline.
// Serves the workdir root so /game/index.html and /screenshots/* load over
// HTTP with no-store headers (fresh files every run).
// Usage: node --experimental-strip-types serve.ts [port]  (default 8080)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.ts': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.css': 'text/css',
};

const port = Number(process.argv[2] || 8080);
const root = process.cwd();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (url.pathname === '/') path = join(root, 'game', 'index.html');
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': MIME[extname(path)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`Solmar Bay serving ${root} on http://localhost:${port}`);
});
