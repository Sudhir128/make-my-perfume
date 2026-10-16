import legacy from './legacy/products.json';

export type Tier = 'top' | 'heart' | 'base';
export const TIERS: readonly Tier[] = ['top', 'heart', 'base'];

export interface Provenance {
  source: 'legacy-site';
  confirmed: boolean;
  ref: string;
  retrieved: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  collection: string;
  tagline: string;
  description: string;
  /** INR, whole rupees. Provisional. */
  price: number;
  sizeMl: number;
  notes: Record<Tier, string[]>;
  sillage?: string;
  /** As listed on the previous site. */
  longevity?: string;
  ingredients?: string[];
  provenance: Provenance;
}

export interface Note {
  id: string;
  name: string;
  tier: Tier;
  /** Slugs of the products whose pyramid lists this note at this tier. */
  productSlugs: string[];
}

const products = legacy as Product[];

export function getProducts(): readonly Product[] {
  return products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getCollections(): string[] {
  return [...new Set(products.map((p) => p.collection))];
}

const noteId = (tier: Tier, name: string) =>
  `${tier}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

/**
 * Every note in the catalogue, keyed by tier and name, with the products it
 * appears in. Built only from the product data; nothing is added.
 */
export function deriveNotes(list: readonly Product[] = products): Note[] {
  const byId = new Map<string, Note>();
  for (const p of list) {
    for (const tier of TIERS) {
      for (const name of p.notes[tier]) {
        const id = noteId(tier, name);
        const note = byId.get(id) ?? { id, name, tier, productSlugs: [] };
        if (!note.productSlugs.includes(p.slug)) note.productSlugs.push(p.slug);
        byId.set(id, note);
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.name.localeCompare(b.name),
  );
}
