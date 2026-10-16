import { formatINR } from '../lib/format';
import { Tag } from './Tag';
import styles from './Price.module.css';

interface PriceProps {
  amount: number;
  /** provisional: carried over from the legacy site. illustrative: computed sample. */
  kind: 'provisional' | 'illustrative';
  sizeMl?: number;
  /** Hide the tag when a heading or footnote nearby already states the status. */
  hideTag?: boolean;
  size?: 'md' | 'lg';
}

/** Editorial price: italic display numerals, size in the text face. */
export function Price({ amount, kind, sizeMl, hideTag = false, size = 'md' }: PriceProps) {
  return (
    <span className={[styles.price, size === 'lg' ? styles.lg : ''].join(' ')}>
      <span className={`${styles.amount} tabular`}>{formatINR(amount)}</span>
      {sizeMl !== undefined && <span className={styles.size}>{sizeMl} ml</span>}
      {!hideTag && <Tag kind={kind} />}
    </span>
  );
}
