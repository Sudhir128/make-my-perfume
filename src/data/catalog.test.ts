import { describe, expect, it } from 'vitest';
import { deriveNotes, getCollections, getProductBySlug, getProducts } from './catalog';
import { formatINR } from '../lib/format';

describe('catalog', () => {
  it('exposes the six provisional products unchanged', () => {
    expect(getProducts()).toHaveLength(6);
    expect(getProductBySlug('amber-veil')).toMatchObject({ name: 'Amber Veil', price: 1490, sizeMl: 50 });
    expect(getProductBySlug('nope')).toBeUndefined();
  });

  it('lists the six legacy collections', () => {
    expect(getCollections().sort()).toEqual(['Aquatic', 'Floral', 'Fresh', 'Sweet', 'Warm', 'Woody']);
  });

  it('derives notes only from product pyramids', () => {
    const notes = deriveNotes();
    const fromData = new Set(getProducts().flatMap((p) => [...p.notes.top, ...p.notes.heart, ...p.notes.base]));
    expect(new Set(notes.map((n) => n.name))).toEqual(fromData);
  });

  it('merges a note shared by several products at the same tier', () => {
    const musk = deriveNotes().find((n) => n.id === 'base-musk');
    expect(musk?.productSlugs.sort()).toEqual(['azure-skin', 'saffron-neroli', 'velvet-fig']);
  });

  it('keeps the same name at different tiers as separate notes', () => {
    const saffron = deriveNotes().filter((n) => n.name === 'Saffron');
    expect(saffron.map((n) => n.tier).sort()).toEqual(['heart', 'top']);
  });

  it('orders notes top, heart, base', () => {
    const tiers = deriveNotes().map((n) => n.tier);
    expect(tiers.indexOf('heart')).toBeGreaterThan(tiers.lastIndexOf('top'));
    expect(tiers.indexOf('base')).toBeGreaterThan(tiers.lastIndexOf('heart'));
  });
});

describe('formatINR', () => {
  it('uses Indian digit grouping and the rupee sign', () => {
    expect(formatINR(1490)).toBe('₹1,490');
    expect(formatINR(125000)).toBe('₹1,25,000');
  });
});
