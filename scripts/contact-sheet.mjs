#!/usr/bin/env node
/**
 * Tile screenshots into a labelled contact sheet with sharp (FFmpeg is
 * excluded from this project; Scroll-Craft's shoot.mjs needs it for sheets).
 *
 *   node scripts/contact-sheet.mjs <out.png> <columns> <cellWidth> <in1.png> [in2.png ...]
 *
 * Each cell is resized to cellWidth (aspect kept, top-aligned) and labelled
 * with its file name.
 */
import path from 'node:path';
import sharp from 'sharp';

const [out, colsArg, widthArg, ...inputs] = process.argv.slice(2);
if (!out || !colsArg || !widthArg || inputs.length === 0) {
  console.error('usage: contact-sheet.mjs <out.png> <columns> <cellWidth> <images...>');
  process.exit(1);
}
const cols = Number(colsArg);
const cellW = Number(widthArg);
const label = 28;
const gap = 12;

const cells = await Promise.all(
  inputs.map(async (file) => {
    const buf = await sharp(file).resize({ width: cellW }).png().toBuffer();
    const { height } = await sharp(buf).metadata();
    return { file, buf, height: height ?? 0 };
  }),
);

const rows = Math.ceil(cells.length / cols);
const rowHeights = Array.from({ length: rows }, (_, r) => Math.max(...cells.slice(r * cols, r * cols + cols).map((c) => c.height)) + label);
const width = cols * cellW + (cols + 1) * gap;
const height = rowHeights.reduce((a, b) => a + b, 0) + (rows + 1) * gap;

const escape = (s) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
const composites = [];
let y = gap;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const cell = cells[r * cols + c];
    if (!cell) continue;
    const x = gap + c * (cellW + gap);
    const text = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${label}"><text x="2" y="19" font-family="Segoe UI, sans-serif" font-size="15" fill="#1a1612">${escape(path.basename(cell.file))}</text></svg>`,
    );
    composites.push({ input: text, left: x, top: y });
    composites.push({ input: cell.buf, left: x, top: y + label });
  }
  y += rowHeights[r] + gap;
}

await sharp({ create: { width, height, channels: 3, background: '#e6e0d6' } }).composite(composites).png().toFile(out);
console.log(`wrote ${out} (${cells.length} cells, ${width}x${height})`);
