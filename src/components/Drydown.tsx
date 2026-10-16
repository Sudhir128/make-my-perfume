import { useId, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { TIERS, type Product, type Tier } from '../data/catalog';
import { paletteFor } from '../lib/palettes';
import { useMedia, useScrollProgress } from '../scroll/useScrollProgress';
import { NoteGlyph } from './NoteGlyph';
import styles from './Drydown.module.css';

const TIME: Record<Tier, { when: string; tier: string }> = {
  top: { when: 'The first minutes', tier: 'Top notes' },
  heart: { when: 'The first hours', tier: 'Heart notes' },
  base: { when: 'What stays', tier: 'Base notes' },
};

/**
 * The signature section. A paper smelling strip moves through a day on skin:
 * top notes lift and fade, the heart blooms, the base settles and stays. A
 * single time rail fills continuously with native scroll. Scroll-linked only
 * where it helps (wide, tall viewports with motion allowed); elsewhere all
 * three layers are laid out at once, with the rail full.
 */
export function Drydown({ products }: { products: readonly Product[] }) {
  const section = useRef<HTMLElement>(null);
  const [slug, setSlug] = useState(products[0]?.slug ?? '');
  const product = products.find((p) => p.slug === slug) ?? products[0]!;
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const roomy = useMedia('(min-width: 900px) and (min-height: 620px)');
  const linked = roomy && !reduced;
  const step = useScrollProgress(section, { mode: 'pinned', steps: 3, enabled: linked });
  const groupId = useId();
  const [glow, mid, deep] = paletteFor(product.collection);
  // Registered as <color> in motion.css, so a new scent cross-fades.
  const vars = { '--glow': glow, '--mid': mid, '--deep': deep } as CSSProperties;

  const stateOf = (i: number) => (!linked ? 'shown' : i < step ? 'past' : i === step ? 'active' : 'future');

  return (
    <section
      ref={section}
      className={`${styles.drydown} noir`}
      data-mode={linked ? 'linked' : 'static'}
      aria-labelledby="drydown-title"
    >
      <div className={styles.stage}>
        <div className={`${styles.layout} page-width`}>
          <div className={styles.copy}>
            <p className="eyebrow eyebrow--lead">The drydown</p>
            <h2 id="drydown-title" className={styles.title}>
              Perfume is not one smell. <em>It is time.</em>
            </h2>
            <p className={styles.lede}>
              Every scent unfolds in three layers. Choose one and follow it from the first minutes to what stays on
              skin.
            </p>
            <fieldset className={styles.chooser}>
              <legend className={styles.legend}>Choose a scent</legend>
              <div className={styles.chips}>
                {products.map((p) => (
                  <label key={p.slug} className={styles.chip}>
                    <input
                      type="radio"
                      name={groupId}
                      value={p.slug}
                      checked={p.slug === product.slug}
                      onChange={() => setSlug(p.slug)}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Link to={`/product/${product.slug}`} className={styles.more}>
              About {product.name}
            </Link>
          </div>

          <div className={styles.visual} style={vars}>
            <div className={styles.strip} aria-hidden="true">
              <span className={`${styles.stain} ${styles.stainBase}`} />
              <span className={`${styles.stain} ${styles.stainHeart}`} />
              <span className={`${styles.stain} ${styles.stainTop}`} />
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={styles.mote} style={{ '--i': i } as CSSProperties} />
              ))}
              <span key={product.slug} className={styles.stripLabel}>
                <NoteGlyph family={product.collection} size={14} />
                {product.name}
              </span>
            </div>
            <div className={styles.timeline}>
              <span className={styles.rail} aria-hidden="true">
                <span className={styles.railFill} />
                <span className={styles.railMarker}>
                  <span />
                </span>
              </span>
              {/* Keyed by scent so a new choice fades in rather than snapping. */}
              <ol key={product.slug} className={styles.tiers} aria-label={`${product.name}, from first spray to drydown`}>
                {TIERS.map((tier, i) => (
                  <li key={tier} className={styles.tier} data-state={stateOf(i)}>
                    <p className={styles.when}>{TIME[tier].when}</p>
                    <p className={styles.tierName}>{TIME[tier].tier}</p>
                    <p className={styles.notes}>{product.notes[tier].join(', ')}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
