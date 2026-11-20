// Solmar Bay — the entrypoint for make.fun's "Make GTA 6" (gta6-01).
//
// Node 22, standard library only. It hands the game in: it copies game/ and
// screenshots/ from beside this file into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts, the
// kit's own library (untouched). Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output, and --out <dir> beats both:
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//   node main.ts --out out
//
// Deterministic: two runs over the same tree write byte-identical
// dossier.json. It validates the entry before writing anything, so a bad
// screenshot set or a missing index.html fails loudly here instead of
// failing the gate after submit.

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

// The scorer's caps, straight from the kit's RULES.txt and
// reference/gate.json. Kept in one place so a drift between what this
// program checks and what the scorer checks is easy to spot.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;
const DOSSIER_MAX_BYTES = 1572864; // 1.5 MiB, the gate's dossier cap.
const MIN_SHOTS = 3;
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg']);
const LONG_SIDE_MAX = 1280;
const SHORT_SIDE_MIN = 480;

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// --out <dir> beats --out=<dir> beats MAKEFUN_OUTPUT_DIR beats ./out.
function outDirFrom(argv: string[], fallback: string): string {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out' && argv[i + 1]) return argv[i + 1];
    if (argv[i].startsWith('--out=')) return argv[i].slice('--out='.length);
  }
  return process.env.MAKEFUN_OUTPUT_DIR ?? fallback;
}

// PNG width/height straight from the IHDR chunk. A file too short to hold
// an IHDR, or with the wrong magic, is not a PNG at all.
function pngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 33) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// A JPEG is accepted when it starts with the SOI marker; the gate checks
// its pixels, this program checks it is really a JPEG and under the cap.
function isJpeg(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
}

// Every screenshot the gate will see, in sorted order (the first by name
// is the cover): 3 or 4 files, image extensions, under the byte cap, and
// within the pixel bounds for PNGs.
function checkShots(dir: string): string[] {
  if (!existsSync(dir)) fail('screenshots/ is missing: hand in 3 or 4 renders of the game');
  const names = readdirSync(dir).filter((n) => !n.startsWith('.')).sort();
  if (names.length < MIN_SHOTS || names.length > CAPS.screenshots.max) {
    fail(`screenshots/ holds ${names.length} images, need ${MIN_SHOTS}-${CAPS.screenshots.max}`);
  }
  for (const name of names) {
    const file = join(dir, name);
    if (!statSync(file).isFile()) fail(`screenshots/${name} is not a regular file`);
    const dot = name.lastIndexOf('.');
    if (dot < 0 || !IMAGE_EXTS.has(name.slice(dot).toLowerCase())) {
      fail(`screenshots/${name} is not a PNG or JPEG`);
    }
    const size = statSync(file).size;
    if (size > CAPS.screenshots.max_bytes) {
      fail(`screenshots/${name} is ${size} bytes, over the ${CAPS.screenshots.max_bytes} cap`);
    }
    const buf = readFileSync(file);
    if (name.toLowerCase().endsWith('.png')) {
      const dims = pngSize(buf);
      if (!dims) fail(`screenshots/${name} does not parse as a PNG`);
      const long = Math.max(dims.width, dims.height);
      const short = Math.min(dims.width, dims.height);
      if (long > LONG_SIDE_MAX || short < SHORT_SIDE_MIN) {
        fail(`screenshots/${name} is ${dims.width}x${dims.height}, outside ${SHORT_SIDE_MIN}-${LONG_SIDE_MAX}px`);
      }
    } else if (!isJpeg(buf)) {
      fail(`screenshots/${name} does not start with a JPEG SOI marker`);
    }
  }
  return names;
}

// Walk game/ once and count files and bytes against the gate's caps. A
// path longer than the cap fails here, not at the scorer.
function checkGame(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile()) {
        files += 1;
        bytes += statSync(p).size;
        if (Buffer.byteLength(p, 'utf-8') > CAPS.game_path_max_bytes) {
          fail(`game path too long: ${p}`);
        }
      }
    }
  };
  walk(dir);
  if (files > CAPS.game_max_files) fail(`game/ holds ${files} files, over the ${CAPS.game_max_files} cap`);
  if (bytes > CAPS.game_max_bytes) fail(`game/ is ${bytes} bytes, over the ${CAPS.game_max_bytes} cap`);
  return { files, bytes };
}

function main(): void {
  // The repository root is where this file lives, not the caller's cwd:
  // the grader runs it from a read-only checkout of the repo.
  const repo = fileURLToPath(new URL('.', import.meta.url));
  const outDir = resolve(outDirFrom(process.argv.slice(2), join(repo, 'out')));
  const gameDir = join(repo, 'game');
  const shotsDir = join(repo, 'screenshots');

  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html is missing: the game must open from game/');
  }
  const game = checkGame(gameDir);
  const shots = checkShots(shotsDir);

  // Wipe the output directory first so a stale dossier or screenshot
  // from an earlier tree can never survive into this one.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, CAPS);
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  const dossierBytes = statSync(dossierPath).size;
  if (dossierBytes > DOSSIER_MAX_BYTES) {
    fail(`dossier.json is ${dossierBytes} bytes, over the ${DOSSIER_MAX_BYTES} cap`);
  }
  const parsed = JSON.parse(Buffer.from(dossier).toString('utf-8'));
  if (parsed.schema === undefined || parsed.images.length !== shots.length) {
    fail('dossier.json failed its own sanity check after writing');
  }
  console.log(`dossier written: ${dossierPath} (${dossierBytes} bytes)`);
  console.log(`game: ${game.files} files, ${game.bytes} bytes`);
  console.log(`screenshots: ${shots.length} (${shots[0]} is the cover)`);
  console.log(`schema: ${parsed.schema}, images: ${parsed.images.length}, text bytes: ${parsed.text.length}`);
}

main();
