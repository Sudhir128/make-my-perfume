import { useState } from 'react';
import { useSceneSignals } from '../narrative/signals';
import { Link } from 'react-router';
import { Accord } from './Accord';
import { NoteGlyph } from './NoteGlyph';
import styles from './FamilyRing.module.css';

export interface FamilyItem {
  family: string;
  /** One fragrance in this family, from the catalogue. */
  scent: string;
}

/**
 * Stage 2: the six families gathered around the liquid accord. Each is a link
 * to the filtered collection; hovering or focusing one previews its colour in
 * the accord. All six are always visible (2 × 3 grid on phones).
 */
export function FamilyRing({ items, defaultFamily = 'Warm' }: { items: FamilyItem[]; defaultFamily?: string }) {
  const [preview, setLocalPreview] = useState<string | null>(null);
  const setScenePreview = useSceneSignals((s) => s.setPreview);
  // The CSS accord (Still tier) and the 3D accord (Full tier) both follow the preview.
  const setPreview = (f: string | null) => {
    setLocalPreview(f);
    setScenePreview(f);
  };
  const half = Math.ceil(items.length / 2);
  const columns = [items.slice(0, half), items.slice(half)];

  const link = (it: FamilyItem) => (
    <li key={it.family}>
      <Link
        to={`/collection?family=${encodeURIComponent(it.family)}`}
        className={styles.link}
        data-active={preview === it.family || undefined}
        onMouseEnter={() => setPreview(it.family)}
        onMouseLeave={() => setPreview(null)}
        onFocus={() => setPreview(it.family)}
        onBlur={() => setPreview(null)}
      >
        <NoteGlyph family={it.family} size={26} className={styles.glyph} />
        <span className={styles.text}>
          <span className={styles.family}>{it.family}</span>{' '}
          <span className={styles.scent}>{it.scent}</span>
        </span>
      </Link>
    </li>
  );

  return (
    <nav className={styles.ring} aria-labelledby="families-label">
      <p id="families-label" className={styles.label}>
        Six scent families
      </p>
      <div className={styles.layout} data-ring-layout>
        <ul className={`${styles.list} ${styles.left}`}>{columns[0]!.map(link)}</ul>
        <div className={styles.scene} data-scene-slot="accord">
          <Accord family={preview ?? defaultFamily} />
        </div>
        <ul className={`${styles.list} ${styles.right}`}>{columns[1]!.map(link)}</ul>
      </div>
    </nav>
  );
}
