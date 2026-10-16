import type { CSSProperties } from 'react';
import { paletteFor } from '../lib/palettes';
import styles from './Accord.module.css';

/**
 * The liquid accord (stage 2, Still tier): a suspended body of liquid in the
 * colours of one family. Colours are registered properties, so a new family
 * cross-fades. Decorative; the family name is announced by the links.
 */
export function Accord({ family, className }: { family: string; className?: string }) {
  const [glow, mid, deep] = paletteFor(family);
  return (
    <div
      className={[styles.accord, className].filter(Boolean).join(' ')}
      style={{ '--glow': glow, '--mid': mid, '--deep': deep } as CSSProperties}
      data-family={family}
      aria-hidden="true"
    >
      <span className={styles.orbit} />
      <span className={styles.body} />
      <span className={styles.shine} />
      <span className={styles.drop} />
      <span className={styles.shadow} />
    </div>
  );
}
