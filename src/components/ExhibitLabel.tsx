import { TIERS, type Product } from '../data/catalog';
import { Price } from './Price';
import styles from './ExhibitLabel.module.css';

const TIER_NAME = { top: 'Top', heart: 'Heart', base: 'Base' } as const;

interface ExhibitLabelProps {
  product: Product;
  headingLevel?: 'h2' | 'h3';
}

/**
 * The museum label: one schema for every exhibit, facts from data only.
 * Ivory ground, so it uses the ivory inks.
 */
export function ExhibitLabel({ product, headingLevel: Heading = 'h3' }: ExhibitLabelProps) {
  return (
    <article className={styles.label} aria-labelledby={`label-${product.slug}`}>
      <p className={styles.collection}>{product.collection}</p>
      <Heading id={`label-${product.slug}`} className={styles.name}>
        {product.name}
      </Heading>
      <p className={styles.tagline}>{product.tagline}</p>
      <dl className={styles.notes}>
        {TIERS.map((tier) => (
          <div key={tier} className={styles.row}>
            <dt>{TIER_NAME[tier]}</dt>
            <dd>{product.notes[tier].join(', ')}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.foot}>
        <Price amount={product.price} sizeMl={product.sizeMl} kind="provisional" hideTag />
      </div>
    </article>
  );
}
