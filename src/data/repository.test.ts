import { describe, expect, it } from 'vitest';
import { getProducts } from './catalog';
import { getProduct, listFamilies, listSizes, queryProducts } from './repository';

const all = getProducts();
const names = (list: readonly { name: string }[]) => list.map((p) => p.name);

describe('queryProducts', () => {
  it('returns the catalogue order for featured', () => {
    expect(names(queryProducts(all))).toEqual(names(all));
  });

  it('filters by one or more families', () => {
    expect(names(queryProducts(all, { families: ['Woody'] }))).toEqual(['Nocturne']);
    expect(names(queryProducts(all, { families: ['Fresh', 'Floral'] })).sort()).toEqual(['Citrus Noir', 'Saffron Neroli']);
  });

  it('searches names, families, taglines and notes, accent- and case-insensitively', () => {
    expect(names(queryProducts(all, { q: 'VETIVER' }))).toEqual(['Citrus Noir']);
    expect(names(queryProducts(all, { q: 'musk' })).sort()).toEqual(['Azure Skin', 'Citrus Noir', 'Saffron Neroli', 'Velvet Fig']);
    // Substring match: "Tuberose" contains "rose", so Saffron Neroli matches too.
    expect(names(queryProducts(all, { q: 'saffron rose' })).sort()).toEqual(['Amber Veil', 'Saffron Neroli']);
    expect(queryProducts(all, { q: 'oud' })).toEqual([]);
  });

  it('filters by listed size', () => {
    expect(queryProducts(all, { sizeMl: 100 }).every((p) => p.sizeMl === 100)).toBe(true);
    expect(queryProducts(all, { sizeMl: 100 })).toHaveLength(3);
  });

  it('sorts by price both ways and by name', () => {
    expect(queryProducts(all, { sort: 'price-asc' }).map((p) => p.price)).toEqual([990, 1100, 1200, 1350, 1490, 1750]);
    expect(queryProducts(all, { sort: 'price-desc' })[0]!.name).toBe('Nocturne');
    expect(names(queryProducts(all, { sort: 'name' }))[0]).toBe('Amber Veil');
  });

  it('does not mutate the source list', () => {
    const before = names(all);
    queryProducts(all, { sort: 'name' });
    expect(names(all)).toEqual(before);
  });
});

describe('async repository', () => {
  it('resolves products, families and only the sizes the catalogue lists', async () => {
    expect((await getProduct('velvet-fig'))?.price).toBe(1350);
    expect(await getProduct('missing')).toBeNull();
    expect((await listFamilies()).sort()).toEqual(['Aquatic', 'Floral', 'Fresh', 'Sweet', 'Warm', 'Woody']);
    expect(await listSizes()).toEqual([50, 100]);
  });
});
