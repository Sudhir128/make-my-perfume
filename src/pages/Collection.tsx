import { useMemo } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import { Search, X } from 'lucide-react';
import type { Product } from '../data/catalog';
import { listFamilies, listProducts, queryProducts, type SortKey } from '../data/repository';
import { ButtonLink } from '../components/Button';
import { NoteGlyph } from '../components/NoteGlyph';
import { ProductCard } from '../components/ProductCard';
import styles from './Collection.module.css';

export async function loader() {
  const [products, families] = await Promise.all([listProducts(), listFamilies()]);
  return { products, families };
}

/** Categories from the header that have no fragrances yet. */
const CATEGORIES: Record<string, string> = {
  cosmopolitan: 'Cosmopolitan',
  fusion: 'Fusion',
  combo: 'Combo Deals',
  accessories: 'Accessories',
  others: 'Others',
};

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name' },
];

export default function Collection() {
  const { products, families } = useLoaderData() as { products: Product[]; families: string[] };
  const [params, setParams] = useSearchParams();

  // ?family=Woody, or the previous site's ?collection=Woody, both select a family.
  const collectionParam = params.get('collection');
  const familyParam = params.get('family') ?? families.find((f) => f.toLowerCase() === collectionParam?.toLowerCase()) ?? null;
  const category = collectionParam && CATEGORIES[collectionParam.toLowerCase()];
  const q = params.get('q') ?? '';
  const sort = (params.get('sort') as SortKey | null) ?? 'featured';

  const results = useMemo(
    () => (category ? [] : queryProducts(products, { families: familyParam ? [familyParam] : undefined, q, sort })),
    [products, familyParam, q, sort, category],
  );

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '' || (k === 'sort' && v === 'featured')) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const title = category ?? familyParam;

  return (
    <div className={`${styles.page} page-width`}>
      <header className={styles.head}>
        <div>
          <p className="eyebrow eyebrow--lead">{title ? `${title} collection` : 'The complete edit'}</p>
          <h1 className={styles.title}>
            Find your <em>signature.</em>
          </h1>
        </div>
        <p className={styles.lede}>Compositions for the moods you carry, from first light to after hours.</p>
      </header>

      <div className={styles.toolbar}>
        <form role="search" className={styles.search} onSubmit={(e) => e.preventDefault()}>
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
            onChange={(e) => update({ q: e.target.value, collection: null })}
          />
          {q && (
            <button type="button" className={styles.clear} onClick={() => update({ q: null })} aria-label="Clear search">
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
        </form>
        <div className={styles.sort}>
          <label htmlFor="collection-sort">Sort by</label>
          <select id="collection-sort" value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.chips} role="group" aria-label="Filter by scent family">
        <button type="button" className={styles.chip} aria-pressed={!familyParam && !category} onClick={() => update({ family: null, collection: null })}>
          All
        </button>
        {families.map((f) => (
          <button
            key={f}
            type="button"
            className={styles.chip}
            aria-pressed={familyParam === f}
            onClick={() => update({ family: familyParam === f ? null : f, collection: null })}
          >
            <NoteGlyph family={f} size={16} />
            {f}
          </button>
        ))}
      </div>

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
            {category ? (
              <>
                {category} <em>is coming soon.</em>
              </>
            ) : (
              <>
                Nothing matches <em>yet.</em>
              </>
            )}
          </h2>
          <p className={styles.emptyBody}>
            {category ? 'There are no fragrances in this collection yet.' : 'Try another note, mood or family.'}
          </p>
          <ButtonLink to="/collection" variant="ghost">
            Browse all perfumes
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
