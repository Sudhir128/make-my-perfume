import { useLocation } from 'react-router';
import { ButtonLink } from '../components/Button';
import { ImageryPending } from '../components/ImageryPending';
import styles from './NotFound.module.css';

// Pages that are linked from the site but not built yet.
const PLANNED = ['/make', '/about', '/contact', '/careers', '/news', '/faqs', '/track-order', '/store-locator'];

export default function NotFound() {
  const { pathname } = useLocation();
  const planned = PLANNED.some((p) => pathname === p || (p.endsWith('/') && pathname.startsWith(p)));

  return (
    <section className={`${styles.wrap} page-width`} aria-labelledby="nf-title">
      <div className={styles.copy}>
        <p className="eyebrow eyebrow--lead">{planned ? 'Coming soon' : 'Not in the collection'}</p>
        <h1 id="nf-title" className={styles.title}>
          {planned ? (
            <>
              This page is <em>on its way.</em>
            </>
          ) : (
            <>
              This page <em>does not exist.</em>
            </>
          )}
        </h1>
        <p className={styles.body}>
          {planned
            ? 'We are still putting this page together. In the meantime, explore the collection.'
            : 'The address may be mistyped, or the page has moved.'}
        </p>
        <div className={styles.actions}>
          <ButtonLink to="/">Return home</ButtonLink>
        </div>
      </div>
      <div className={styles.art}>
        <ImageryPending subject="Abstract material study" family="Woody" shape="flask" ratio="100 / 130" />
      </div>
    </section>
  );
}
