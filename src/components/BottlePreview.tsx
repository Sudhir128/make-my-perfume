import type { CSSProperties } from 'react';
import { paletteFor } from '../lib/palettes';
import styles from './BottlePreview.module.css';

interface BottlePreviewProps {
  /** Name printed on the label. Empty shows a placeholder line. */
  name?: string;
  /** Generic house lettering instead of a personal name (narrative stages). */
  house?: boolean;
  /** Ritual: the cap is off and the atomizer shows. */
  capOff?: boolean;
  /** Family whose colour lights the bottle (rim light and pooled glow). */
  accent?: string;
  className?: string;
}

/**
 * Stylised illustration of the house matte-black bottle (posters used as
 * reference only), with generic illustrative lettering or a live name. Always
 * decorative: anything it shows is also present as real text elsewhere.
 */
export function BottlePreview({ name = '', house = false, capOff = false, accent, className }: BottlePreviewProps) {
  const label = name.trim();
  const [, mid, deep] = accent ? paletteFor(accent) : [null, 'transparent', 'transparent'];
  const vars = accent ? ({ '--mid': mid, '--deep': deep } as CSSProperties) : undefined;
  return (
    <div
      className={[styles.wrap, accent ? styles.lit : '', className].filter(Boolean).join(' ')}
      style={vars}
      data-accent={accent}
      aria-hidden="true"
    >
      <span className={styles.glow} />
      {capOff ? (
        <div className={styles.atomizer}>
          <span className={styles.nozzle} />
          <span className={styles.stem} />
        </div>
      ) : (
        <div className={styles.cap} />
      )}
      <div className={styles.collar} />
      <div className={styles.body}>
        <div className={styles.label}>
          <span className={styles.house}>Make My Perfume</span>
          {house ? (
            <span className={styles.name}>Signature</span>
          ) : (
            <span className={label ? styles.name : `${styles.name} ${styles.placeholder}`}>{label || 'Your name'}</span>
          )}
          <span className={styles.rule} />
          {!house && <span className={styles.meta}>Personal blend</span>}
        </div>
      </div>
      <div className={styles.shadow} />
    </div>
  );
}
