/*
 * Data access for the UI. Every read goes through these async functions.
 *
 * The source is Supabase: published, approved products only. While Supabase
 * is unreachable, not configured, or has nothing published yet, the bundled
 * demo catalogue (src/data/legacy) is shown instead, so the shop is never empty.
 * The moment one real product is published in Admin, live DB products take over.
 */
import { deriveNotes, getProducts, type Audience, type AvailabilityStatus, type Note, type Product } from './catalog';
import { catalogueSource, fetchFragranceTypes, fetchNavCategories, fetchPublishedCatalogue } from './catalogue';
import { DEFAULT_FRAGRANCE_TYPES, STANDARD_CATEGORIES, filterNavByProducts, navFromProducts, type FragranceTypeOption, type NavCategory } from './categories';
import { latestArrivals, newArrivalsCarousel, saleItems, signaturePerfumes, trendingPerfumes, type CarouselItem } from './selections';
import { enrichShowcaseProduct } from './showcase';

export type SortKey =
  | 'featured'
  | 'best-sellers'
  | 'newest'
  | 'popularity'
  | 'best-matches'
  | 'price-asc'
  | 'price-desc'
  | 'name';

export interface PriceBucket {
  id: string;
  label: string;
  min?: number;
  max?: number;
}

export const PRICE_BUCKETS: readonly PriceBucket[] = [
  { id: 'under-1000', label: 'Under ₹1,000', max: 999 },
  { id: '1000-1499', label: '₹1,000 – ₹1,499', min: 1000, max: 1499 },
  { id: '1500-1999', label: '₹1,500 – ₹1,999', min: 1500, max: 1999 },
  { id: '2000-plus', label: '₹2,000 & above', min: 2000 },
];

export interface ProductQuery {
  families?: string[];
  audience?: Audience | string;
  audiences?: string[];
  /** Single type filter from URL (`?type=inspired`). */
  type?: string;
  /** Collection/category filters from Filter Drawer (`men`, `women`, `unisex`, `inspired`, `bundle`, or category slug). */
  collections?: string[];
  /** Fragrance type slugs/names (`eau-de-parfum`, `extrait-de-parfum`, etc.). */
  fragranceTypes?: string[];
  /** Bottle sizes in ml (multi-select or single). */
  sizeMl?: number;
  sizesMl?: number[];
  /** Price bucket IDs from PRICE_BUCKETS. */
  priceBuckets?: string[];
  /** Availability statuses (`in_stock`, `low_stock`, `out_of_stock`, `preorder`). */
  availability?: AvailabilityStatus[];
  q?: string;
  sort?: SortKey;
}

const normalise = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();

function matchesPriceBuckets(product: Product, bucketIds: Set<string>): boolean {
  const prices = product.variants?.length ? product.variants.map((v) => v.price) : [product.price];
  return prices.some((p) => {
    for (const id of bucketIds) {
      const b = PRICE_BUCKETS.find((x) => x.id === id);
      if (!b) continue;
      if ((b.min === undefined || p >= b.min) && (b.max === undefined || p <= b.max)) return true;
    }
    return false;
  });
}

function matchesCollectionKey(product: Product, key: string): boolean {
  const k = key.toLowerCase();
  if (k === 'all' || k === 'shop-all') return true;
  if (product.audience === k) return true;
  if (product.types?.includes(k)) return true;
  if (product.categorySlugs?.includes(k)) return true;
  return false;
}

function scoreMatch(product: Product, qTerms: string[]): number {
  let score = product.popularityScore ?? 0;
  if (product.isBestSeller) score += 20;
  if (product.isFeatured) score += 10;
  if (qTerms.length > 0) {
    const title = normalise(product.name);
    for (const t of qTerms) {
      if (title === t) score += 100;
      else if (title.includes(t)) score += 40;
    }
  }
  return score;
}

