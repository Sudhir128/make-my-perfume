import { describe, expect, it } from 'vitest';
import type { Product } from './catalog';
import { categoryPath, navFromProducts, navLabel, primaryNavCategories, STANDARD_CATEGORIES } from './categories';
import { toNavCategory, toProduct, type ProductRow, type SaleRow } from './catalogue';
import { productImage } from './productImages';
import { discountPct, latestArrivals, leadVariant, saleItems } from './selections';

// TEST FIXTURES only. These names are invented for the tests and never appear in the app.
const row = (over: Partial<ProductRow> = {}): ProductRow => ({
  id: 'p-1',
  slug: 'fixture-one',
  title: 'Fixture One',
  description: 'A test fragrance.',
  published_at: '2026-11-01T00:00:00Z',
  product_variants: [
    { sku: 'MMP-AAAAAA-100', size_ml: 100, price_inr: '1200.00', compare_at_inr: null },
    { sku: 'MMP-AAAAAA-50', size_ml: 50, price_inr: 800, compare_at_inr: null },
  ],
  product_categories: [],
  product_scent_families: [],
  product_images: [],
  ...over,
});
const sale = (sku: string, compare: number, pct: number): SaleRow => ({ sku, compare_at_inr: compare, discount_pct: pct });

describe('toProduct', () => {
  it('maps a published row: sorted sizes, lead variant, numeric prices', () => {
    const p = toProduct(row())!;
    expect(p.name).toBe('Fixture One');
    expect(p.variants!.map((v) => v.sizeMl)).toEqual([50, 100]);
    expect(p.variants!.map((v) => v.price)).toEqual([800, 1200]);
    expect(p.price).toBe(800);
    expect(p.sizeMl).toBe(50);
    expect(p.publishedAt).toBe('2026-11-01T00:00:00Z');
    expect(p.notes).toEqual({ top: [], heart: [], base: [] });
  });

  it('never invents data: no families, audience, types, tagline or image unless supplied', () => {
    const p = toProduct(row())!;
    expect(p.collection).toBe('');
    expect(p.families).toBeUndefined();
    expect(p.audience).toBeUndefined();
    expect(p.types).toBeUndefined();
    expect(p.tagline).toBe('');
    expect(productImage('fixture-one')).toBeNull();
  });

  it('reads audience, types and several scent families from the links', () => {
    const p = toProduct(
      row({
        product_categories: [
          { categories: { slug: 'mens-perfumes', kind: 'audience', filter_value: 'men' } },
          { categories: { slug: 'inspired-fragrances', kind: 'type', filter_value: 'inspired' } },
        ],
        product_scent_families: [{ scent_families: { name: 'Woody' } }, { scent_families: { name: 'Fresh' } }],
      }),
    )!;
    expect(p.audience).toBe('men');
    expect(p.types).toEqual(['inspired']);
    expect(p.families).toEqual(['Fresh', 'Woody']);
    expect(p.collection).toBe('Fresh');
  });

  it('applies a sale only to the exact size that has one, with a computed percentage', () => {
    const p = toProduct(row(), new Map([['MMP-AAAAAA-50', sale('MMP-AAAAAA-50', 1000, 20)]]))!;
    expect(p.variants!.find((v) => v.sizeMl === 50)!.sale).toEqual({ compareAt: 1000, discountPct: 20 });
    expect(p.variants!.find((v) => v.sizeMl === 100)!.sale).toBeUndefined();
  });

  it('ignores a "sale" whose compare-at price is not above the selling price', () => {
    const p = toProduct(row(), new Map([['MMP-AAAAAA-50', sale('MMP-AAAAAA-50', 800, 0)], ['MMP-AAAAAA-100', sale('MMP-AAAAAA-100', 900, 10)]]))!;
    expect(p.variants!.every((v) => !v.sale)).toBe(true);
  });

  it('drops rows that cannot be shown: no title, slug, publish time or sized variant', () => {
    expect(toProduct(row({ title: null }))).toBeNull();
    expect(toProduct(row({ slug: null }))).toBeNull();
    expect(toProduct(row({ published_at: null }))).toBeNull();
    expect(toProduct(row({ product_variants: [] }))).toBeNull();
    expect(toProduct(row({ product_variants: [{ sku: 'X-1', size_ml: 50, price_inr: 0, compare_at_inr: null }] }))).toBeNull();
  });

  it('registers a verified image for the product', () => {
    toProduct(row({ slug: 'fixture-img', product_images: [{ url: 'https://img.test/b.jpg', alt_text: null, sort_order: 2 }, { url: 'https://img.test/a.jpg', alt_text: 'Front', sort_order: 1 }] }));
    expect(productImage('fixture-img')).toMatchObject({ src: 'https://img.test/a.jpg', alt: 'Front' });
  });
});

const product = (over: Partial<Product>): Product => ({ ...toProduct(row())!, ...over });

