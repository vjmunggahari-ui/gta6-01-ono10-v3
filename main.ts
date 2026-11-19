// Solmar Bay — make.fun entrypoint: copy the game and its screenshots into
// the output directory and write the dossier the judge reads.
// Runs twice, writes the same bytes twice: node main.ts, with
// MAKEFUN_OUTPUT_DIR set to the output directory (or ./out by default).
// buildDossier returns the dossier as UTF-8 bytes: write them as-is.

import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = resolve(process.cwd());
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : resolve(repo, 'out');
const gameDir = join(repo, 'game');
const shotsDir = join(repo, 'screenshots');

mkdirSync(outDir, { recursive: true });
rmSync(join(outDir, 'game'), { recursive: true, force: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
if (existsSync(shotsDir)) {
  rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);
const parsed = JSON.parse(Buffer.from(dossier).toString('utf-8'));
const bytes = statSync(dossierPath).size;
console.log(`dossier written: ${dossierPath} (${bytes} bytes)`);
console.log(`schema: ${parsed.schema}, cover: ${parsed.cover}, images: ${parsed.images.length}, text bytes: ${parsed.text.length}`);
