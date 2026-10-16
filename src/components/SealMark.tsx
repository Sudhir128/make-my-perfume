import seal160 from '../assets/brand/seal-160.webp';
import seal320 from '../assets/brand/seal-320.webp';
import seal640 from '../assets/brand/seal-640.webp';
import styles from './SealMark.module.css';

const SIZES = { sm: 40, md: 88, lg: 200 } as const;

interface SealMarkProps {
  size?: keyof typeof SIZES;
  /** Set when a visible name sits next to the seal, so it is not announced twice. */
  decorative?: boolean;
  className?: string;
}

/**
 * The supplied seal. The source is a square with a black ground and no alpha,
 * so it sits in a circular clip, enlarged just enough that the clip falls on
 * the black rim outside the gold ring. Works on light and noir grounds.
 */
export function SealMark({ size = 'md', decorative = false, className }: SealMarkProps) {
  const px = SIZES[size];
  return (
    <span className={[styles.clip, className].filter(Boolean).join(' ')} style={{ width: px, height: px }}>
      <img
        className={styles.seal}
        src={seal320}
        srcSet={`${seal160} 160w, ${seal320} 320w, ${seal640} 640w`}
        sizes={`${px}px`}
        width={px}
        height={px}
        alt={decorative ? '' : 'Make My Perfume'}
        decoding="async"
      />
    </span>
  );
}
