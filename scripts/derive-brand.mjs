#!/usr/bin/env node
/**
 * Derive web-sized brand assets from the supplied logo.
 *
 *   node scripts/derive-brand.mjs
 *
 * The original in "Make my perfume/Logo/" is only read. Outputs:
 *   src/assets/brand/seal-{160,320,640}.webp   the full seal, for the site
 *   public/favicon-32.png, public/apple-touch-icon.png
 *                                              the flask mark cropped from the seal,
 *                                              because the full seal is unreadable at 32px
 *
 * The logo has no alpha channel (pure #000 ground). The site shows it with
 * mix-blend-mode: lighten on dark grounds instead of keying it here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'Make my perfume', 'Logo', 'Make my perfume logo.png');

// The flask, pipette and bubbles in the 1254px source, kept inside the outer
// ring (a wider box catches the ring's arc), then padded square on black.
const FLASK = { left: 428, top: 148, width: 330, height: 452 };

const out = (rel) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
};

const meta = await sharp(SOURCE).metadata();
if (meta.width !== 1254 || meta.height !== 1254) {
  throw new Error(`Unexpected logo size ${meta.width}x${meta.height}; re-measure the flask crop.`);
}

for (const size of [160, 320, 640]) {
  await sharp(SOURCE).resize(size, size, { kernel: 'lanczos3' }).webp({ quality: 88 }).toFile(out(`src/assets/brand/seal-${size}.webp`));
  console.log(`wrote src/assets/brand/seal-${size}.webp`);
}

for (const [rel, size] of [['public/favicon-32.png', 32], ['public/apple-touch-icon.png', 180]]) {
  const pad = Math.round(size * 0.08);
  await sharp(SOURCE)
    .extract(FLASK)
    .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background: '#000000', kernel: 'lanczos3' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#000000' })
    .png()
    .toFile(out(rel));
  console.log(`wrote ${rel}`);
}
