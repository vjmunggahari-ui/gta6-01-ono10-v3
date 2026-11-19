// Solmar Bay — make.fun entrypoint (v5, Session C rewrite).
//
// Hands the game in: copies game/ and screenshots/ from this repository
// into the output directory and writes the dossier the judge reads, with
// buildDossier from vendor/makefun-game.ts.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts     (or: node main.ts --out out)
//
// Deterministic: run it twice on the same tree and dossier.json comes out
// byte-identical. It validates the entry before writing anything — a bad
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
import { buildDossier } from './vendor/makefun-game.ts';

// The gate's caps, from the kit's RULES.txt — kept here so a drift between
// what we check and what the scorer checks is visible in one place.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;
const MIN_SCREENSHOTS = 3;
const SHOT_EXTS = new Set(['.png', '.jpg', '.jpeg']);
const MAX_LONG_SIDE = 1280;
const MIN_SHORT_SIDE = 480;

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// --out <dir> beats MAKEFUN_OUTPUT_DIR beats ./out.
function parseOutDir(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out' && argv[i + 1]) return argv[i + 1];
    if (argv[i].startsWith('--out=')) return argv[i].slice('--out='.length);
  }
  return undefined;
}

// PNG dimensions straight from the IHDR chunk — no decoder needed, and a
// truncated or non-PNG file fails the check instead of passing silently.
function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 33) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Every screenshot the gate will see: 3 or 4 files, image extensions,
// under the byte cap, and (for PNGs) within the pixel bounds. The first
// by name is the cover, so the names are checked sorted.
function checkScreenshots(dir: string): string[] {
  if (!existsSync(dir)) fail('screenshots/ is missing: an entry hands in 3 or 4 renders of its game');
  const names = readdirSync(dir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (names.length < MIN_SCREENSHOTS || names.length > CAPS.screenshots.max) {
    fail(`screenshots/ holds ${names.length} images, need ${MIN_SCREENSHOTS}-${CAPS.screenshots.max}`);
  }
  for (const name of names) {
    const file = join(dir, name);
    if (!statSync(file).isFile()) fail(`screenshots/${name} is not a regular file`);
    if (!SHOT_EXTS.has(name.slice(name.lastIndexOf('.')).toLowerCase())) {
      fail(`screenshots/${name} is not a PNG or JPEG`);
    }
    const size = statSync(file).size;
    if (size > CAPS.screenshots.max_bytes) {
      fail(`screenshots/${name} is ${size} bytes, over the ${CAPS.screenshots.max_bytes} cap`);
    }
    if (name.toLowerCase().endsWith('.png')) {
      const dims = pngDimensions(readFileSync(file));
      if (!dims) fail(`screenshots/${name} does not parse as a PNG`);
      const long = Math.max(dims.width, dims.height);
      const short = Math.min(dims.width, dims.height);
      if (long > MAX_LONG_SIDE || short < MIN_SHORT_SIDE) {
        fail(`screenshots/${name} is ${dims.width}x${dims.height}, outside ${MIN_SHORT_SIDE}-${MAX_LONG_SIDE}px`);
      }
    }
  }
  return names;
}

// Walk game/ once: file count and total bytes against the gate's caps.
function checkGame(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) {
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
  const repo = resolve(process.cwd());
  const outDir = resolve(parseOutDir(process.argv.slice(2))
    ?? process.env.MAKEFUN_OUTPUT_DIR
    ?? join(repo, 'out'));
  const gameDir = join(repo, 'game');
  const shotsDir = join(repo, 'screenshots');

  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html is missing: the game must open from game/');
  }
  const game = checkGame(gameDir);
  const shots = checkScreenshots(shotsDir);

  // Wipe the whole output directory first: a stale dossier or screenshot
  // from an earlier tree must never survive into this one.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, CAPS);
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  const parsed = JSON.parse(Buffer.from(dossier).toString('utf-8'));
  if (parsed.schema === undefined || parsed.images.length !== shots.length) {
    fail('dossier.json failed its own sanity check after writing');
  }
  const bytes = statSync(dossierPath).size;
  console.log(`dossier written: ${dossierPath} (${bytes} bytes)`);
  console.log(`game: ${game.files} files, ${game.bytes} bytes`);
  console.log(`screenshots: ${shots.length} (${shots[0]} is the cover)`);
  console.log(`schema: ${parsed.schema}, images: ${parsed.images.length}, text bytes: ${parsed.text.length}`);
}

main();
