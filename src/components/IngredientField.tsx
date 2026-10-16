import type { CSSProperties } from 'react';
import { NoteGlyph } from './NoteGlyph';
import styles from './IngredientField.module.css';

// Line-drawn ingredients around the vessel (stage 1). Drawn from the existing
// family glyphs, so the art stays in one hand. Decorative only.
const ITEMS: Array<{ family: string; x: string; y: string; size: number; turn: number; depth: number }> = [
  { family: 'Fresh', x: '-6%', y: '50%', size: 60, turn: -14, depth: 1 },
  { family: 'Woody', x: '80%', y: '12%', size: 58, turn: 10, depth: 0.6 },
  { family: 'Floral', x: '86%', y: '58%', size: 70, turn: -8, depth: 1 },
  { family: 'Sweet', x: '8%', y: '80%', size: 48, turn: 18, depth: 0.6 },
  { family: 'Aquatic', x: '74%', y: '86%', size: 46, turn: 0, depth: 0.4 },
];

export function IngredientField({ className }: { className?: string }) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')} aria-hidden="true">
      {ITEMS.map((it) => (
        <span
          key={it.family}
          className={styles.item}
          style={{ left: it.x, top: it.y, '--turn': `${it.turn}deg`, '--depth': it.depth } as CSSProperties}
        >
          <NoteGlyph family={it.family} size={it.size} />
        </span>
      ))}
    </div>
  );
}