/** Pure filter/sort, exported for tests and reused by the async API below. */
export function queryProducts(list: readonly Product[], query: ProductQuery = {}): Product[] {
  const families = query.families?.length ? new Set(query.families.map((f) => f.toLowerCase())) : null;
  const collections = query.collections?.length ? query.collections : null;
  const fragranceTypes = query.fragranceTypes?.length ? new Set(query.fragranceTypes.map((t) => t.toLowerCase())) : null;
  const sizes = new Set<number>([...(query.sizesMl ?? []), ...(query.sizeMl ? [query.sizeMl] : [])]);
  const priceBuckets = query.priceBuckets?.length ? new Set(query.priceBuckets) : null;
  const availability = query.availability?.length ? new Set(query.availability) : null;
  const audiences = query.audiences?.length ? new Set(query.audiences) : null;
  const q = query.q ? normalise(query.q) : '';
  const qTerms = q ? q.split(/\s+/).filter(Boolean) : [];

  const out = list.filter((p) => {
    if (families && !(p.families ?? (p.collection ? [p.collection] : [])).some((f) => families.has(f.toLowerCase()))) return false;
    if (query.audience && p.audience !== query.audience) return false;
    if (audiences && (!p.audience || !audiences.has(p.audience))) return false;
    if (query.type && !p.types?.includes(query.type) && !p.categorySlugs?.includes(query.type)) return false;
    if (collections && !collections.some((c) => matchesCollectionKey(p, c))) return false;
    if (fragranceTypes) {
      const pftSlug = p.fragranceTypeSlug?.toLowerCase();
      const pftName = p.fragranceType?.toLowerCase();
      if ((!pftSlug || !fragranceTypes.has(pftSlug)) && (!pftName || !fragranceTypes.has(pftName))) return false;
    }
    if (sizes.size > 0) {
      const pSizes = p.variants?.length ? p.variants.map((v) => v.sizeMl) : [p.sizeMl];
      if (!pSizes.some((s) => sizes.has(s))) return false;
    }
    if (priceBuckets && !matchesPriceBuckets(p, priceBuckets)) return false;
    if (availability) {
      const pAvail = p.availability ?? p.variants?.find((v) => v.availability)?.availability ?? 'in_stock';
      if (!availability.has(pAvail)) return false;
    }
    if (!q) return true;
    const haystack = [
      p.name,
      p.collection,
      p.fragranceType ?? '',
      ...(p.families ?? []),
      p.tagline,
      ...p.notes.top,
      ...p.notes.heart,
      ...p.notes.base,
    ]
      .map(normalise)
      .join(' | ');
    return qTerms.every((term) => haystack.includes(term));
  });

  switch (query.sort) {
    case 'price-asc':
      return out.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    case 'price-desc':
      return out.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    case 'best-sellers':
      return out.sort(
        (a, b) =>
          Number(Boolean(b.isBestSeller)) - Number(Boolean(a.isBestSeller)) ||
          (b.popularityScore ?? 0) - (a.popularityScore ?? 0) ||
          a.name.localeCompare(b.name),
      );
    case 'newest':
      return out.sort(
        (a, b) =>
          (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0) ||
          (b.popularityScore ?? 0) - (a.popularityScore ?? 0) ||
          a.name.localeCompare(b.name),
      );
    case 'popularity':
      return out.sort(
        (a, b) =>
          (b.popularityScore ?? 0) - (a.popularityScore ?? 0) ||
          Number(Boolean(b.isTrending)) - Number(Boolean(a.isTrending)) ||
          a.name.localeCompare(b.name),
      );
    case 'best-matches':
      return out.sort((a, b) => scoreMatch(b, qTerms) - scoreMatch(a, qTerms) || a.name.localeCompare(b.name));
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name));
    default:
      // 'featured' / Make My Perfume Recommends
      return out.sort(
        (a, b) =>
          Number(Boolean(b.isFeatured || b.isSignature)) - Number(Boolean(a.isFeatured || a.isSignature)) ||
          (b.popularityScore ?? 0) - (a.popularityScore ?? 0) ||
          0,
      );
  }
}

const REMOTE_TIMEOUT_MS = 4000;
const CACHE_MS = 5 * 60 * 1000;
const FALLBACK_CACHE_MS = 60 * 1000;
const FAMILY_ORDER = ['Fresh', 'Warm', 'Woody', 'Aquatic', 'Sweet', 'Floral'];

interface Loaded {
  products: readonly Product[];
  showcaseProducts: readonly Product[];
  categories: NavCategory[];
  allCategories: NavCategory[];
  fragranceTypes: FragranceTypeOption[];
  remote: boolean;
}

const settle = <T,>(promise: Promise<T>): Promise<T | null> =>
  Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), REMOTE_TIMEOUT_MS))]).catch(() => null);

