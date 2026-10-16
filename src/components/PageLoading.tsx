import { SealMark } from './SealMark';
import styles from './PageLoading.module.css';

export function PageLoading() {
  return (
    <div className={styles.loading} role="status">
      <SealMark size="md" decorative className={styles.seal} />
      <span className="visually-hidden">Loading</span>
    </div>
  );
}
