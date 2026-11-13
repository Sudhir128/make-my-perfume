import { formatINR } from '../lib/format';
import { Tag } from './Tag';
import styles from './Price.module.css';

interface PriceProps {
  amount: number;
  /** provisional: carried over from the legacy site. illustrative: computed sample. */
  kind: 'provisional' | 'illustrative';
  sizeMl?: number;
  compareAt?: number;
  /** Hide the tag when a heading or footnote nearby already states the status. */
  hideTag?: boolean;
  size?: 'md' | 'lg';
}

/** Editorial price: italic display numerals, size in the text face. */
export function Price({ amount, kind, sizeMl, compareAt, hideTag = false, size = 'md' }: PriceProps) {
  const hasSale = compareAt !== undefined && compareAt > amount;
  return (
    <span className={[styles.price, size === 'lg' ? styles.lg : ''].join(' ')}>
      <span className={`${styles.amount} tabular`}>{formatINR(amount)}</span>
      {hasSale && (
        <s className={`${styles.compare} tabular`}>
          <span className="visually-hidden">Was </span>
          {formatINR(compareAt!)}
        </s>
      )}
      {sizeMl !== undefined && <span className={styles.size}>{sizeMl} ml</span>}
      {!hideTag && <Tag kind={kind} />}
    </span>
  );
}
