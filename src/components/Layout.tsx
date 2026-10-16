import { useEffect } from 'react';
import { Outlet, useLocation, useNavigation } from 'react-router';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { Toast } from './Toast';
import styles from './Layout.module.css';

export function Layout() {
  const navigating = useNavigation().state === 'loading';
  const { pathname } = useLocation();

  // New page: start at the top (native scroll, no smoothing).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={`${styles.shell} grain`}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className={styles.main} tabIndex={-1} aria-busy={navigating || undefined}>
        <Outlet />
      </main>
      <SiteFooter />
      <Toast />
    </div>
  );
}
