/*
 * Reads the published catalogue, active categories, fragrance types, and sales
 * from Supabase (read-only, anonymous). Column selections keep private drafts,
 * source titles/URLs, and exact stock counts hidden from the public client.
 */
import { getSupabase } from '../lib/supabase';
import type { Audience, AvailabilityStatus, Product, Tier, Variant } from './catalog';
import { categoryPath, type CategoryKind, type FragranceTypeOption, type NavCategory } from './categories';
import { registerRemoteImage } from './productImages';

export type CatalogueSource = 'local' | 'supabase';

/** VITE_CATALOGUE_SOURCE=local forces the bundled demo catalogue. Anything else reads Supabase. */
export function catalogueSource(): CatalogueSource {
  return import.meta.env.VITE_CATALOGUE_SOURCE === 'local' ? 'local' : 'supabase';
}

const PRODUCT_SELECT = `
  id, slug, title, tagline, description, notes, product_type, fragrance_type_id,
  is_featured, is_trending, is_signature, is_best_seller, popularity_score, availability, published_at,
  fragrance_types ( slug, name ),
  product_variants ( id, sku, size_ml, price_inr, compare_at_inr, is_active, inventory ( availability ) ),
  product_categories ( categories ( slug, name, kind, filter_value ) ),
  product_scent_families ( scent_families ( name ) ),
  product_images ( url, alt_text, sort_order )
`;

type Num = number | string;
export interface ProductRow {
  id: string;
  slug: string | null;
  title: string | null;
  tagline?: string | null;
  description: string | null;
  notes?: Partial<Record<Tier, string[]>> | null;
  product_type?: string | null;
  fragrance_type_id?: string | null;
  is_featured?: boolean | null;
  is_trending?: boolean | null;
  is_signature?: boolean | null;
  is_best_seller?: boolean | null;
  popularity_score?: number | null;
  availability?: string | null;
  published_at: string | null;
  fragrance_types?: { slug: string; name: string } | null;
  product_variants: Array<{
    id?: string;
    sku: string;
    size_ml: number;
    price_inr: Num;
    compare_at_inr: Num | null;
    is_active?: boolean;
    inventory?: { availability?: string | null } | Array<{ availability?: string | null }> | null;
  }> | null;
  product_categories: Array<{ categories: { slug: string; name?: string; kind: string; filter_value: string | null } | null }> | null;
  product_scent_families: Array<{ scent_families: { name: string } | null }> | null;
  product_images: Array<{ url: string | null; alt_text: string | null; sort_order: number }> | null;
}

export interface SaleRow {
  sku: string;
  compare_at_inr: Num;
  discount_pct: number;
}

export interface CategoryRow {
  id?: string;
  slug: string;
  name: string;
  kind: string;
  filter_value: string | null;
  landing_path: string | null;
}

const CANONICAL_FAMILIES = ['Fresh', 'Warm', 'Woody', 'Aquatic', 'Sweet', 'Floral'];

function cleanNotes(raw?: Partial<Record<Tier, string[]>> | null): Record<Tier, string[]> {
  return {
    top: Array.isArray(raw?.top) ? raw!.top!.filter((x): x is string => typeof x === 'string') : [],
    heart: Array.isArray(raw?.heart) ? raw!.heart!.filter((x): x is string => typeof x === 'string') : [],
    base: Array.isArray(raw?.base) ? raw!.base!.filter((x): x is string => typeof x === 'string') : [],
  };
}

