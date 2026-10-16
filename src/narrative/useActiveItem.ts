import { useEffect, useState, type RefObject } from 'react';

/**
 * Which child (matched by `[data-active-key]`) is crossing the middle band of
 * the viewport. One IntersectionObserver, no scroll listener; returns the key.
 */
export function useActiveItem(container: RefObject<HTMLElement | null>, initial: string): string {
  const [active, setActive] = useState(initial);
  useEffect(() => {
    const root = container.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const items = [...root.querySelectorAll<HTMLElement>('[data-active-key]')];
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive((hit.target as HTMLElement).dataset.activeKey ?? initial);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.5, 1] },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [container, initial]);
  return active;
}
