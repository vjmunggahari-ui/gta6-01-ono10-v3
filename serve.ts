// Solmar Bay — a tiny static server for local play (v5, Session C rewrite).
//
//   node serve.ts [--port 8080] [--host 127.0.0.1]
//
// Then open http://localhost:8080 in a desktop browser. Serves game/ only —
// the playable game as static files, nothing else leaves the machine, and
// nothing is fetched from the network while you play.
//
// v5 vs v4: HEAD requests answer like GET without a body (so screenshot and
// link-check tools work against it); paths are resolved and then checked
// against the root with a separator-aware test, so `..` can never escape
// game/; unknown extensions get a safe binary type instead of a guess; and
// every response carries no-store, so a stale game is never served twice.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

// --port 8080, --port=8080, --host 127.0.0.1, or PORT / HOST env vars.
function parseArgs(argv: string[]): { port: number; host: string } {
  let port = Number(process.env.PORT ?? 8080);
  let host = process.env.HOST ?? '127.0.0.1';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) port = Number(argv[i + 1]);
    else if (arg.startsWith('--port=')) port = Number(arg.slice('--port='.length));
    else if (arg === '--host' && argv[i + 1]) host = argv[i + 1];
    else if (arg.startsWith('--host=')) host = arg.slice('--host='.length);
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    console.error(`serve.ts: bad port: ${port}`);
    process.exit(1);
  }
  return { port, host };
}

const { port, host } = parseArgs(process.argv.slice(2));
const root = resolve(process.cwd(), 'game');

function insideRoot(file: string): boolean {
  return file === root || file.startsWith(root + sep);
}

function notFound(res: import('node:http').ServerResponse): void {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('not found\n');
}

const server = createServer(async (req, res) => {
  const stamp = new Date().toISOString();
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' });
      res.end('method not allowed\n');
      return;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = resolve(root, `.${path}`);
    if (!insideRoot(file) || !existsSync(file) || !statSync(file).isFile()) {
      console.log(`${stamp} ${req.method} ${url.pathname} -> 404`);
      notFound(res);
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': data.length,
      'cache-control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
    console.log(`${stamp} ${req.method} ${url.pathname} -> 200 (${data.length} bytes)`);
  } catch (err) {
    console.error(`${stamp} ${req.method} ${req.url} -> 500`, err);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res.end('server error\n');
  }
});

server.listen(port, host, () => {
  console.log(`Solmar Bay at http://${host}:${port} (serving ${root})`);
});
