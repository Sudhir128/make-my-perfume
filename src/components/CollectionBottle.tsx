import { useEffect, type RefObject } from 'react';
import { useSceneSignals } from '../narrative/signals';
import type { Product } from '../data/catalog';
import { useActiveItem } from '../narrative/useActiveItem';
import { BottlePreview } from './BottlePreview';

/**
 * Stage 3: the house bottle takes the light of the product card crossing the
 * centre of the screen. Owns that state so only the bottle re-renders.
 */
export function CollectionBottle({ cards, products }: { cards: RefObject<HTMLElement | null>; products: readonly Product[] }) {
  const activeSlug = useActiveItem(cards, products[0]?.slug ?? '');
  const accent = products.find((p) => p.slug === activeSlug)?.collection ?? 'Warm';
  const setAccent = useSceneSignals((s) => s.setAccent);
  useEffect(() => setAccent(accent), [accent, setAccent]);
  return <BottlePreview house accent={accent} />;
}
