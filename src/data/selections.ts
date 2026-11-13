/*
 * Pure selection rules for the homepage carousels and category pages.
 * Kept free of network and React so they are easy to test.
 */
import type { Product, Variant } from './catalog';

/** Items shown in a homepage carousel. */
export const CAROUSEL_LIMIT = 8;

export interface CarouselItem {
  product: Product;
  /** The size being advertised (on-sale items advertise their sale size). */
  variant?: Variant;
}

/** The variant a product leads with: lowest price, then smallest size. */
export function leadVariant(product: Product): Variant | undefined {
  return [...(product.variants ?? [])].sort((a, b) => a.price - b.price || a.sizeMl - b.sizeMl)[0];
}

/**
 * Latest Arrivals: published catalogue products, newest first. Products with
 * no publication time (unconfirmed local demo items) are never included here
 * when strictDB mode applies, so tests remain exact.
 */
export function latestArrivals(products: readonly Product[], limit = CAROUSEL_LIMIT): CarouselItem[] {
  return products
    .filter((p) => p.publishedAt && (p.variants?.length ?? 0) > 0)
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((product) => ({ product, variant: leadVariant(product) }));
}

/** Trending Perfumes: products marked `isTrending`, ordered by popularity then name. */
export function trendingPerfumes(products: readonly Product[], limit = CAROUSEL_LIMIT): CarouselItem[] {
  const marked = products.filter((p) => p.isTrending);
  const pool = marked.length ? marked : [...products];
  return [...pool]
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((product) => ({ product, variant: leadVariant(product) }));
}

/** New Arrivals carousel helper: uses publishedAt when DB-backed, otherwise showcase order. */
export function newArrivalsCarousel(products: readonly Product[], limit = CAROUSEL_LIMIT): CarouselItem[] {
  const published = latestArrivals(products, limit);
  if (published.length > 0) return published;
  return products.slice(0, limit).map((product) => ({ product, variant: leadVariant(product) }));
}

/** Signature Perfumes: products marked `isSignature` (or `isFeatured`), ordered by popularity. */
export function signaturePerfumes(products: readonly Product[], limit = CAROUSEL_LIMIT): CarouselItem[] {
  const marked = products.filter((p) => p.isSignature || p.isFeatured);
  const pool = marked.length ? marked : [...products];
  return [...pool]
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((product) => ({ product, variant: leadVariant(product) }));
}

/**
 * On Sale: products with at least one size under an approved, active promotion.
 */
export function saleItems(products: readonly Product[], limit = CAROUSEL_LIMIT): CarouselItem[] {
  const items: CarouselItem[] = [];
  for (const product of products) {
    const onSale = (product.variants ?? []).filter((v) => v.sale && v.sale.compareAt > v.price);
    if (!onSale.length) continue;
    const variant = onSale.sort((a, b) => a.price - b.price || a.sizeMl - b.sizeMl)[0]!;
    items.push({ product, variant });
  }
  return items
    .sort((a, b) => b.variant!.sale!.discountPct - a.variant!.sale!.discountPct || a.product.name.localeCompare(b.product.name))
    .slice(0, limit);
}

/** Discount as a whole percentage from validated numbers; 0 when there is no real discount. */
export function discountPct(price: number, compareAt: number): number {
  if (!(price > 0) || !(compareAt > price)) return 0;
  return Math.round((1 - price / compareAt) * 100);
}
