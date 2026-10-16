import { describe, expect, it } from 'vitest';
import tokensCss from '../styles/tokens.css?raw';
import { contrastRatio, parseColor, readHexTokens } from './contrast';

const tokens = readHexTokens(tokensCss);
const rgb = (name: string) => {
  const hex = tokens[name];
  if (!hex) throw new Error(`token ${name} not found in tokens.css`);
  return parseColor(hex)!;
};

// Every foreground/background pairing the components actually use.
// min: 4.5 body text, 3 for focus rings and control boundaries.
const PAIRS: Array<[fg: string, bg: string, min: number, where: string]> = [
  // Light grounds
  ['--c-ink-dark', '--c-parchment', 4.5, 'text on page'],
  ['--c-ink-dark', '--c-band', 4.5, 'text on alternate band'],
  ['--c-ink-dark', '--c-paper', 4.5, 'text on cards and inputs'],
  ['--c-ink-dark-soft', '--c-parchment', 4.5, 'muted text on page'],
  ['--c-ink-dark-soft', '--c-band', 4.5, 'muted text on band'],
  ['--c-ink-dark-soft', '--c-paper', 4.5, 'muted text on cards'],
  ['--c-gold-text', '--c-parchment', 4.5, 'eyebrows, links, prices on page'],
  ['--c-gold-text', '--c-band', 4.5, 'eyebrows and links on band'],
  ['--c-gold-text', '--c-paper', 4.5, 'links on cards'],
  ['--c-paper', '--c-ink-dark', 4.5, 'primary pill label'],
  ['--c-ink-dark', '--c-parchment', 3, 'focus ring on page'],
  ['--c-ink-dark', '--c-band', 3, 'focus ring on band'],
  ['--c-ink-dark', '--c-paper', 3, 'focus ring on cards'],
  ['--c-ink-dark-soft', '--c-paper', 3, 'input boundary'],
  ['--c-error', '--c-paper', 4.5, 'form error text'],
  ['--c-error', '--c-paper', 3, 'invalid input boundary'],
  // Noir bands
  ['--c-ivory', '--c-noir', 4.5, 'text on noir'],
  ['--c-ivory', '--c-noir-raised', 4.5, 'text on raised noir'],
  ['--c-ivory-soft', '--c-noir', 4.5, 'muted text on noir'],
  ['--c-ivory-soft', '--c-noir-raised', 4.5, 'muted text on raised noir'],
  ['--c-gold-on-noir', '--c-noir', 4.5, 'gold text on noir'],
  ['--c-gold-on-noir', '--c-noir-raised', 4.5, 'gold text on raised noir'],
  ['--c-noir', '--c-gold-on-noir', 4.5, 'gold pill label on noir'],
  ['--c-gold-on-noir', '--c-noir', 3, 'focus ring on noir'],
];

describe('token contrast', () => {
  it.each(PAIRS)('%s on %s meets %s:1 (%s)', (fg, bg, min) => {
    expect(contrastRatio(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(min);
  });

  it('keeps decorative gold out of text use on light grounds', () => {
    // Documented: this pairing is too weak for text and is reserved for lines and glyphs.
    expect(contrastRatio(rgb('--c-gold-decor'), rgb('--c-parchment'))).toBeLessThan(3);
  });

  it('matches the WCAG reference values', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 2);
  });

  it('parses computed-style colours', () => {
    expect(parseColor('rgb(213, 163, 93)')).toEqual([213, 163, 93]);
    expect(parseColor('rgba(11, 10, 9, 0.5)')).toEqual([11, 10, 9]);
  });
});
