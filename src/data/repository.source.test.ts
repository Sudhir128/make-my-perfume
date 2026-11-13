import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProducts, type Product } from './catalog';
import type { NavCategory } from './categories';

// Controls whether Supabase is the source and what it returns.
const mocks = vi.hoisted(() => ({
  source: 'supabase' as 'supabase' | 'local',
  products: vi.fn<() => Promise<Product[]>>(),
  categories: vi.fn<() => Promise<NavCategory[]>>(),
  fragranceTypes: vi.fn<() => Promise<Array<{ id: string; slug: string; name: string }>>>(),
}));
vi.mock('./catalogue', () => ({
  catalogueSource: () => mocks.source,
  fetchPublishedCatalogue: () => mocks.products(),
  fetchNavCategories: () => mocks.categories(),
  fetchFragranceTypes: () => mocks.fragranceTypes(),
}));

import { getProduct, listCategories, listFamilies, listLatestArrivals, listOnSale, listProducts, queryProducts, resetCatalogueForTesting } from './repository';

const demo = getProducts();
const remote = (slug: string, over: Partial<Product> = {}): Product => ({
  ...demo[0]!,
  id: slug,
  slug,
  name: slug.toUpperCase(),
  collection: '',
  tagline: '',
  families: undefined,
  variants: [{ sku: `${slug}-50`, sizeMl: 50, price: 800 }],
  publishedAt: '2026-11-02T00:00:00Z',
  ...over,
});

beforeEach(() => {
  resetCatalogueForTesting();
  mocks.source = 'supabase';
  mocks.products.mockReset();
  mocks.categories.mockReset();
  mocks.categories.mockResolvedValue([]);
  mocks.fragranceTypes.mockReset();
  mocks.fragranceTypes.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('catalogue source', () => {
  it('uses the bundled demo catalogue when Supabase has nothing published', async () => {
    mocks.products.mockResolvedValue([]);
    expect((await listProducts()).map((p) => p.slug)).toEqual(demo.map((p) => p.slug));
    expect(await listLatestArrivals()).toEqual([]);
    expect(await listOnSale()).toEqual([]);
  });

  it('uses the demo catalogue when Supabase fails', async () => {
    mocks.products.mockRejectedValue(new Error('network down'));
    expect(await listProducts()).toHaveLength(demo.length);
    expect((await getProduct('nocturne'))!.name).toBe('Nocturne');
  });

  it('gives up on a slow Supabase after a few seconds instead of hanging the page', async () => {
    vi.useFakeTimers();
    mocks.products.mockReturnValue(new Promise(() => {}));
    const pending = listProducts();
    await vi.advanceTimersByTimeAsync(4100);
    expect(await pending).toHaveLength(demo.length);
  });

  it('shows only the published products once any exist: the demo catalogue stops showing', async () => {
    mocks.products.mockResolvedValue([remote('one'), remote('two')]);
    expect((await listProducts()).map((p) => p.slug)).toEqual(['one', 'two']);
    expect(await getProduct('nocturne')).toBeNull();
  });

  it('forces the demo catalogue when VITE_CATALOGUE_SOURCE=local, without calling Supabase', async () => {
    mocks.source = 'local';
    expect(await listProducts()).toHaveLength(demo.length);
    expect(mocks.products).not.toHaveBeenCalled();
  });

  it('fetches once and reuses the result', async () => {
    mocks.products.mockResolvedValue([remote('one')]);
    await listProducts();
    await listFamilies();
    await getProduct('one');
    expect(mocks.products).toHaveBeenCalledTimes(1);
  });
});

describe('categories and filters over catalogue products', () => {
  it('returns all 7 requested primary navigation categories when published products exist or during fallback', async () => {
    mocks.products.mockResolvedValue([remote('one', { audience: 'men', types: ['inspired'] })]);
    mocks.categories.mockResolvedValue([
      { slug: 'shop-all', name: 'Shop All Perfumes', kind: 'all', path: '/collection' },
      { slug: 'mens-perfumes', name: 'Men', kind: 'audience', filterValue: 'men', path: '/collection?audience=men' },
      { slug: 'womens-perfumes', name: 'Women', kind: 'audience', filterValue: 'women', path: '/collection?audience=women' },
    ]);
    expect((await listCategories()).map((c) => c.slug)).toEqual([
      'shop-all',
      'mens-perfumes',
      'womens-perfumes',
      'unisex-perfumes',
      'inspired-fragrances',
      'personalized-perfumes',
      'gift-sets-combos',
    ]);
  });

  it('derives all 7 categories cleanly when the category view cannot be read', async () => {
    mocks.products.mockResolvedValue([remote('one', { audience: 'women' })]);
    mocks.categories.mockRejectedValue(new Error('x'));
    expect((await listCategories())).toHaveLength(7);
  });

  it('provides all 7 header categories with demo catalogue fallback too', async () => {
    mocks.products.mockResolvedValue([]);
    expect((await listCategories())).toHaveLength(7);
  });

  it('filters by audience, type, scent families, price buckets, fragrance type, size and availability', () => {
    const list = [
      remote('m', { audience: 'men', families: ['Woody', 'Fresh'], price: 900, variants: [{ sku: 'm-50', sizeMl: 50, price: 900 }], fragranceTypeSlug: 'eau-de-parfum', availability: 'in_stock' }),
      remote('w', { audience: 'women', types: ['inspired'], price: 1650, variants: [{ sku: 'w-100', sizeMl: 100, price: 1650 }], fragranceTypeSlug: 'inspired-fragrance', availability: 'low_stock' }),
      remote('n', { price: 2200, variants: [{ sku: 'n-150', sizeMl: 150, price: 2200 }], availability: 'out_of_stock' }),
    ];
    expect(queryProducts(list, { audience: 'men' }).map((p) => p.slug)).toEqual(['m']);
    expect(queryProducts(list, { type: 'inspired' }).map((p) => p.slug)).toEqual(['w']);
    expect(queryProducts(list, { families: ['Fresh'] }).map((p) => p.slug)).toEqual(['m']);
    expect(queryProducts(list, { priceBuckets: ['under-1000'] }).map((p) => p.slug)).toEqual(['m']);
    expect(queryProducts(list, { priceBuckets: ['1500-1999'] }).map((p) => p.slug)).toEqual(['w']);
    expect(queryProducts(list, { fragranceTypes: ['inspired-fragrance'] }).map((p) => p.slug)).toEqual(['w']);
    expect(queryProducts(list, { sizesMl: [150] }).map((p) => p.slug)).toEqual(['n']);
    expect(queryProducts(list, { availability: ['low_stock'] }).map((p) => p.slug)).toEqual(['w']);
    expect(queryProducts(list, { sort: 'price-desc' }).map((p) => p.slug)).toEqual(['n', 'w', 'm']);
  });

  it('feeds both carousels from the published products only', async () => {
    mocks.products.mockResolvedValue([
      remote('new', { publishedAt: '2026-11-09T00:00:00Z' }),
      remote('sale', { publishedAt: '2026-11-01T00:00:00Z', variants: [{ sku: 's-50', sizeMl: 50, price: 800, sale: { compareAt: 1000, discountPct: 20 } }] }),
    ]);
    expect((await listLatestArrivals()).map((i) => i.product.slug)).toEqual(['new', 'sale']);
    expect((await listOnSale()).map((i) => i.product.slug)).toEqual(['sale']);
  });
});
