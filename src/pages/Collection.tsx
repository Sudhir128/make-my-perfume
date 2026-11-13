import { useMemo, useState } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { trackSiteActivity } from '../data/activity';
import type { AvailabilityStatus, Product } from '../data/catalog';
import { AUDIENCE_TITLES, TYPE_TITLES, type FragranceTypeOption, type NavCategory } from '../data/categories';
import {
  listAllCategories,
  listFamilies,
  listFragranceTypes,
  listSizes,
  listStorefrontProducts,
  PRICE_BUCKETS,
  queryProducts,
  type SortKey,
} from '../data/repository';
import { ButtonLink } from '../components/Button';
import { FilterDrawer, type ActiveFilters } from '../components/FilterDrawer';
import { NoteGlyph } from '../components/NoteGlyph';
import { ProductCard } from '../components/ProductCard';
import styles from './Collection.module.css';

export async function loader() {
  const [{ products }, families, categories, fragranceTypes, sizes] = await Promise.all([
    listStorefrontProducts(),
    listFamilies(),
    listAllCategories(),
    listFragranceTypes(),
    listSizes(),
  ]);
  return { products, families, categories, fragranceTypes, sizes };
}

/** Legacy ?collection= categories that were retired if no products exist. */
const LEGACY_CATEGORIES: Record<string, string> = {
  cosmopolitan: 'Cosmopolitan',
  fusion: 'Fusion',
  combo: 'Gifting & Combos',
  accessories: 'Accessories',
  others: 'Others',
};

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'featured', label: 'Make My Perfume Recommends' },
  { value: 'best-sellers', label: 'Best Sellers' },
  { value: 'newest', label: 'New Arrivals' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'best-matches', label: 'Best Matches' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

const parseCsv = (val: string | null): string[] =>
  val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

export default function Collection() {
  const { products, families, categories, fragranceTypes, sizes } = useLoaderData() as {
    products: Product[];
    families: string[];
    categories: NavCategory[];
    fragranceTypes: FragranceTypeOption[];
    sizes: number[];
  };
  const [params, setParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const audienceParam = params.get('audience');
  const typeParam = params.get('type');
  const collectionParam = params.get('collection');
  const legacyFamilyFromCollection =
    collectionParam && families.find((f) => f.toLowerCase() === collectionParam.toLowerCase());
  const legacyEmptyCategory = collectionParam && LEGACY_CATEGORIES[collectionParam.toLowerCase()];

  const activeFilters: ActiveFilters = useMemo(() => {
    const familyList = parseCsv(params.get('family'));
    if (legacyFamilyFromCollection && !familyList.includes(legacyFamilyFromCollection)) {
      familyList.push(legacyFamilyFromCollection);
    }
    const colList = parseCsv(params.get('collections'));
    if (audienceParam && !colList.includes(audienceParam)) colList.push(audienceParam);
    if (typeParam && !colList.includes(typeParam)) colList.push(typeParam);

    return {
      priceBuckets: parseCsv(params.get('price')),
      collections: colList,
      families: familyList,
      fragranceTypes: parseCsv(params.get('fragranceType')),
      sizesMl: parseCsv(params.get('size')).map(Number).filter((n) => Number.isFinite(n) && n > 0),
      availability: parseCsv(params.get('availability')) as AvailabilityStatus[],
    };
  }, [params, audienceParam, typeParam, legacyFamilyFromCollection]);

  const q = params.get('q') ?? '';
  const sort = (params.get('sort') as SortKey | null) ?? 'featured';

  const results = useMemo(
    () =>
      legacyEmptyCategory
        ? []
        : queryProducts(products, {
            families: activeFilters.families,
            collections: activeFilters.collections,
            fragranceTypes: activeFilters.fragranceTypes,
            sizesMl: activeFilters.sizesMl,
            priceBuckets: activeFilters.priceBuckets,
            availability: activeFilters.availability,
            q,
            sort,
          }),
    [products, activeFilters, q, sort, legacyEmptyCategory],
  );

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '' || (k === 'sort' && v === 'featured')) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const applyDrawerFilters = (next: ActiveFilters) => {
    const sp = new URLSearchParams(params);
    // Sync top-level audience/type URL params cleanly alongside drawer collections
    sp.delete('audience');
    sp.delete('type');
    sp.delete('collection');
    if (next.collections.length === 1 && ['men', 'women', 'unisex'].includes(next.collections[0]!)) {
      sp.set('audience', next.collections[0]!);
      sp.delete('collections');
    } else if (next.collections.length === 1 && ['inspired', 'bundle'].includes(next.collections[0]!)) {
      sp.set('type', next.collections[0]!);
      sp.delete('collections');
    } else if (next.collections.length > 0) {
      sp.set('collections', next.collections.join(','));
    } else {
      sp.delete('collections');
    }

    if (next.families.length) sp.set('family', next.families.join(','));
    else sp.delete('family');

    if (next.priceBuckets.length) sp.set('price', next.priceBuckets.join(','));
    else sp.delete('price');

    if (next.fragranceTypes.length) sp.set('fragranceType', next.fragranceTypes.join(','));
    else sp.delete('fragranceType');

    if (next.sizesMl.length) sp.set('size', next.sizesMl.join(','));
    else sp.delete('size');

    if (next.availability.length) sp.set('availability', next.availability.join(','));
    else sp.delete('availability');

    setParams(sp, { replace: true, preventScrollReset: true });
  };

  const clearAllFilters = () => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (sort !== 'featured') sp.set('sort', sort);
    setParams(sp, { replace: true, preventScrollReset: true });
  };

  const activeFilterCount =
    activeFilters.priceBuckets.length +
    activeFilters.collections.length +
    activeFilters.families.length +
    activeFilters.fragranceTypes.length +
    activeFilters.sizesMl.length +
    activeFilters.availability.length;

  const headingContext =
    legacyEmptyCategory ??
    (audienceParam ? AUDIENCE_TITLES[audienceParam] : null) ??
    (typeParam ? TYPE_TITLES[typeParam] : null) ??
    (activeFilters.families.length === 1 ? activeFilters.families[0] : null);

  return (
    <div className={`${styles.page} page-width`}>
      <h1 className="visually-hidden">{headingContext ? `${headingContext} Collection` : 'All Perfumes'}</h1>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            type="button"
            className={styles.filterBtn}
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
          >
            <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>

          <form
            role="search"
            className={styles.search}
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) trackSiteActivity('catalogue.searched', 'catalogue', null, `Searched "${q.trim()}"`);
            }}
          >
            <label htmlFor="collection-search" className="visually-hidden">
              Search fragrances, notes or moods
            </label>
            <Search size={16} strokeWidth={1.5} aria-hidden="true" className={styles.searchIcon} />
            <input
              id="collection-search"
              type="search"
              placeholder="Search fragrances, notes or moods"
              autoComplete="off"
              value={q}
              onChange={(e) => updateParams({ q: e.target.value, collection: null })}
            />
            {q && (
              <button type="button" className={styles.clear} onClick={() => updateParams({ q: null })} aria-label="Clear search">
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </form>
        </div>

        <div className={styles.sort}>
          <label htmlFor="collection-sort">Sort by</label>
          <select id="collection-sort" value={sort} onChange={(e) => updateParams({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick scent-family filter pills */}
      <div className={styles.chips} role="group" aria-label="Filter by scent family">
        <button
          type="button"
          className={styles.chip}
          aria-pressed={activeFilters.families.length === 0 && !legacyEmptyCategory}
          onClick={() => updateParams({ family: null, collection: null })}
        >
          All
        </button>
        {families.map((f) => {
          const pressed = activeFilters.families.includes(f);
          return (
            <button
              key={f}
              type="button"
              className={styles.chip}
              aria-pressed={pressed}
              onClick={() => {
                const next = pressed ? activeFilters.families.filter((x) => x !== f) : [f];
                updateParams({ family: next.length ? next.join(',') : null, collection: null });
              }}
            >
              <NoteGlyph family={f} size={16} />
              {f}
            </button>
          );
        })}
      </div>

      {/* Active drawer filter pills */}
      {activeFilterCount > 0 && (
        <div className={styles.activeBar} aria-label="Active filters">
          {activeFilters.priceBuckets.map((id) => (
            <button
              key={`p-${id}`}
              type="button"
              className={styles.activePill}
              onClick={() => applyDrawerFilters({ ...activeFilters, priceBuckets: activeFilters.priceBuckets.filter((x) => x !== id) })}
            >
              {PRICE_BUCKETS.find((b) => b.id === id)?.label ?? id} <X size={12} aria-hidden="true" />
            </button>
          ))}
          {activeFilters.collections.map((c) => (
            <button
              key={`c-${c}`}
              type="button"
              className={styles.activePill}
              onClick={() => applyDrawerFilters({ ...activeFilters, collections: activeFilters.collections.filter((x) => x !== c) })}
            >
              Collection: {c} <X size={12} aria-hidden="true" />
            </button>
          ))}
          {activeFilters.fragranceTypes.map((ft) => (
            <button
              key={`ft-${ft}`}
              type="button"
              className={styles.activePill}
              onClick={() =>
                applyDrawerFilters({ ...activeFilters, fragranceTypes: activeFilters.fragranceTypes.filter((x) => x !== ft) })
              }
            >
              {fragranceTypes.find((t) => t.slug === ft)?.name ?? ft} <X size={12} aria-hidden="true" />
            </button>
          ))}
          {activeFilters.sizesMl.map((s) => (
            <button
              key={`s-${s}`}
              type="button"
              className={styles.activePill}
              onClick={() => applyDrawerFilters({ ...activeFilters, sizesMl: activeFilters.sizesMl.filter((x) => x !== s) })}
            >
              {s} ml <X size={12} aria-hidden="true" />
            </button>
          ))}
          {activeFilters.availability.map((a) => (
            <button
              key={`a-${a}`}
              type="button"
              className={styles.activePill}
              onClick={() => applyDrawerFilters({ ...activeFilters, availability: activeFilters.availability.filter((x) => x !== a) })}
            >
              {a.replace(/_/g, ' ')} <X size={12} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className={styles.clearInline} onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      )}

      <p className={styles.count} role="status">
        {results.length} {results.length === 1 ? 'fragrance' : 'fragrances'}
        {q && <> for “{q}”</>}
      </p>

      {results.length > 0 ? (
        <ul className={styles.grid}>
          {results.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} headingLevel="h2" />
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            {legacyEmptyCategory ? (
              <>
                {legacyEmptyCategory} <em>is coming soon.</em>
              </>
            ) : (
              <>
                Nothing matches <em>yet.</em>
              </>
            )}
          </h2>
          <p className={styles.emptyBody}>
            {legacyEmptyCategory
              ? 'There are no fragrances in this collection yet.'
              : 'Try adjusting your filters, or search another note, mood, or family.'}
          </p>
          <ButtonLink to="/collection" variant="ghost" onClick={clearAllFilters}>
            Browse all perfumes
          </ButtonLink>
        </div>
      )}

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        allProducts={products}
        categories={categories}
        families={families}
        fragranceTypes={fragranceTypes}
        sizes={sizes}
        q={q}
        sort={sort}
        initialFilters={activeFilters}
        onApply={applyDrawerFilters}
        onClearAll={clearAllFilters}
      />
    </div>
  );
}