describe('Latest Arrivals', () => {
  const a = product({ slug: 'a', name: 'A', publishedAt: '2026-11-01T00:00:00Z' });
  const b = product({ slug: 'b', name: 'B', publishedAt: '2026-11-05T00:00:00Z' });
  const c = product({ slug: 'c', name: 'C', publishedAt: '2026-11-03T00:00:00Z' });
  const demo = product({ slug: 'demo', name: 'Demo', publishedAt: undefined, variants: undefined });

  it('lists published products newest first', () => {
    expect(latestArrivals([a, b, c]).map((i) => i.product.slug)).toEqual(['b', 'c', 'a']);
  });
  it('never includes products without a publication time (the bundled demo catalogue)', () => {
    expect(latestArrivals([demo])).toEqual([]);
    expect(latestArrivals([demo, a]).map((i) => i.product.slug)).toEqual(['a']);
  });
  it('respects the item limit and does not mutate its input', () => {
    const list = [a, b, c];
    expect(latestArrivals(list, 2)).toHaveLength(2);
    expect(list.map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });
  it('is empty when there are no products', () => {
    expect(latestArrivals([])).toEqual([]);
  });
});

describe('On Sale', () => {
  const withSale = (slug: string, pct: number, sizes: Array<[number, number, number?]>) =>
    product({
      slug,
      name: slug,
      variants: sizes.map(([sizeMl, price, compareAt]) => ({ sku: `${slug}-${sizeMl}`, sizeMl, price, sale: compareAt ? { compareAt, discountPct: pct } : undefined })),
    });

  it('includes only products with a real on-sale size', () => {
    const items = saleItems([withSale('no-sale', 0, [[50, 500]]), withSale('sale', 20, [[50, 800, 1000]])]);
    expect(items.map((i) => i.product.slug)).toEqual(['sale']);
  });
  it('advertises the lowest-priced on-sale size so price and discount describe the same bottle', () => {
    const [item] = saleItems([withSale('multi', 20, [[100, 1200, 1500], [50, 800, 1000], [150, 1500]])]);
    expect(item!.variant).toMatchObject({ sizeMl: 50, price: 800 });
  });
  it('orders by discount, then name, and is empty with no sales', () => {
    const items = saleItems([withSale('b', 10, [[50, 900, 1000]]), withSale('a', 30, [[50, 700, 1000]])]);
    expect(items.map((i) => i.product.slug)).toEqual(['a', 'b']);
    expect(saleItems([withSale('x', 0, [[50, 500]])])).toEqual([]);
  });
  it('discountPct is computed from validated numbers only', () => {
    expect(discountPct(800, 1000)).toBe(20);
    expect(discountPct(1000, 1000)).toBe(0);
    expect(discountPct(1200, 1000)).toBe(0);
    expect(discountPct(0, 1000)).toBe(0);
    expect(discountPct(Number.NaN, 1000)).toBe(0);
  });
  it('leadVariant is the cheapest, then the smallest', () => {
    expect(leadVariant(product({ variants: [{ sku: 'a', sizeMl: 100, price: 500 }, { sku: 'b', sizeMl: 50, price: 500 }] }))!.sku).toBe('b');
  });
});

describe('categories and homepage carousels', () => {
  it('always returns all 7 requested primary navigation links in display order', () => {
    const nav = primaryNavCategories(STANDARD_CATEGORIES).map((c) => [navLabel(c), c.path]);
    expect(nav).toEqual([
      ['Shop All Perfumes', '/collection'],
      ['Men', '/collection?audience=men'],
      ['Women', '/collection?audience=women'],
      ['Unisex', '/collection?audience=unisex'],
      ['Inspired Fragrances', '/collection?type=inspired'],
      ['Create Your Perfume', '/make'],
      ['Gifting & Combos', '/collection?type=bundle'],
    ]);
    expect(navFromProducts([product({})])).toHaveLength(7);
  });

  it('keeps the legacy empty categories out of the standard list', () => {
    const names = STANDARD_CATEGORIES.map((c) => c.name).join(' ');
    for (const gone of ['Cosmopolitan', 'Fusion', 'Combo Deals', 'Accessories', 'Others']) expect(names).not.toContain(gone);
  });

  it('builds the target destinations', () => {
    expect(categoryPath('all')).toBe('/collection');
    expect(categoryPath('audience', 'men')).toBe('/collection?audience=men');
    expect(categoryPath('type', 'inspired')).toBe('/collection?type=inspired');
    expect(categoryPath('type', 'bundle')).toBe('/collection?type=bundle');
    expect(categoryPath('landing', null, '/make')).toBe('/make');
  });

  it('maps a database category row', () => {
    expect(toNavCategory({ slug: 'womens-perfumes', name: "Women's Perfumes", kind: 'audience', filter_value: 'women', landing_path: null })).toMatchObject({ path: '/collection?audience=women', filterValue: 'women' });
    expect(toNavCategory({ slug: 'personalized-perfumes', name: 'P', kind: 'landing', filter_value: null, landing_path: '/make' }).path).toBe('/make');
  });
});
