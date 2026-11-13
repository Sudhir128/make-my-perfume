import legacy from './legacy/products.json';

export type Tier = 'top' | 'heart' | 'base';
export const TIERS: readonly Tier[] = ['top', 'heart', 'base'];

export interface Provenance {
  source: 'legacy-site' | 'supabase';
  confirmed: boolean;
  ref: string;
  retrieved: string;
}

/** A bottle size with its own SKU and price. Present on catalogue-managed products. */
export interface Variant {
  id?: string;
  sku: string;
  sizeMl: number;
  /** INR selling price. */
  price: number;
  availability?: AvailabilityStatus;
  /** Set only while an approved promotion is active (from v_active_sales). */
  sale?: { compareAt: number; discountPct: number };
}

export type Audience = 'men' | 'women' | 'unisex';
export type AvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder';

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
  /* Catalogue-managed products (Supabase) add the fields below. */
  audience?: Audience;
  /** Product types from its categories: 'inspired', 'bundle', etc. */
  types?: string[];
  /** Category slugs this product belongs to. */
  categorySlugs?: string[];
  /** Verified scent families; a product may carry several. */
  families?: string[];
  /** Fragrance type display name & slug (e.g. 'Eau de Parfum', 'eau-de-parfum'). */
  fragranceType?: string;
  fragranceTypeSlug?: string;
  /** Merchandising flags controlled from Admin Portal. */
  isFeatured?: boolean;
  isTrending?: boolean;
  isSignature?: boolean;
  isBestSeller?: boolean;
  popularityScore?: number;
  availability?: AvailabilityStatus;
  sku?: string;
  /** Every bottle size. price / sizeMl describe the lowest-priced one. */
  variants?: Variant[];
  /** ISO time the product was published. */
  publishedAt?: string;
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
