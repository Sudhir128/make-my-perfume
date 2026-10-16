#!/usr/bin/env node
/**
 * Cut candidate house-bottle crops from the supplied posters.
 *
 *   node scripts/derive-crops.mjs
 *
 * Posters are only read. Candidates are written at native resolution (no
 * upscaling) to scrollcraft/lab/crops/, which is git-ignored and is not an app
 * asset folder. Each candidate must be inspected at full size and given a
 * verdict in docs/crop-audit.md. Promotion into src/assets is a separate,
 * manual step that requires a passing audit and the owner's review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTERS = path.join(ROOT, 'Make my perfume', 'posters');
const OUT = path.join(ROOT, 'scrollcraft', 'lab', 'crops');
const { candidates } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'crops.json'), 'utf8'));

fs.mkdirSync(OUT, { recursive: true });

for (const c of candidates) {
  const src = path.join(POSTERS, c.poster);
  const { width, height } = await sharp(src).metadata();
  const b = c.box;
  if (b.left + b.width > width || b.top + b.height > height) {
    throw new Error(`${c.id}: box exceeds ${width}x${height}`);
  }
  const file = path.join(OUT, `${c.id}.png`);
  await sharp(src).extract(b).png().toFile(file);
  console.log(`wrote scrollcraft/lab/crops/${c.id}.png  (${b.width}x${b.height} from ${c.poster})`);
}
