import { describe, expect, it } from 'vitest';
import products from './products.json';

// Never displayed: stock images, sale prices, ratings, reviews, badges.
const EXCLUDED = ['image_url', 'gallery', 'compare_at_price', 'rating', 'review_count', 'badge'];

describe('legacy product snapshot', () => {
  it('holds the six provisional products with unique slugs', () => {
    expect(products).toHaveLength(6);
    expect(new Set(products.map((p) => p.slug)).size).toBe(6);
  });

  it('carries no excluded claim fields', () => {
    for (const p of products) {
      for (const key of EXCLUDED) expect(p).not.toHaveProperty(key);
    }
  });

  it('marks every record as unconfirmed legacy content', () => {
    for (const p of products) {
      expect(p.provenance).toMatchObject({ source: 'legacy-site', confirmed: false });
    }
  });

  it('has a usable INR price, a listed size and all three note tiers', () => {
    for (const p of products) {
      expect(Number.isInteger(p.price) && p.price > 0).toBe(true);
      expect([50, 100]).toContain(p.sizeMl);
      for (const tier of [p.notes.top, p.notes.heart, p.notes.base]) expect(tier.length).toBeGreaterThan(0);
    }
  });
});
