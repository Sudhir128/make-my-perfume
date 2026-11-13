import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { AvailabilityStatus, Product } from '../data/catalog';
import type { FragranceTypeOption, NavCategory } from '../data/categories';
import { PRICE_BUCKETS, queryProducts, type SortKey } from '../data/repository';
import { NoteGlyph } from './NoteGlyph';
import styles from './FilterDrawer.module.css';

export interface ActiveFilters {
  priceBuckets: string[];
  collections: string[];
  families: string[];
  fragranceTypes: string[];
  sizesMl: number[];
  availability: AvailabilityStatus[];
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  allProducts: readonly Product[];
  categories: readonly NavCategory[];
  families: readonly string[];
  fragranceTypes: readonly FragranceTypeOption[];
  sizes: readonly number[];
  q: string;
  sort: SortKey;
  initialFilters: ActiveFilters;
  onApply: (next: ActiveFilters) => void;
  onClearAll: () => void;
}

const AVAILABILITY_OPTIONS: Array<{ value: AvailabilityStatus; label: string }> = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'preorder', label: 'Preorder' },
];

function toggleItem<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/**
 * Left slide-over Filter Drawer modelled on the reference filter UI in Atelier styling:
 * 6 collapsible sections (Price, Collection, Family, Fragrance Type, Quantity, Availability)
 * + sticky bottom bar with Clear All and live Result (N).
 */
export function FilterDrawer({
  open,
  onClose,
  allProducts,
  categories,
  families,
  fragranceTypes,
  sizes,
  q,
  sort,
  initialFilters,
  onApply,
  onClearAll,
}: FilterDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ActiveFilters>(initialFilters);

  useEffect(() => {
    setDraft(initialFilters);
  }, [initialFilters, open]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  const collectionOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: Array<{ key: string; label: string }> = [];
    for (const c of categories) {
      if (c.kind === 'landing') continue;
      const key = c.filterValue ?? c.slug;
      if (key === 'all' || key === 'shop-all' || seen.has(key)) continue;
      seen.add(key);
      opts.push({ key, label: c.name });
    }
    return opts;
  }, [categories]);

  const previewCount = useMemo(
    () =>
      queryProducts(allProducts, {
        q,
        sort,
        priceBuckets: draft.priceBuckets,
        collections: draft.collections,
        families: draft.families,
        fragranceTypes: draft.fragranceTypes,
        sizesMl: draft.sizesMl,
        availability: draft.availability,
      }).length,
    [allProducts, q, sort, draft],
  );

  const handleClear = () => {
    const empty: ActiveFilters = {
      priceBuckets: [],
      collections: [],
      families: [],
      fragranceTypes: [],
      sizesMl: [],
      availability: [],
    };
    setDraft(empty);
    onClearAll();
    onClose();
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      aria-label="Filter perfumes"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.heading}>Filter</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close filters">
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.sections}>
          <details className={styles.group} open={draft.priceBuckets.length > 0}>
            <summary className={styles.summary}>
              <span className={styles.summaryTitle}>
                <ChevronRight className={styles.chev} size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Price</span>
              </span>
              {draft.priceBuckets.length > 0 && <em className={styles.badge}>({draft.priceBuckets.length})</em>}
            </summary>
            <div className={styles.options}>
              {PRICE_BUCKETS.map((b) => (
                <label key={b.id} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.priceBuckets.includes(b.id)}
                    onChange={() => setDraft((d) => ({ ...d, priceBuckets: toggleItem(d.priceBuckets, b.id) }))}
                  />
                  <span>{b.label}</span>
                </label>
              ))}
            </div>
          </details>

          <details className={styles.group} open={draft.collections.length > 0}>
            <summary className={styles.summary}>
              <span className={styles.summaryTitle}>
                <ChevronRight className={styles.chev} size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Collection</span>
              </span>
              {draft.collections.length > 0 && <em className={styles.badge}>({draft.collections.length})</em>}
            </summary>
            <div className={styles.options}>
              {collectionOptions.map((c) => (
                <label key={c.key} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.collections.includes(c.key)}
                    onChange={() => setDraft((d) => ({ ...d, collections: toggleItem(d.collections, c.key) }))}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </details>

          <details className={styles.group} open={draft.families.length > 0}>
            <summary className={styles.summary}>
              <span className={styles.summaryTitle}>
                <ChevronRight className={styles.chev} size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Family</span>
              </span>
              {draft.families.length > 0 && <em className={styles.badge}>({draft.families.length})</em>}
            </summary>
            <div className={styles.options}>
              {families.map((f) => (
                <label key={f} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.families.includes(f)}
                    onChange={() => setDraft((d) => ({ ...d, families: toggleItem(d.families, f) }))}
                  />
                  <NoteGlyph family={f} size={15} />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          </details>

          <details className={styles.group} open={draft.fragranceTypes.length > 0}>
            <summary className={styles.summary}>
              <span className={styles.summaryTitle}>
                <ChevronRight className={styles.chev} size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Fragrance Type</span>
              </span>
              {draft.fragranceTypes.length > 0 && <em className={styles.badge}>({draft.fragranceTypes.length})</em>}
            </summary>
            <div className={styles.options}>
              {fragranceTypes.map((ft) => (
                <label key={ft.slug} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.fragranceTypes.includes(ft.slug)}
                    onChange={() => setDraft((d) => ({ ...d, fragranceTypes: toggleItem(d.fragranceTypes, ft.slug) }))}
                  />
                  <span>{ft.name}</span>
                </label>
              ))}
            </div>
          </details>

          <details className={styles.group} open={draft.sizesMl.length > 0}>
            <summary className={styles.summary}>
              <span className={styles.summaryTitle}>
                <ChevronRight className={styles.chev} size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Quantity</span>
              </span>
              {draft.sizesMl.length > 0 && <em className={styles.badge}>({draft.sizesMl.length})</em>}
            </summary>
            <div className={styles.options}>
              {sizes.map((s) => (
                <label key={s} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.sizesMl.includes(s)}
                    onChange={() => setDraft((d) => ({ ...d, sizesMl: toggleItem(d.sizesMl, s) }))}
                  />
                  <span>{s} ml</span>
                </label>
              ))}
            </div>
          </details>

          <details className={styles.group} open={draft.availability.length > 0}>
            <summary className={styles.summary}>
              <span className={styles.summaryTitle}>
                <ChevronRight className={styles.chev} size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Availability</span>
              </span>
              {draft.availability.length > 0 && <em className={styles.badge}>({draft.availability.length})</em>}
            </summary>
            <div className={styles.options}>
              {AVAILABILITY_OPTIONS.map((a) => (
                <label key={a.value} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.availability.includes(a.value)}
                    onChange={() => setDraft((d) => ({ ...d, availability: toggleItem(d.availability, a.value) }))}
                  />
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.clearBtn} onClick={handleClear}>
            Clear All
          </button>
          <button type="button" className={styles.resultBtn} onClick={handleApply}>
            Result ({previewCount})
          </button>
        </div>
      </div>
    </dialog>
  );
}

