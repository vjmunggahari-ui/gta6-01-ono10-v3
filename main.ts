// Solmar Bay — entry program for the make.fun "Make GTA 6" bounty.
// Node 22, no build step: run `node main.ts` from the repository root.
// It stages the entry into /output (game/ + screenshots/) and writes
// /output/dossier.json with the kit library's buildDossier, under the
// bounty's gate caps. The scorer re-runs the same call on what is handed
// in, so the dossier written here must equal the one it computes.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = '/output';

// Gate caps for gta6-01: dossier text, screenshots, and the game tree.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Solmar Bay dossier: ${dossier.length} bytes -> ${join(outDir, 'dossier.json')}`);
