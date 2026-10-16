import { useEffect, useState, type ReactNode } from 'react';
import { getProductBySlug, getProducts } from '../data/catalog';
import { contrastRatio, parseColor } from '../lib/contrast';
import { BottlePreview } from '../components/BottlePreview';
import { Button, ButtonLink } from '../components/Button';
import { ExhibitLabel } from '../components/ExhibitLabel';
import { ImageryPending } from '../components/ImageryPending';
import { NoteGlyph } from '../components/NoteGlyph';
import { Price } from '../components/Price';
import { ProductCard } from '../components/ProductCard';
import { SealMark } from '../components/SealMark';
import { Tag } from '../components/Tag';
import styles from './Foundation.module.css';

const SWATCHES: Array<{ token: string; role: string; on: string }> = [
  { token: '--c-parchment', role: 'Parchment', on: '--c-ink-dark' },
  { token: '--c-band', role: 'Band', on: '--c-ink-dark' },
  { token: '--c-paper', role: 'Paper', on: '--c-ink-dark' },
  { token: '--c-ink-dark', role: 'Ink', on: '--c-paper' },
  { token: '--c-gold-text', role: 'Deep gold (text)', on: '--c-paper' },
  { token: '--c-gold-decor', role: 'Gold (decor only)', on: '--c-ink-dark' },
  { token: '--c-noir', role: 'Noir', on: '--c-ivory' },
  { token: '--c-gold-on-noir', role: 'Gold on noir', on: '--c-noir' },
];

const PAIRS: Array<[fg: string, bg: string, label: string]> = [
  ['--c-ink-dark', '--c-parchment', 'Ink on parchment'],
  ['--c-ink-dark-soft', '--c-parchment', 'Muted on parchment'],
  ['--c-ink-dark-soft', '--c-band', 'Muted on band'],
  ['--c-gold-text', '--c-parchment', 'Deep gold on parchment'],
  ['--c-gold-text', '--c-band', 'Deep gold on band'],
  ['--c-paper', '--c-ink-dark', 'Pill label on ink'],
  ['--c-ivory-soft', '--c-noir', 'Muted on noir'],
  ['--c-gold-on-noir', '--c-noir', 'Gold on noir'],
  ['--c-gold-decor', '--c-parchment', 'Decor gold on parchment (never text)'],
];

const TOKEN_NAMES = [...new Set([...SWATCHES.flatMap((s) => [s.token, s.on]), ...PAIRS.flatMap(([f, b]) => [f, b])])];

function useTokens() {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    setValues(Object.fromEntries(TOKEN_NAMES.map((n) => [n, css.getPropertyValue(n).trim()])));
  }, []);
  return values;
}

const ratio = (v: Record<string, string>, fg: string, bg: string) => {
  const a = parseColor(v[fg] ?? '');
  const b = parseColor(v[bg] ?? '');
  return a && b ? contrastRatio(a, b) : null;
};

function Section({ id, title, children, noir = false }: { id: string; title: string; children: ReactNode; noir?: boolean }) {
  return (
    <section className={`${styles.section} ${noir ? 'noir' : ''}`} aria-labelledby={id}>
      <div className="page-width">
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        <div className={styles.sectionBody}>{children}</div>
      </div>
    </section>
  );
}

export default function Foundation() {
  const tokens = useTokens();
  const product = getProductBySlug('nocturne') ?? getProducts()[0]!;
  const families = [...new Set(getProducts().map((p) => p.collection))];

  return (
    <div className={styles.page}>
      <header className={`${styles.intro} page-width`}>
        <p className="eyebrow eyebrow--lead">Atelier · design foundation</p>
        <h1 className={styles.title}>
          Design <em>foundation</em>
        </h1>
        <p className={styles.lede}>Tokens, type, materials and components. Contrast figures are measured live from the stylesheet.</p>
      </header>

      <Section id="f-colour" title="Colour">
        <ul className={styles.swatches}>
          {SWATCHES.map((s) => {
            const r = ratio(tokens, s.on, s.token);
            return (
              <li key={s.token} className={styles.swatch}>
                <span className={styles.chip} style={{ background: `var(${s.token})`, color: `var(${s.on})` }}>
                  Aa
                </span>
                <span className={styles.swatchRole}>{s.role}</span>
                <code className={styles.code}>{tokens[s.token]}</code>
                {r && <span className="tabular">{r.toFixed(2)}:1 with its text</span>}
              </li>
            );
          })}
        </ul>
        <table className={styles.table}>
          <caption className="visually-hidden">Measured contrast of text pairs</caption>
          <thead>
            <tr>
              <th scope="col">Pair</th>
              <th scope="col">Ratio</th>
              <th scope="col">Body text (4.5:1)</th>
            </tr>
          </thead>
          <tbody>
            {PAIRS.map(([fg, bg, label]) => {
              const r = ratio(tokens, fg, bg);
              return (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td className="tabular">{r ? `${r.toFixed(2)}:1` : 'measuring'}</td>
                  <td>{r === null ? '' : r >= 4.5 ? 'Pass' : 'Decor only'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section id="f-type" title="Type">
        <p className={styles.t4}>
          YOUR SCENT. <em>Your signature.</em>
        </p>
        <p className={styles.t3}>
          Made for the <em>in-between.</em>
        </p>
        <p className={styles.t2}>Warmth that stays.</p>
        <p className={styles.body}>
          Jost carries prose and interface at a comfortable measure. Cormorant Garamond carries display type, with
          true italics for emphasis inside a headline rather than a second typeface.
        </p>
        <p className="eyebrow">Two moods. One signature.</p>
      </Section>

      <Section id="f-glyphs" title="Family glyphs and materials">
        <ul className={styles.glyphs}>
          {families.map((f) => (
            <li key={f} className={styles.glyph}>
              <div className={styles.glyphArt}>
                <ImageryPending subject={`${f} material study`} family={f} shape="shoulder" ratio="4 / 5" />
              </div>
              <span className={styles.glyphName}>
                <NoteGlyph family={f} /> {f}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="f-components" title="Components, light ground">
        <div className={styles.row}>
          <SealMark size="sm" />
          <SealMark size="md" />
          <Button>Shop the collection</Button>
          <Button variant="ghost">View the collection</Button>
          <ButtonLink to="/" variant="quiet" arrow>
            Make yours
          </ButtonLink>
          <Button disabled>Disabled</Button>
        </div>
        <div className={styles.row}>
          <Tag kind="carried" />
          <Tag kind="provisional" />
          <Tag kind="illustrative" />
          <Tag kind="pending" />
          <Price amount={product.price} sizeMl={product.sizeMl} kind="provisional" />
        </div>
        <div className={styles.cards}>
          <ProductCard product={product} />
          <ExhibitLabel product={product} />
          <BottlePreview name="Ananya" />
        </div>
      </Section>

      <Section id="f-noir" title="Components, noir band" noir>
        <div className={styles.row}>
          <Button>Start your blend</Button>
          <Button variant="ghost">Outline</Button>
          <ButtonLink to="/" variant="quiet" arrow>
            Text link
          </ButtonLink>
          <Tag kind="illustrative" />
          <Price amount={2450} kind="illustrative" />
        </div>
      </Section>
    </div>
  );
}
