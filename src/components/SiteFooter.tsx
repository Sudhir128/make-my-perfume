import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { SealMark } from './SealMark';
import styles from './SiteFooter.module.css';

// Footer contents carried over from the previous site, set in the house style.
const COLUMNS: Array<{ title: string; links: Array<{ to: string; label: string }> }> = [
  {
    title: 'Explore',
    links: [
      { to: '/collection', label: 'Shop All' },
      { to: '/collection?family=Fresh', label: 'Fresh' },
      { to: '/collection?family=Woody', label: 'Woody' },
    ],
  },
  {
    title: 'Company Info',
    links: [
      { to: '/about', label: 'About Us' },
      { to: '/careers', label: 'Careers' },
      { to: '/news', label: 'Blogs' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/faqs', label: 'FAQs' },
      { to: '/track-order', label: 'Track Order' },
      { to: '/store-locator', label: 'Store Locator' },
    ],
  },
];

const EMAIL = 'hello@makemyperfume.in';

function Social({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} className={styles.social}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className={`${styles.footer} noir`}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <SealMark size="md" decorative />
          <p className={styles.name}>Make My Perfume</p>
          <p className={styles.line}>Your scent. Your signature.</p>
          <div className={styles.socials}>
            <Social href="https://instagram.com/makemyperfume" label="Instagram">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </Social>
            <Social href="https://youtube.com/@makemyperfume" label="YouTube">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" />
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
            </Social>
            <Social href="https://pinterest.com/makemyperfume" label="Pinterest">
              <path d="M8 12a4 4 0 1 1 8 0c0 4-2 6-4 8" />
              <path d="M12 12l-2 6" />
            </Social>
          </div>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className={styles.column}>
            <p className={styles.heading}>{col.title}</p>
            <ul className={styles.links}>
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={styles.bottom}>
        <span>© 2026 Make My Perfume</span>
        <a href={`mailto:${EMAIL}`} className={styles.email}>
          {EMAIL} <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </a>
        <span>Made in India</span>
      </div>
    </footer>
  );
}
