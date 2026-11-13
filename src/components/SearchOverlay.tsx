import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, ChevronRight, Search, X } from 'lucide-react';
import { trackSiteActivity } from '../data/activity';
import type { Product } from '../data/catalog';
import { productImage } from '../data/productImages';
import { listProducts } from '../data/repository';
import { formatINR } from '../lib/format';
import { NoteGlyph } from './NoteGlyph';
import styles from './SearchOverlay.module.css';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const FAVOURITE_CHIPS = [
  'Citrus Noir',
  'Woody',
  'Fresh',
  'Amber Veil',
  'Extrait de Parfum',
  'Vanilla',
  'Gift Sets',
  'Inspired Fragrances',
];

const EXPLORE_LINKS = [
  { to: '/collection', label: 'Shop All Perfumes' },
  { to: '/collection?audience=men', label: 'Men' },
  { to: '/collection?audience=women', label: 'Women' },
  { to: '/collection?audience=unisex', label: 'Unisex' },
  { to: '/collection?type=inspired', label: 'Inspired Fragrances' },
  { to: '/make', label: 'Create Your Perfume', badge: 'Bespoke' },
  { to: '/collection?type=bundle', label: 'Gifting & Combos' },
];

export function SearchOverlay({ open, onClose, initialQuery = '' }: SearchOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState(initialQuery);

  // Load latest catalogue products when mounted or opened
  useEffect(() => {
    let cancelled = false;
    listProducts()
      .then((res) => {
        if (!cancelled) setProducts(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Sync initial query
  useEffect(() => {
    if (open) {
      setQ(initialQuery);
      // Auto-focus input after render
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, initialQuery]);

  // Dialog open/close lifecycle
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      if (typeof dlg.showModal === 'function') {
        dlg.showModal();
      } else {
        dlg.setAttribute('open', '');
      }
    } else if (!open && dlg.open) {
      if (typeof dlg.close === 'function') {
        dlg.close();
      } else {
        dlg.removeAttribute('open');
      }
    }
  }, [open]);

  // Escape key listener & backdrop click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Live matching results as user enters spelling
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];

    return products.filter((p) => {
      // 1. Name match
      if (p.name.toLowerCase().includes(term)) return true;
      // 2. Family match
      if (p.collection && p.collection.toLowerCase().includes(term)) return true;
      if (p.families?.some((f) => f.toLowerCase().includes(term))) return true;
      // 3. Fragrance type
      if (p.fragranceType && p.fragranceType.toLowerCase().includes(term)) return true;
      // 4. Notes match
      const allNotes = [...(p.notes?.top ?? []), ...(p.notes?.heart ?? []), ...(p.notes?.base ?? [])];
      if (allNotes.some((n) => n.toLowerCase().includes(term))) return true;
      // 5. Tagline & description
      if (p.tagline?.toLowerCase().includes(term)) return true;
      if (p.description?.toLowerCase().includes(term)) return true;
      // 6. Audience
      if (p.audience?.toLowerCase() === term) return true;
      return false;
    });
  }, [products, q]);

  // Fallback popular/trending products when search query is empty
  const currentFavourites = useMemo(() => {
    const trending = products.filter((p) => p.isTrending || p.isBestSeller);
    return trending.length ? trending.slice(0, 5) : products.slice(0, 5);
  }, [products]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) {
      trackSiteActivity('catalogue.searched', 'catalogue', null, `Live search submitted: "${term}"`);
      navigate(`/collection?q=${encodeURIComponent(term)}`);
      onClose();
    }
  };

  const handleProductClick = (p: Product) => {
    trackSiteActivity('product.viewed', 'product', p.slug, `Selected "${p.name}" from search`);
    onClose();
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.backdrop}
      aria-label="Search fragrances and explore"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.container}>
        {/* ── Left Column: Live Search & Matching Results (Paper) ──── */}
        <div className={styles.left}>
          <div className={styles.searchBarWrapper}>
            <form role="search" className={styles.searchBar} onSubmit={handleSubmit}>
              <Search className={styles.searchIcon} size={20} strokeWidth={1.5} aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                className={styles.input}
                placeholder="Search for products & more"
                autoComplete="off"
                spellCheck="false"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    setQ('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                >
                  <X size={15} strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </form>
          </div>

          <div className={styles.resultsScroll}>
            {q.trim() === '' ? (
              /* When input is empty: show Current Favourites */
              <div>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Current Favourites</h3>
                </div>

                <div className={styles.chips} role="group" aria-label="Suggested search terms">
                  {FAVOURITE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className={styles.chip}
                      onClick={() => setQ(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <ul className={styles.resultsList} role="list" aria-label="Current favourite fragrances">
                  {currentFavourites.map((p) => {
                    const photo = productImage(p.slug);
                    const leadNotes = [...(p.notes?.top ?? []), ...(p.notes?.heart ?? [])].slice(0, 3).join(' · ');
                    return (
                      <li key={p.slug}>
                        <Link
                          to={`/product/${p.slug}`}
                          className={styles.productRow}
                          onClick={() => handleProductClick(p)}
                        >
                          <div className={styles.productThumb}>
                            {photo ? (
                              <img src={photo.src} alt={p.name} loading="lazy" />
                            ) : (
                              <NoteGlyph family={p.collection} size={24} />
                            )}
                          </div>
                          <div className={styles.productMeta}>
                            <span className={styles.productName}>{p.name}</span>
                            <span className={styles.productSubtitle}>
                              {p.collection} {p.fragranceType ? `· ${p.fragranceType}` : ''}
                            </span>
                            {leadNotes && <span className={styles.productNotes}>{leadNotes}</span>}
                          </div>
                          <div className={styles.productPriceArea}>
                            <span className={styles.price}>{formatINR(p.price)}</span>
                            {p.variants?.some((v) => v.sale) && (
                              <span className={styles.saleBadge}>Sale</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              /* When input has text: show Live Matching Results */
              <div>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Possible Results</h3>
                  <span className={styles.countBadge}>
                    {matches.length} {matches.length === 1 ? 'fragrance' : 'fragrances'}
                  </span>
                </div>

                {matches.length > 0 ? (
                  <ul className={styles.resultsList} role="list" aria-label="Search results">
                    {matches.map((p) => {
                      const photo = productImage(p.slug);
                      const allNotes = [...(p.notes?.top ?? []), ...(p.notes?.heart ?? []), ...(p.notes?.base ?? [])].slice(0, 4).join(' · ');
                      return (
                        <li key={p.slug}>
                          <Link
                            to={`/product/${p.slug}`}
                            className={styles.productRow}
                            onClick={() => handleProductClick(p)}
                          >
                            <div className={styles.productThumb}>
                              {photo ? (
                                <img src={photo.src} alt={p.name} loading="lazy" />
                              ) : (
                                <NoteGlyph family={p.collection} size={24} />
                              )}
                            </div>
                            <div className={styles.productMeta}>
                              <span className={styles.productName}>{p.name}</span>
                              <span className={styles.productSubtitle}>
                                {p.collection} {p.fragranceType ? `· ${p.fragranceType}` : ''}
                              </span>
                              {allNotes && <span className={styles.productNotes}>{allNotes}</span>}
                            </div>
                            <div className={styles.productPriceArea}>
                              <span className={styles.price}>{formatINR(p.price)}</span>
                              {p.variants?.some((v) => v.sale) && (
                                <span className={styles.saleBadge}>Sale</span>
                              )}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>No exact match found</p>
                    <p className={styles.emptyText}>
                      We couldn’t find fragrances matching “{q}”. Try searching by a note like <em>Bergamot</em> or <em>Vanilla</em>, or explore our scent families.
                    </p>
                    <div className={styles.chips}>
                      {FAVOURITE_CHIPS.slice(0, 4).map((chip) => (
                        <button key={chip} type="button" className={styles.chip} onClick={() => setQ(chip)}>
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {q.trim() && (
            <div className={styles.viewAllFooter}>
              <button type="button" className={styles.viewAllBtn} onClick={handleSubmit}>
                <span>View all {matches.length} results in Catalogue</span>
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* ── Right Column: Category Exploration (Noir) ───────────── */}
        <div className={styles.right}>
          <div className={styles.closeRow}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close search overlay"
            >
              <X size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <h3 className={styles.exploreHeading}>Explore Make My Perfume</h3>

          <nav aria-label="Explore categories">
            <ul className={styles.navList}>
              {EXPLORE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className={styles.navLink}
                    onClick={() => {
                      trackSiteActivity('page.visited', 'category', null, `Navigated to ${link.label} from search overlay`);
                      onClose();
                    }}
                  >
                    <span>{link.label}</span>
                    {link.badge ? (
                      <span className={styles.navBadge}>{link.badge}</span>
                    ) : (
                      <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </dialog>
  );
}
