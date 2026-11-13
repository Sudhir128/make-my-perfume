/**
 * Pure TypeScript ISO/IEC 18004 QR Code matrix generator (Versions 2–5, ECC Level L, Byte mode).
 * Zero external runtime dependencies; generates crisp inline SVG QR codes for UPI checkout links.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
}

const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[(GF_LOG[a]! + GF_LOG[b]!) % 255]!);

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i]!;
    for (let j = 0; j < poly.length; j++) {
      next[j]! ^= poly[j]!;
      next[j + 1]! ^= gfMul(poly[j]!, root);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i]!;
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      res[i + j]! ^= gfMul(gen[j]!, coef);
    }
  }
  return res.slice(data.length);
}

const VERSIONS = [
  { v: 2, size: 25, dataBytes: 34, ecBytes: 10, align: 18 },
  { v: 3, size: 29, dataBytes: 55, ecBytes: 15, align: 22 },
  { v: 4, size: 33, dataBytes: 80, ecBytes: 20, align: 26 },
  { v: 5, size: 37, dataBytes: 108, ecBytes: 26, align: 30 },
] as const;

function placeFinder(grid: Int8Array, fixed: Uint8Array, size: number, r0: number, c0: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = r0 + r;
      const cc = c0 + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const dark =
        r >= 0 &&
        r <= 6 &&
        c >= 0 &&
        c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      grid[rr * size + cc] = dark ? 1 : 0;
      fixed[rr * size + cc] = 1;
    }
  }
}

function placeAlignment(grid: Int8Array, fixed: Uint8Array, size: number, center: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = center + r;
      const cc = center + c;
      const dark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      grid[rr * size + cc] = dark ? 1 : 0;
      fixed[rr * size + cc] = 1;
    }
  }
}

function encodeFormat(maskId: number): number {
  // ECC Level L = 01 binary (bits 4..3), Mask ID = bits 2..0
  const data = (0b01 << 3) | (maskId & 0b111);
  let bits = data << 10;
  const poly = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((bits >> i) & 1) bits ^= poly << (i - 10);
  }
  return ((data << 10) | bits) ^ 0b101010000010010;
}

function writeFormat(grid: Int8Array, size: number, maskId: number) {
  const fmt = encodeFormat(maskId);
  for (let i = 0; i <= 5; i++) {
    const bit = (fmt >> i) & 1;
    grid[8 * size + i] = bit;
    grid[(size - 1 - i) * size + 8] = bit;
  }
  grid[8 * size + 7] = (fmt >> 6) & 1;
  grid[8 * size + 8] = (fmt >> 7) & 1;
  grid[7 * size + 8] = (fmt >> 8) & 1;
  grid[(size - 7) * size + 8] = (fmt >> 6) & 1;
  grid[8 * size + (size - 8)] = (fmt >> 7) & 1;
  grid[8 * size + (size - 7)] = (fmt >> 8) & 1;
  for (let i = 9; i < 15; i++) {
    const bit = (fmt >> i) & 1;
    grid[(14 - i) * size + 8] = bit;
    grid[8 * size + (size - 15 + i)] = bit;
  }
}

export interface QrMatrix {
  size: number;
  modules: number[];
}

export function generateQrMatrix(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const spec = VERSIONS.find((v) => bytes.length + 2 <= v.dataBytes) ?? VERSIONS[VERSIONS.length - 1]!;
  const maxBytes = Math.min(bytes.length, spec.dataBytes - 2);

  const bitBuf: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bitBuf.push((val >> i) & 1);
  };
  pushBits(0b0100, 4); // Byte mode
  pushBits(maxBytes, 8);
  for (let i = 0; i < maxBytes; i++) pushBits(bytes[i]!, 8);
  pushBits(0, Math.min(4, spec.dataBytes * 8 - bitBuf.length));
  while (bitBuf.length % 8 !== 0) bitBuf.push(0);

  const data = new Uint8Array(spec.dataBytes);
  for (let i = 0; i < bitBuf.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bitBuf[i * 8 + j]!;
    data[i] = b;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bitBuf.length / 8, p = 0; i < spec.dataBytes; i++, p++) {
    data[i] = padBytes[p % 2]!;
  }

  const ec = rsRemainder(data, spec.ecBytes);
  const full = new Uint8Array(data.length + ec.length);
  full.set(data);
  full.set(ec, data.length);

  const size = spec.size;
  const baseGrid = new Int8Array(size * size).fill(-1);
  const fixed = new Uint8Array(size * size);

  placeFinder(baseGrid, fixed, size, 0, 0);
  placeFinder(baseGrid, fixed, size, 0, size - 7);
  placeFinder(baseGrid, fixed, size, size - 7, 0);
  placeAlignment(baseGrid, fixed, size, spec.align);

  for (let i = 8; i < size - 8; i++) {
    baseGrid[6 * size + i] = i % 2 === 0 ? 1 : 0;
    fixed[6 * size + i] = 1;
    baseGrid[i * size + 6] = i % 2 === 0 ? 1 : 0;
    fixed[i * size + 6] = 1;
  }
  baseGrid[(size - 8) * size + 8] = 1;
  fixed[(size - 8) * size + 8] = 1;

  // Reserve format info cells
  for (let i = 0; i < 9; i++) {
    fixed[8 * size + i] = 1;
    fixed[i * size + 8] = 1;
  }
  for (let i = 0; i < 8; i++) {
    fixed[8 * size + (size - 1 - i)] = 1;
    fixed[(size - 1 - i) * size + 8] = 1;
  }

  // Zigzag bitstream placement
  let bitIdx = 0;
  const totalBits = full.length * 8;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    const up = ((size - 1 - col) >> 1) % 2 === 0;
    for (let step = 0; step < size; step++) {
      const r = up ? size - 1 - step : step;
      for (const dc of [0, -1]) {
        const c = col + dc;
        const idx = r * size + c;
        if (fixed[idx]) continue;
        const bit = bitIdx < totalBits ? (full[bitIdx >> 3]! >> (7 - (bitIdx & 7))) & 1 : 0;
        baseGrid[idx] = bit;
        bitIdx++;
      }
    }
  }

  // Evaluate standard mask patterns (0..7) for cleanest scan readability
  const masks: Array<(r: number, c: number) => boolean> = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  let bestGrid = baseGrid;
  let bestScore = Infinity;

  for (let m = 0; m < masks.length; m++) {
    const g = new Int8Array(baseGrid);
    const fn = masks[m]!;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!fixed[r * size + c] && fn(r, c)) g[r * size + c]! ^= 1;
      }
    }
    writeFormat(g, size, m);

    let score = 0;
    let dark = 0;
    for (let r = 0; r < size; r++) {
      let runLen = 1;
      let prev = g[r * size]!;
      if (prev) dark++;
      for (let c = 1; c < size; c++) {
        const cur = g[r * size + c]!;
        if (cur) dark++;
        if (cur === prev) {
          runLen++;
          if (runLen === 5) score += 3;
          else if (runLen > 5) score += 1;
        } else {
          runLen = 1;
          prev = cur;
        }
      }
    }
    for (let c = 0; c < size; c++) {
      let runLen = 1;
      let prev = g[c]!;
      for (let r = 1; r < size; r++) {
        const cur = g[r * size + c]!;
        if (cur === prev) {
          runLen++;
          if (runLen === 5) score += 3;
          else if (runLen > 5) score += 1;
        } else {
          runLen = 1;
          prev = cur;
        }
      }
    }
    score += Math.abs(Math.round((dark * 100) / (size * size) - 50) / 5) * 10;
    if (score < bestScore) {
      bestScore = score;
      bestGrid = g;
    }
  }

  return { size, modules: Array.from(bestGrid) };
}

