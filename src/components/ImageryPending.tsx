import type { CSSProperties } from 'react';
import { paletteFor } from '../lib/palettes';
import styles from './ImageryPending.module.css';

interface ImageryPendingProps {
  /** What the photograph will show, e.g. a product name. */
  subject: string;
  /** Scent family; selects the material palette. */
  family?: string;
  shape?: 'flask' | 'shoulder' | 'frame';
  /** CSS aspect-ratio of the art. */
  ratio?: string;
  /**
   * How the liquid arrives: `load` decants once when the page opens (hero),
   * `reveal` decants when an ancestor `[data-reveal]` is revealed (cards).
   */
  fill?: 'static' | 'load' | 'reveal';
  className?: string;
}

/**
 * Original CSS material art standing in for photography we do not have.
 * Abstract glass-and-liquid art in the family's colours; never a product photo.
 */
export function ImageryPending({ subject, family = 'Warm', shape = 'frame', ratio = '4 / 5', fill = 'static', className }: ImageryPendingProps) {
  const [glow, mid, deep] = paletteFor(family);
  const vars = { '--glow': glow, '--mid': mid, '--deep': deep, aspectRatio: ratio } as CSSProperties;
  const mask = shape === 'flask' ? 'flask-mask' : shape === 'shoulder' ? 'shoulder-mask' : styles.framed;
  const fillClass = fill === 'load' ? styles.fillLoad : fill === 'reveal' ? styles.fillReveal : '';
  return (
    <figure className={[styles.plate, fillClass, className].filter(Boolean).join(' ')} role="img" aria-label={`${subject}, artwork`}>
      {/* Glass partly filled with the family's colour, with rising bubbles: the flask of the seal. */}
      <div className={`${styles.art} ${mask}`} style={vars}>
        <span className={styles.liquid}>
          <span className={styles.bubble} />
          <span className={styles.bubble} />
          <span className={styles.bubble} />
          <span className={styles.bubble} />
        </span>
        <span className={styles.streak} />
      </div>
    </figure>
  );
}
