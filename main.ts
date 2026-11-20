// Solmar Bay — make.fun entry program (Node 22, erasable TypeScript).
// Copies game/ and screenshots/ from the repository root into the output
// directory and writes dossier.json there with the kit's buildDossier.
//
// The grader mounts the repository read-only at /bot and sets
// MAKEFUN_OUTPUT_DIR=/output (an empty writable directory). This program
// therefore never writes under the repository root: every write goes under
// the output directory. Locally, with no MAKEFUN_OUTPUT_DIR set, it falls
// back to <repo>/output, which is the only directory it creates there.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || join(root, 'output');

function copyTree(src: string, dest: string): number {
  mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const to = join(dest, entry);
    if (statSync(from).isDirectory()) count += copyTree(from, to);
    else { copyFileSync(from, to); count++; }
  }
  return count;
}

const gameSrc = join(root, 'game');
const shotsSrc = join(root, 'screenshots');
if (!existsSync(join(gameSrc, 'index.html'))) {
  throw new Error('game/index.html not found under ' + root);
}
const copied = copyTree(gameSrc, join(out, 'game'))
  + (existsSync(shotsSrc) ? copyTree(shotsSrc, join(out, 'screenshots')) : 0);
writeFileSync(join(out, 'dossier.json'), buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));
console.log('copied ' + copied + ' files to ' + out);
console.log('dossier written to ' + join(out, 'dossier.json'));
