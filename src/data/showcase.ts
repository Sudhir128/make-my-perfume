/*
 * Enriches the 6 bundled showcase scents with category, fragrance type,
 * availability, and carousel tags while Supabase has 0 published rows.
 * Never alters src/data/legacy/products.json; once the Admin Portal publishes
 * any database product, live Supabase rows replace showcase defaults.
 */
import type { AvailabilityStatus, Audience, Product } from './catalog';

interface ShowcaseOverlay {
  audience: Audience;
  types: string[];
  categorySlugs: string[];
  fragranceType: string;
  fragranceTypeSlug: string;
  isTrending: boolean;
  isSignature: boolean;
  isBestSeller: boolean;
  popularityScore: number;
  availability: AvailabilityStatus;
  extraSizes: Array<{
    sizeMl: number;
    price: number;
    sale?: { compareAt: number; discountPct: number };
  }>;
}

const OVERLAY: Record<string, ShowcaseOverlay> = {
  'citrus-noir': {
    audience: 'men',
    types: ['inspired'],
    categorySlugs: ['shop-all', 'mens-perfumes', 'inspired-fragrances'],
    fragranceType: 'Eau de Parfum',
    fragranceTypeSlug: 'eau-de-parfum',
    isTrending: true,
    isSignature: true,
    isBestSeller: true,
    popularityScore: 96,
    availability: 'in_stock',
    extraSizes: [
      { sizeMl: 50, price: 790 },
      { sizeMl: 100, price: 1200, sale: { compareAt: 1450, discountPct: 17 } },
    ],
  },
  'amber-veil': {
    audience: 'unisex',
    types: [],
    categorySlugs: ['shop-all', 'unisex-perfumes'],
    fragranceType: 'Extrait de Parfum',
    fragranceTypeSlug: 'extrait-de-parfum',
    isTrending: true,
    isSignature: true,
    isBestSeller: true,
    popularityScore: 94,
    availability: 'in_stock',
    extraSizes: [
      { sizeMl: 50, price: 1490 },
      { sizeMl: 100, price: 2190 },
    ],
  },
  nocturne: {
    audience: 'men',
    types: [],
    categorySlugs: ['shop-all', 'mens-perfumes'],
    fragranceType: 'Extrait de Parfum',
    fragranceTypeSlug: 'extrait-de-parfum',
    isTrending: true,
    isSignature: true,
    isBestSeller: true,
    popularityScore: 91,
    availability: 'in_stock',
    extraSizes: [
      { sizeMl: 50, price: 1190 },
      { sizeMl: 100, price: 1750 },
    ],
  },
  'azure-skin': {
    audience: 'unisex',
    types: ['inspired'],
    categorySlugs: ['shop-all', 'unisex-perfumes', 'inspired-fragrances'],
    fragranceType: 'Eau de Toilette',
    fragranceTypeSlug: 'eau-de-toilette',
    isTrending: true,
    isSignature: false,
    isBestSeller: true,
    popularityScore: 89,
    availability: 'in_stock',
    extraSizes: [
      { sizeMl: 50, price: 990 },
      { sizeMl: 100, price: 1490, sale: { compareAt: 1750, discountPct: 15 } },
    ],
  },
  'velvet-fig': {
    audience: 'women',
    types: [],
    categorySlugs: ['shop-all', 'womens-perfumes'],
    fragranceType: 'Eau de Parfum',
    fragranceTypeSlug: 'eau-de-parfum',
    isTrending: true,
    isSignature: true,
    isBestSeller: false,
    popularityScore: 86,
    availability: 'low_stock',
    extraSizes: [
      { sizeMl: 50, price: 1350 },
      { sizeMl: 100, price: 1950 },
    ],
  },
  'saffron-neroli': {
    audience: 'women',
    types: ['bundle'],
    categorySlugs: ['shop-all', 'womens-perfumes', 'gift-sets-combos'],
    fragranceType: 'Gift Set & Combo',
    fragranceTypeSlug: 'gift-set-combo',
    isTrending: true,
    isSignature: false,
    isBestSeller: false,
    popularityScore: 88,
    availability: 'in_stock',
    extraSizes: [
      { sizeMl: 50, price: 790, sale: { compareAt: 990, discountPct: 20 } },
      { sizeMl: 100, price: 1100 },
    ],
  },
};

export function enrichShowcaseProduct(product: Product): Product {
  const ov = OVERLAY[product.slug];
  if (!ov) return product;
  const variants = ov.extraSizes.map((s) => ({
    sku: `SHOWCASE-${product.slug.toUpperCase()}-${s.sizeMl}`,
    sizeMl: s.sizeMl,
    price: s.price,
    availability: ov.availability,
    ...(s.sale ? { sale: s.sale } : {}),
  }));
  return {
    ...product,
    audience: ov.audience,
    types: ov.types,
    categorySlugs: ov.categorySlugs,
    families: product.collection ? [product.collection] : [],
    fragranceType: ov.fragranceType,
    fragranceTypeSlug: ov.fragranceTypeSlug,
    isFeatured: true,
    isTrending: ov.isTrending,
    isSignature: ov.isSignature,
    isBestSeller: ov.isBestSeller,
    popularityScore: ov.popularityScore,
    availability: ov.availability,
    sku: `SHOWCASE-${product.slug.toUpperCase()}-${product.sizeMl}`,
    variants,
  };
}

