// Solmar Bay — entrypoint (Node 22, stdlib only).
// Copies game/ and screenshots/ into /output, then writes /output/dossier.json
// with the make.fun library's buildDossier. The scorer re-runs buildDossier
// on the same directory, so the dossier must be built from /output itself.
// Usage: node main.ts [workdir] — defaults to the directory holding this file.

import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ? process.argv[2] : HERE;
const out = join(root, 'output');

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function mustExist(path, what) {
  if (!existsSync(path)) {
    throw new Error(`missing ${what}: ${path}`);
  }
}

// A stale output would let the dossier describe files that are no longer
// there, so the directory is rebuilt from scratch every run.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
mustExist(gameDir, 'game/ directory');
mustExist(join(gameDir, 'index.html'), 'game/index.html');
mustExist(shotsDir, 'screenshots/ directory');

cpSync(gameDir, join(out, 'game'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier.json written: ${dossier.length} bytes`);
