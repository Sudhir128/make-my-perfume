/*
 * Temporary product photography (owner request, 2026-10-16): unbranded stock
 * photographs from Pexels, chosen per product mood until real product photos
 * exist. Sources and the brand audit are in docs/product-imagery.md.
 * Products without an entry fall back to the CSS artwork.
 */
import amber480 from '../assets/products/amber-veil-480.webp';
import amber960 from '../assets/products/amber-veil-960.webp';
import azure480 from '../assets/products/azure-skin-480.webp';
import azure960 from '../assets/products/azure-skin-960.webp';
import citrus480 from '../assets/products/citrus-noir-480.webp';
import citrus960 from '../assets/products/citrus-noir-960.webp';
import nocturne480 from '../assets/products/nocturne-480.webp';
import nocturne960 from '../assets/products/nocturne-960.webp';
import saffron480 from '../assets/products/saffron-neroli-480.webp';
import saffron960 from '../assets/products/saffron-neroli-960.webp';
import velvet480 from '../assets/products/velvet-fig-480.webp';
import velvet960 from '../assets/products/velvet-fig-960.webp';

export interface ProductImage {
  src: string;
  srcSet: string;
  /** Describes what the photograph shows. */
  alt: string;
}

const img = (s: string, l: string, alt: string): ProductImage => ({ src: l, srcSet: `${s} 480w, ${l} 960w`, alt });

const IMAGES: Record<string, ProductImage> = {
  'citrus-noir': img(citrus480, citrus960, 'Clear glass perfume bottle resting in sunlit sand'),
  'amber-veil': img(amber480, amber960, 'Square glass perfume bottle filled with amber liquid'),
  nocturne: img(nocturne480, nocturne960, 'Ornate hand-blown glass perfume decanter with gold detailing'),
  'azure-skin': img(azure480, azure960, 'Blue glass perfume bottle with a vintage atomizer bulb'),
  'velvet-fig': img(velvet480, velvet960, 'Round perfume bottle with deep red liquid on a pink ground'),
  'saffron-neroli': img(saffron480, saffron960, 'Tall perfume bottle with a gold cap on cream satin'),
};

export function productImage(slug: string): ProductImage | null {
  return IMAGES[slug] ?? null;
}
