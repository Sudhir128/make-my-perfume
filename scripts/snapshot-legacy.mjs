#!/usr/bin/env node
/**
 * Snapshot the six provisional products from the legacy site's public API.
 *
 *   node scripts/snapshot-legacy.mjs
 *
 * Writes two files:
 *   docs/legacy/api-products.raw.json   the response exactly as served, for traceability
 *   src/data/legacy/products.json       the curated subset the prototype may display
 *
 * Fields dropped from the curated file: images (Unsplash stock), gallery,
 * compare_at_price, rating, review_count, badge. Longevity and ingredients are
 * kept for the product page (owner decision 2026-10-16). Every curated record
 * is marked unconfirmed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://makemyperfume.vercel.app/api/products';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE} answered ${res.status}`);
const raw = await res.json();
const retrieved = new Date().toISOString().slice(0, 10);

if (!Array.isArray(raw.items) || raw.items.length !== 6) {
  throw new Error(`Expected 6 products, got ${raw.items?.length}. Review the source before snapshotting.`);
}

const products = raw.items.map((p) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  collection: p.collection,
  tagline: p.tagline,
  description: p.description,
  price: p.price,
  sizeMl: p.size_ml,
  notes: { top: p.top_notes, heart: p.heart_notes, base: p.base_notes },
  sillage: p.sillage,
  longevity: p.longevity,
  ingredients: p.ingredients,
  provenance: { source: 'legacy-site', confirmed: false, ref: `${SOURCE}/${p.slug}`, retrieved },
}));

const write = (rel, data) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`wrote ${rel}`);
};

write('docs/legacy/api-products.raw.json', { source: SOURCE, retrieved, response: raw });
write('src/data/legacy/products.json', products);
