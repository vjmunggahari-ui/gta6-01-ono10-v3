// Solmar Bay — gta6-01 entrypoint (Node 22).
// Copies game/ and screenshots/ into an output directory and writes the
// dossier.json the house judge grades, via the kit's vendor library.
// Deterministic: the same tree always yields the same dossier bytes.
// Note: buildDossier returns canonical JSON *bytes* (Uint8Array), so decode
// to a string before parsing, hashing, or writing.
// Usage: node main.ts <outDir>   (or: node main.ts --out <outDir>)
import { buildDossier, DOSSIER_SCHEMA } from './vendor/makefun-game.ts';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

interface Limits {
  text_max_bytes: number;
  screenshots: { max: number; max_bytes: number };
  game_max_files: number;
  game_max_bytes: number;
}

const LIMITS: Limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
};

const SHOT_EXT = '.png';

function pickOutDir(argv: string[]): string {
  const flag = argv.indexOf('--out');
  if (flag >= 0 && argv[flag + 1]) return resolve(argv[flag + 1]);
  const positional = argv.find((a) => !a.startsWith('-'));
  return resolve(positional ?? 'out');
}

function pngDims(file: string): { w: number; h: number } {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`not a PNG: ${file}`);
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function collectGame(gameDir: string): { files: number; dirs: number; bytes: number } {
  let files = 0;
  let dirs = 0;
  let bytes = 0;
  const walk = (dir: string): void => {
    dirs += 1;
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        files += 1;
        bytes += st.size;
      }
    }
  };
  walk(gameDir);
  return { files, dirs, bytes };
}

function collectShots(shotsDir: string): string[] {
  if (!existsSync(shotsDir)) return [];
  return readdirSync(shotsDir)
    .filter((n) => n.toLowerCase().endsWith(SHOT_EXT))
    .sort();
}

function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) copyTree(s, d);
    else copyFileSync(s, d);
  }
}

function main(): void {
  const root = resolve(dirname(new URL(import.meta.url).pathname));
  const outDir = pickOutDir(process.argv.slice(2));
  const gameDir = join(root, 'game');
  const shotsDir = join(root, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing — nothing to enter');
  }
  const game = collectGame(gameDir);
  const shots = collectShots(shotsDir);
  if (shots.length < 3 || shots.length > LIMITS.screenshots.max) {
    throw new Error(`need 3–${LIMITS.screenshots.max} screenshots, found ${shots.length}`);
  }
  for (const shot of shots) {
    const p = join(shotsDir, shot);
    const size = statSync(p).size;
    if (size > LIMITS.screenshots.max_bytes) {
      throw new Error(`screenshot ${shot} is ${size} bytes, over the ${LIMITS.screenshots.max_bytes} cap`);
    }
    const { w, h } = pngDims(p);
    if (w > 1280 || h < 480) throw new Error(`screenshot ${shot} is ${w}x${h}, outside the size gate`);
  }
  if (game.files + game.dirs > LIMITS.game_max_files) {
    throw new Error(`game/ has ${game.files + game.dirs} files+dirs, over the ${LIMITS.game_max_files} cap`);
  }
  if (game.bytes > LIMITS.game_max_bytes) {
    throw new Error(`game/ is ${game.bytes} bytes, over the ${LIMITS.game_max_bytes} cap`);
  }
  mkdirSync(outDir, { recursive: true });
  copyTree(gameDir, join(outDir, 'game'));
  copyTree(shotsDir, join(outDir, 'screenshots'));
  const dossier = Buffer.from(buildDossier(outDir, LIMITS)).toString('utf8');
  const parsed = JSON.parse(dossier) as { schema?: string; text?: string };
  if (parsed.schema !== DOSSIER_SCHEMA) {
    throw new Error(`dossier schema is ${String(parsed.schema)}, expected ${DOSSIER_SCHEMA}`);
  }
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  const sha = createHash('sha256').update(dossier, 'utf8').digest('hex');
  const bytes = Buffer.byteLength(dossier, 'utf8');
  const textBytes = parsed.text ? Buffer.byteLength(parsed.text, 'utf8') : 0;
  console.log(`dossier ${bytes} bytes, sha256 ${sha}`);
  console.log(`game ${game.files} files + ${game.dirs} dirs, ${game.bytes} bytes; ${shots.length} screenshots`);
  console.log(`dossier text ${textBytes} bytes (cap ${LIMITS.text_max_bytes})`);
  console.log(`wrote ${dossierPath}`);
}

main();