async function load(): Promise<Loaded> {
  const local = getProducts();
  const localShowcase = local.map(enrichShowcaseProduct);
  const fallback: Loaded = {
    products: local,
    showcaseProducts: localShowcase,
    categories: navFromProducts(local),
    allCategories: [...STANDARD_CATEGORIES],
    fragranceTypes: [...DEFAULT_FRAGRANCE_TYPES],
    remote: false,
  };
  if (catalogueSource() === 'local') return fallback;
  const [products, categories, fragranceTypes] = await Promise.all([
    settle(fetchPublishedCatalogue()),
    settle(fetchNavCategories()),
    settle(fetchFragranceTypes()),
  ]);
  const resolvedCategories = categories && categories.length ? categories : [...STANDARD_CATEGORIES];
  const resolvedTypes = fragranceTypes && fragranceTypes.length ? fragranceTypes : [...DEFAULT_FRAGRANCE_TYPES];
  if (!products || products.length === 0) {
    return {
      ...fallback,
      allCategories: resolvedCategories,
      fragranceTypes: resolvedTypes,
    };
  }
  return {
    products,
    showcaseProducts: products,
    categories: filterNavByProducts(resolvedCategories, products),
    allCategories: resolvedCategories,
    fragranceTypes: resolvedTypes,
    remote: true,
  };
}

let cache: { loaded: Promise<Loaded>; until: number } | null = null;

function catalogue(): Promise<Loaded> {
  if (!cache || Date.now() > cache.until) {
    const loaded = load();
    const entry = { loaded, until: Date.now() + CACHE_MS };
    cache = entry;
    loaded.then((l) => {
      if (!l.remote && cache === entry && catalogueSource() === 'supabase') entry.until = Date.now() + FALLBACK_CACHE_MS;
    });
  }
  return cache.loaded;
}

/** Clears the cached catalogue (used in testing and after Admin CRUD writes). */
export function resetCatalogueForTesting(): void {
  cache = null;
}

export const invalidateCatalogueCache = resetCatalogueForTesting;

export async function listProducts(query: ProductQuery = {}): Promise<Product[]> {
  return queryProducts((await catalogue()).products, query);
}

/** Storefront-enriched products (uses live DB products when published, or enriched showcase scents while DB is draft-only). */
export async function listStorefrontProducts(query: ProductQuery = {}): Promise<{ products: Product[]; remote: boolean }> {
  const cat = await catalogue();
  return { products: queryProducts(cat.showcaseProducts, query), remote: cat.remote };
}

export async function getProduct(slug: string): Promise<Product | null> {
  const cat = await catalogue();
  const list = cat.remote ? cat.products : cat.showcaseProducts;
  return list.find((p) => p.slug === slug) ?? null;
}

export async function listFamilies(): Promise<string[]> {
  const { showcaseProducts } = await catalogue();
  const families = [...new Set(showcaseProducts.flatMap((p) => p.families ?? [p.collection]).filter(Boolean))];
  return families.sort((a, b) => (FAMILY_ORDER.indexOf(a) + 1 || 99) - (FAMILY_ORDER.indexOf(b) + 1 || 99));
}

export async function listNotes(): Promise<Note[]> {
  return deriveNotes((await catalogue()).products);
}

/** Sizes that actually appear in the catalogue. */
export async function listSizes(): Promise<number[]> {
  const { showcaseProducts } = await catalogue();
  return [...new Set(showcaseProducts.flatMap((p) => (p.variants?.length ? p.variants.map((v) => v.sizeMl) : [p.sizeMl])))].sort(
    (a, b) => a - b,
  );
}

/** Header categories. */
export async function listCategories(): Promise<NavCategory[]> {
  return (await catalogue()).categories;
}

/** All active database categories (for Collection filter drawer). */
export async function listAllCategories(): Promise<NavCategory[]> {
  return (await catalogue()).allCategories;
}

/** Active fragrance types (from DB `fragrance_types`, managed by Admin Portal). */
export async function listFragranceTypes(): Promise<FragranceTypeOption[]> {
  return (await catalogue()).fragranceTypes;
}

export async function listLatestArrivals(): Promise<CarouselItem[]> {
  return latestArrivals((await catalogue()).products);
}

export async function listOnSale(): Promise<CarouselItem[]> {
  return saleItems((await catalogue()).products);
}

export async function listHomepageCarousels(): Promise<{
  trending: CarouselItem[];
  newArrivals: CarouselItem[];
  signature: CarouselItem[];
  onSale: CarouselItem[];
  remote: boolean;
}> {
  const cat = await catalogue();
  const source = cat.remote ? cat.products : cat.showcaseProducts;
  return {
    trending: trendingPerfumes(source),
    newArrivals: newArrivalsCarousel(source),
    signature: signaturePerfumes(source),
    onSale: saleItems(source),
    remote: cat.remote,
  };
}
