/*
 * Data access for the UI. Every read goes through these async functions so a
 * real backend can replace the bodies later without touching pages or
 * components. Today they read the provisional legacy snapshot locally; no
 * network request is made.
 */
import { deriveNotes, getProducts, type Note, type Product } from './catalog';

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

export interface ProductQuery {
  families?: string[];
  q?: string;
  sizeMl?: number;
  sort?: SortKey;
}

const normalise = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();

/** Pure filter/sort, exported for tests and reused by the async API below. */
export function queryProducts(list: readonly Product[], query: ProductQuery = {}): Product[] {
  const families = query.families?.length ? new Set(query.families) : null;
  const q = query.q ? normalise(query.q) : '';
  const out = list.filter((p) => {
    if (families && !families.has(p.collection)) return false;
    if (query.sizeMl && p.sizeMl !== query.sizeMl) return false;
    if (!q) return true;
    const haystack = [p.name, p.collection, p.tagline, ...p.notes.top, ...p.notes.heart, ...p.notes.base]
      .map(normalise)
      .join(' | ');
    return q.split(/\s+/).every((term) => haystack.includes(term));
  });
  switch (query.sort) {
    case 'price-asc':
      return out.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    case 'price-desc':
      return out.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return out; // featured: catalogue order
  }
}

export async function listProducts(query: ProductQuery = {}): Promise<Product[]> {
  return queryProducts(getProducts(), query);
}

export async function getProduct(slug: string): Promise<Product | null> {
  return getProducts().find((p) => p.slug === slug) ?? null;
}

export async function listFamilies(): Promise<string[]> {
  return [...new Set(getProducts().map((p) => p.collection))];
}

export async function listNotes(): Promise<Note[]> {
  return deriveNotes();
}

/** Sizes that actually appear in the catalogue. Nothing else is offered. */
export async function listSizes(): Promise<number[]> {
  return [...new Set(getProducts().map((p) => p.sizeMl))].sort((a, b) => a - b);
}
