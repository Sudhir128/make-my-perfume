import type { CSSProperties } from 'react';

// Original line-drawn sprig (stem, leaves, two blossoms) for breaking a frame edge.
// Every stroke has pathLength=1 so CSS can draw it with stroke-dashoffset 1 → 0.

export const SPRIG_STROKES = [
  'M18 250C52 196 78 150 98 112c14-27 30-54 58-84',
  'M98 112c18 4 34-2 46-16-16-6-34-3-46 16Z',
  'M80 150c-20-2-34-14-40-30 18 0 33 11 40 30Z',
  'M62 184c16-6 30-2 40 10-16 6-31 2-40-10Z',
  'M126 64c-4-16 2-30 14-40 4 16-2 30-14 40Z',
  'M156 28c10-10 26-12 38-6-8 12-24 16-38 6Z',
  'M160 17c-2-6 0-11 4-14M151 24c-6 0-10-3-12-7M169 28c6 1 10 5 11 10',
  'M44 105c0-5 2-9 6-11M38 114c-5 1-9-1-11-5',
];

export function Botanical({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 260" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {SPRIG_STROKES.map((d, i) => (
        <path key={i} d={d} pathLength={1} style={{ '--s': i } as CSSProperties} />
      ))}
      <circle cx="160" cy="26" r="9" pathLength={1} style={{ '--s': 6 } as CSSProperties} />
      <circle cx="44" cy="112" r="7" pathLength={1} style={{ '--s': 7 } as CSSProperties} />
    </svg>
  );
}
