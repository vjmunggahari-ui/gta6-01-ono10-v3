// Solmar Bay — the hand-in program for make.fun's "Make GTA 6" (gta6-01).
//
// Node 22, standard library only. It takes the repository's game/ and
// screenshots/ and hands them to the grader: it copies both trees into the
// output directory and writes dossier.json there with buildDossier, the
// kit's own library in vendor/makefun-game.ts (left untouched).
//
// How to run it, from the repository root:
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//   node main.ts --out out
//
// --out wins over the environment variable, which wins over ./out.
// Deterministic: two runs over the same tree write byte-identical
// dossier.json. The program validates the entry before it writes
// anything, so a bad screenshot set or a missing index.html fails
// loudly here instead of failing the gate after submit.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The gate's caps, from the kit's RULES.txt and reference/gate.json.
// One table, so a drift between this program's checks and the
// scorer's checks is a one-line diff.
const LIMITS = {
  dossierBytes: 1572864, // 1.5 MiB
  textBytes: 163840, // 160 KiB of dossier text
  shots: { min: 3, max: 4, bytes: 262144 }, // 256 KiB each
  game: { entries: 993, bytes: 50331648, pathBytes: 1000 }, // files+dirs, 48 MiB
  shotLongSide: 1280,
  shotShortSide: 480,
} as const;

const SHOT_SUFFIXES = new Set(['.png', '.jpg', '.jpeg']);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function die(detail: string): never {
  console.error(`main.ts: ${detail}`);
  process.exit(1);
}

// --out <dir>, then --out=<dir>, then MAKEFUN_OUTPUT_DIR, then ./out.
function pickOutDir(argv: string[], fallback: string): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1] !== undefined) return argv[i + 1];
    if (arg.startsWith('--out=')) return arg.slice('--out='.length);
  }
  return process.env.MAKEFUN_OUTPUT_DIR ?? fallback;
}

// Width/height out of a PNG's IHDR chunk; null when the buffer is
// not a PNG at all (too short, wrong magic, no IHDR where it belongs).
function pngDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 33) return null;
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
}

// The screenshot set the gate will see, sorted by name (the first is
// the cover): 3 or 4 images, real PNG/JPEG files, each under the byte
// cap, and inside the pixel bounds for PNGs.
function collectShots(dir: string): string[] {
  if (!existsSync(dir)) {
    die('screenshots/ is missing: hand in 3 or 4 renders of the game');
  }
  const names = readdirSync(dir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (names.length < LIMITS.shots.min || names.length > LIMITS.shots.max) {
    die(`screenshots/ holds ${names.length} images, need ${LIMITS.shots.min}-${LIMITS.shots.max}`);
  }
  for (const name of names) {
    const file = join(dir, name);
    if (!statSync(file).isFile()) die(`screenshots/${name} is not a regular file`);
    const dot = name.lastIndexOf('.');
    if (dot < 0 || !SHOT_SUFFIXES.has(name.slice(dot).toLowerCase())) {
      die(`screenshots/${name} is not a PNG or JPEG`);
    }
    const buf = readFileSync(file);
    if (buf.length > LIMITS.shots.bytes) {
      die(`screenshots/${name} is ${buf.length} bytes, over the ${LIMITS.shots.bytes} cap`);
    }
    if (name.toLowerCase().endsWith('.png')) {
      const dims = pngDims(buf);
      if (dims === null) die(`screenshots/${name} does not parse as a PNG`);
      const long = Math.max(dims.w, dims.h);
      const short = Math.min(dims.w, dims.h);
      if (long > LIMITS.shotLongSide || short < LIMITS.shotShortSide) {
        die(
          `screenshots/${name} is ${dims.w}x${dims.h}, outside ` +
            `${LIMITS.shotShortSide}-${LIMITS.shotLongSide}px`,
        );
      }
    } else if (!isJpeg(buf)) {
      die(`screenshots/${name} does not start with a JPEG SOI marker`);
    }
  }
  return names;
}

// One walk of game/: count entries (files + directories, as the gate
// counts them), bytes, and fail on any path longer than the cap.
function collectGame(dir: string): { entries: number; bytes: number } {
  let entries = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      entries += 1;
      if (Buffer.byteLength(p, 'utf-8') > LIMITS.game.pathBytes) {
        die(`game path too long: ${p}`);
      }
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile()) {
        bytes += statSync(p).size;
      }
    }
  };
  walk(dir);
  if (entries > LIMITS.game.entries) {
    die(`game/ holds ${entries} entries, over the ${LIMITS.game.entries} cap`);
  }
  if (bytes > LIMITS.game.bytes) {
    die(`game/ is ${bytes} bytes, over the ${LIMITS.game.bytes} cap`);
  }
  return { entries, bytes };
}

function run(): void {
  // The repository root is where this file lives, never the caller's
  // working directory: the grader runs it from a read-only checkout.
  const repo = fileURLToPath(new URL('.', import.meta.url));
  const outDir = resolve(pickOutDir(process.argv.slice(2), join(repo, 'out')));
  const gameDir = join(repo, 'game');
  const shotsDir = join(repo, 'screenshots');

  if (!existsSync(join(gameDir, 'index.html'))) {
    die('game/index.html is missing: the game must open from game/');
  }
  const game = collectGame(gameDir);
  const shots = collectShots(shotsDir);

  // Clear the output directory first, so a stale dossier or a
  // screenshot from an earlier tree can never survive into this one.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: LIMITS.textBytes,
    screenshots: { max: LIMITS.shots.max, max_bytes: LIMITS.shots.bytes },
    game_max_files: LIMITS.game.entries,
    game_max_bytes: LIMITS.game.bytes,
    game_path_max_bytes: LIMITS.game.pathBytes,
  });
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  const dossierBytes = statSync(dossierPath).size;
  if (dossierBytes > LIMITS.dossierBytes) {
    die(`dossier.json is ${dossierBytes} bytes, over the ${LIMITS.dossierBytes} cap`);
  }
  const parsed = JSON.parse(Buffer.from(dossier).toString('utf-8')) as {
    schema?: string;
    images?: unknown[];
    text?: string;
  };
  if (parsed.schema !== 'makefun/dossier/v1' || parsed.images?.length !== shots.length) {
    die('dossier.json failed its own sanity check after writing');
  }
  console.log(`dossier written: ${dossierPath} (${dossierBytes} bytes)`);
  console.log(`game: ${game.entries} entries, ${game.bytes} bytes`);
  console.log(`screenshots: ${shots.length} (${shots[0]} is the cover)`);
  console.log(`schema: ${parsed.schema}, images: ${parsed.images?.length}, text bytes: ${parsed.text?.length}`);
}

run();