/** Maps one database row to the shape the pages use. Returns null if not displayable. */
export function toProduct(row: ProductRow, sales: ReadonlyMap<string, SaleRow> = new Map()): Product | null {
  const variants: Variant[] = (row.product_variants ?? [])
    .filter((v) => v.is_active !== false)
    .map((v) => {
      const price = Number(v.price_inr);
      const sale = sales.get(v.sku);
      const compareAt = sale ? Number(sale.compare_at_inr) : 0;
      const invObj = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
      const vAvail = (invObj?.availability && invObj.availability !== 'unknown'
        ? invObj.availability
        : row.availability) as AvailabilityStatus | undefined;
      const variant: Variant = { id: v.id, sku: v.sku, sizeMl: v.size_ml, price, availability: vAvail };
      if (sale && compareAt > price && price > 0) variant.sale = { compareAt, discountPct: Math.round((1 - price / compareAt) * 100) };
      return variant;
    })
    .filter((v) => v.price > 0 && v.sizeMl > 0)
    .sort((a, b) => a.sizeMl - b.sizeMl);
  if (!row.slug || !row.title || !row.published_at || variants.length === 0) return null;

  const lead = [...variants].sort((a, b) => a.price - b.price || a.sizeMl - b.sizeMl)[0]!;
  const cats = (row.product_categories ?? []).map((c) => c.categories).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const audience = cats.find((c) => c.kind === 'audience')?.filter_value as Audience | undefined;
  const types = cats.filter((c) => c.kind === 'type' && c.filter_value).map((c) => c.filter_value!);
  const categorySlugs = cats.map((c) => c.slug);
  const families = (row.product_scent_families ?? [])
    .map((f) => f.scent_families?.name)
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => CANONICAL_FAMILIES.indexOf(a) - CANONICAL_FAMILIES.indexOf(b));

  const image = [...(row.product_images ?? [])].filter((i) => i.url).sort((a, b) => a.sort_order - b.sort_order)[0];
  registerRemoteImage(row.slug, image ? { src: image.url!, srcSet: image.url!, alt: image.alt_text || row.title } : null);

  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    collection: families[0] ?? '',
    tagline: row.tagline ?? '',
    description: row.description ?? '',
    price: lead.price,
    sizeMl: lead.sizeMl,
    sku: lead.sku,
    notes: cleanNotes(row.notes),
    provenance: { source: 'supabase', confirmed: true, ref: 'public.products', retrieved: '' },
    audience,
    types: types.length ? types : undefined,
    categorySlugs: categorySlugs.length ? categorySlugs : undefined,
    families: families.length ? families : undefined,
    fragranceType: row.fragrance_types?.name ?? undefined,
    fragranceTypeSlug: row.fragrance_types?.slug ?? undefined,
    isFeatured: row.is_featured ?? undefined,
    isTrending: row.is_trending ?? undefined,
    isSignature: row.is_signature ?? undefined,
    isBestSeller: row.is_best_seller ?? undefined,
    popularityScore: row.popularity_score ?? undefined,
    availability: (row.availability as AvailabilityStatus | undefined) ?? lead.availability,
    variants,
    publishedAt: row.published_at,
  };
}

/** Every published product, newest first. Throws when Supabase is unreachable or not configured. */
export async function fetchPublishedCatalogue(): Promise<Product[]> {
  const client = await getSupabase();
  const [productsRes, salesRes] = await Promise.all([
    client.from('products').select(PRODUCT_SELECT).order('published_at', { ascending: false }),
    client.from('v_active_sales').select('sku, compare_at_inr, discount_pct'),
  ]);
  if (productsRes.error) throw productsRes.error;
  const sales = new Map<string, SaleRow>(salesRes.error ? [] : ((salesRes.data ?? []) as SaleRow[]).map((s) => [s.sku, s]));
  return ((productsRes.data ?? []) as unknown as ProductRow[]).map((r) => toProduct(r, sales)).filter((p): p is Product => p !== null);
}

export function toNavCategory(row: CategoryRow): NavCategory {
  const kind = row.kind as CategoryKind;
  return { id: row.id, slug: row.slug, name: row.name, kind, filterValue: row.filter_value ?? undefined, path: categoryPath(kind, row.filter_value, row.landing_path) };
}

/** Navigation categories from database. */
export async function fetchNavCategories(): Promise<NavCategory[]> {
  const client = await getSupabase();
  const { data, error } = await client
    .from('categories')
    .select('id, slug, name, kind, filter_value, landing_path, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return ((data ?? []) as CategoryRow[]).map(toNavCategory);
}

/** Active fragrance types from database (managed via Admin Portal). */
export async function fetchFragranceTypes(): Promise<FragranceTypeOption[]> {
  const client = await getSupabase();
  const { data, error } = await client
    .from('fragrance_types')
    .select('id, slug, name, description, category_slug, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; slug: string; name: string; description: string | null; category_slug: string | null }>).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    categorySlug: r.category_slug,
  }));
}
