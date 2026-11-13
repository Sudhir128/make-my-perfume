import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CarouselItem } from '../data/selections';
import { ButtonLink } from './Button';
import { ProductCard } from './ProductCard';
import styles from './ProductCarousel.module.css';

export interface CarouselTabOption {
  id: string;
  label: string;
  count?: number;
}

interface ProductCarouselProps {
  title: string;
  accentWord?: string;
  eyebrow?: string;
  items: readonly CarouselItem[];
  viewAllTo: string;
  viewAllLabel?: string;
  tabs?: readonly CarouselTabOption[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

/**
 * Horizontal editorial fragrance carousel using native scroll snap,
 * accessible button controls, keyboard Left/Right navigation, and Atelier ProductCards.
 */
export function ProductCarousel({
  title,
  accentWord,
  eyebrow,
  items,
  viewAllTo,
  viewAllLabel = 'View all',
  tabs,
  activeTab,
  onTabChange,
}: ProductCarouselProps) {
  const headingId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const syncButtons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // Reset scroll position when activeTab or items change
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.scrollLeft = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    syncButtons();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(syncButtons);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length, syncButtons]);

  const stepBy = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const distance = Math.max(260, Math.round(el.clientWidth * 0.78));
    el.scrollBy({ left: dir * distance, behavior: reduced ? 'auto' : 'smooth' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepBy(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepBy(-1);
    }
  };

  if (items.length === 0 && (!tabs || tabs.length === 0)) return null;

  return (
    <section
      className={`${styles.section} page-width`}
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
    >
      <header className={styles.head}>
        <div>
          {eyebrow && <p className="eyebrow eyebrow--lead">{eyebrow}</p>}
          <h2 id={headingId} className={styles.title}>
            {title}
            {accentWord && (
              <>
                {' '}
                <em>{accentWord}</em>
              </>
            )}
          </h2>
          {tabs && tabs.length > 0 && (
            <div className={styles.tabRow} role="tablist" aria-label={`${title} filter tabs`}>
              {tabs.map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={[styles.tabBtn, isSelected ? styles.tabBtnActive : ''].filter(Boolean).join(' ')}
                    onClick={() => onTabChange?.(tab.id)}
                  >
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && <em className={styles.tabCount}>({tab.count})</em>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className={styles.controls}>
          <div className={styles.arrows} role="group" aria-label={`${title} ${accentWord ?? ''} carousel controls`.trim()}>
            <button
              type="button"
              className={styles.arrowBtn}
              onClick={() => stepBy(-1)}
              disabled={!canPrev}
              aria-label={`Previous ${title}`}
            >
              <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.arrowBtn}
              onClick={() => stepBy(1)}
              disabled={!canNext}
              aria-label={`Next ${title}`}
            >
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <ButtonLink to={viewAllTo} variant="quiet" arrow>
            {viewAllLabel}
          </ButtonLink>
        </div>
      </header>

      <ul ref={trackRef} className={styles.track} onScroll={syncButtons} tabIndex={0} aria-label={`${title} ${accentWord ?? ''}`.trim()}>
        {items.map((item) => (
          <li key={`${item.product.slug}-${item.variant?.sku ?? item.product.sizeMl}`} className={styles.slide}>
            <ProductCard product={item.product} variant={item.variant} />
          </li>
        ))}
      </ul>
    </section>
  );
}

