import type { ReactNode } from 'react';
import styles from './Tag.module.css';

/**
 * Honesty labels. Every simulated or unconfirmed thing on the site carries one.
 * Colours follow the surrounding ground (light or noir) through tokens.
 */
export const TAG_TEXT = {
  carried: 'Carried over · pending confirmation',
  provisional: 'Provisional price',
  sample: 'Sample',
  illustrative: 'Illustrative price',
  prototype: 'Prototype',
  pending: 'Imagery pending',
} as const;

interface TagProps {
  kind: keyof typeof TAG_TEXT;
  /** Opaque paper chip, for placing over artwork. */
  solid?: boolean;
  children?: ReactNode;
}

export function Tag({ kind, solid = false, children }: TagProps) {
  return (
    <span className={[styles.tag, solid ? styles.solid : ''].join(' ')} data-tag={kind}>
      {children ?? TAG_TEXT[kind]}
    </span>
  );
}
