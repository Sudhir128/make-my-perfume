/*
 * Shopping categories and primary header navigation.
 * Scent families are collection-page filters, not header categories.
 */
import type { Product } from './catalog';

export type CategoryKind = 'all' | 'audience' | 'type' | 'landing';

export interface NavCategory {
  id?: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  /** audience: men | women | unisex. type: inspired | bundle | custom. */
  filterValue?: string;
  /** Where the header link goes. */
  path: string;
  highlight?: boolean;
}

export interface FragranceTypeOption {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  categorySlug?: string | null;
}

export const AUDIENCE_TITLES: Record<string, string> = {
  men: 'Men',
  women: 'Women',
  unisex: 'Unisex',
};

export const TYPE_TITLES: Record<string, string> = {
  inspired: 'Inspired Fragrances',
  bundle: 'Gifting & Combos',
};

export function categoryPath(kind: CategoryKind, filterValue?: string | null, landingPath?: string | null): string {
  if (kind === 'audience') return `/collection?audience=${encodeURIComponent(filterValue ?? '')}`;
  if (kind === 'type') return `/collection?type=${encodeURIComponent(filterValue ?? '')}`;
  if (kind === 'landing') return landingPath ?? '/';
  return '/collection';
}

/** Canonical primary header navigation requested by owner. */
export const STANDARD_CATEGORIES: readonly NavCategory[] = [
  { slug: 'shop-all', name: 'Shop All Perfumes', kind: 'all', path: '/collection' },
  { slug: 'mens-perfumes', name: 'Men', kind: 'audience', filterValue: 'men', path: categoryPath('audience', 'men') },
  { slug: 'womens-perfumes', name: 'Women', kind: 'audience', filterValue: 'women', path: categoryPath('audience', 'women') },
  { slug: 'unisex-perfumes', name: 'Unisex', kind: 'audience', filterValue: 'unisex', path: categoryPath('audience', 'unisex') },
  { slug: 'inspired-fragrances', name: 'Inspired Fragrances', kind: 'type', filterValue: 'inspired', path: categoryPath('type', 'inspired') },
  { slug: 'personalized-perfumes', name: 'Create Your Perfume', kind: 'landing', path: '/make', highlight: true },
  { slug: 'gift-sets-combos', name: 'Gifting & Combos', kind: 'type', filterValue: 'bundle', path: categoryPath('type', 'bundle') },
];

export const DEFAULT_FRAGRANCE_TYPES: readonly FragranceTypeOption[] = [
  { id: 'ft-edp', slug: 'eau-de-parfum', name: 'Eau de Parfum', categorySlug: 'shop-all' },
  { id: 'ft-extrait', slug: 'extrait-de-parfum', name: 'Extrait de Parfum', categorySlug: 'shop-all' },
  { id: 'ft-edt', slug: 'eau-de-toilette', name: 'Eau de Toilette', categorySlug: 'shop-all' },
  { id: 'ft-inspired', slug: 'inspired-fragrance', name: 'Inspired Fragrance', categorySlug: 'inspired-fragrances' },
  { id: 'ft-gift', slug: 'gift-set-combo', name: 'Gift Set & Combo', categorySlug: 'gift-sets-combos' },
];

export const PRIMARY_NAV_SLUGS = [
  'shop-all',
  'mens-perfumes',
  'womens-perfumes',
  'unisex-perfumes',
  'inspired-fragrances',
  'personalized-perfumes',
  'gift-sets-combos',
] as const;

const PRIMARY_NAV_SET = new Set<string>(PRIMARY_NAV_SLUGS);

const HEADER_LABELS: Record<string, string> = {
  'shop-all': 'Shop All Perfumes',
  'mens-perfumes': 'Men',
  'womens-perfumes': 'Women',
  'unisex-perfumes': 'Unisex',
  'inspired-fragrances': 'Inspired Fragrances',
  'personalized-perfumes': 'Create Your Perfume',
  'gift-sets-combos': 'Gifting & Combos',
};

/** Concise label displayed in the primary header navigation. */
export const navLabel = (c: NavCategory) => HEADER_LABELS[c.slug] ?? c.name;

/** Orders database or fallback categories to the target 7 header items. */
export function primaryNavCategories(categories: readonly NavCategory[]): NavCategory[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  return PRIMARY_NAV_SLUGS.map((slug) => {
    const existing = bySlug.get(slug);
    const std = STANDARD_CATEGORIES.find((s) => s.slug === slug)!;
    return existing ? { ...std, ...existing, name: HEADER_LABELS[slug] ?? existing.name, highlight: std.highlight } : std;
  }).filter((c) => PRIMARY_NAV_SET.has(c.slug));
}

/** Retains primary nav categories with any published match while always preserving the 7 required headers. */
export function filterNavByProducts(categories: readonly NavCategory[], _products: readonly Product[]): NavCategory[] {
  return primaryNavCategories(categories);
}

/** Fallback navigation matching the approved 7 header destinations. */
export function navFromProducts(products: readonly Product[]): NavCategory[] {
  return filterNavByProducts(STANDARD_CATEGORIES, products);
}
