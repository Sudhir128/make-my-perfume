import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { useBag } from '../store/bag';
import { itemCount } from '../lib/pricing';
import { SealMark } from './SealMark';
import { SearchOverlay } from './SearchOverlay';
import styles from './SiteHeader.module.css';

/** Target primary navigation requested by owner. */
export const NAV = [
  { to: '/collection', label: 'Shop All Perfumes' },
  { to: '/collection?audience=men', label: 'Men' },
  { to: '/collection?audience=women', label: 'Women' },
  { to: '/collection?audience=unisex', label: 'Unisex' },
  { to: '/collection?type=inspired', label: 'Inspired Fragrances' },
  { to: '/make', label: 'Create Your Perfume', highlight: true },
  { to: '/collection?type=bundle', label: 'Gifting & Combos' },
] as const;

/** Active only on an exact path + category query match, so /collection links stay distinct. */
function useIsCurrent() {
  const { pathname, search } = useLocation();
  return (to: string) => {
    const [path, query = ''] = to.split('?');
    if (path !== pathname) return false;
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(search);
    if (path === '/collection') {
      const wantAudience = want.get('audience') ?? '';
      const wantType = want.get('type') ?? '';
      const wantCol = want.get('collection') ?? '';
      const haveAudience = have.get('audience') ?? '';
      const haveType = have.get('type') ?? '';
      const haveCol = have.get('collection') ?? '';
      return wantAudience === haveAudience && wantType === haveType && wantCol === haveCol;
    }
    return true;
  };
}

function CategoryNav({ label }: { label: string }) {
  const isCurrent = useIsCurrent();
  return (
    <nav className={styles.categories} aria-label={label}>
      <ul>
        {NAV.map((n) => (
          <li key={n.to}>
            <Link
              to={n.to}
              className={[('highlight' in n && n.highlight) ? styles.highlight : '', isCurrent(n.to) ? styles.active : ''].filter(Boolean).join(' ') || undefined}
              aria-current={isCurrent(n.to) ? 'page' : undefined}
            >
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ProfileLink() {
  return (
    <Link to="/profile" className={styles.iconLink} aria-label="Profile">
      <UserRound size={19} strokeWidth={1.5} aria-hidden="true" />
    </Link>
  );
}

function SearchForm({
  id,
  onDone,
  onOpenOverlay,
}: {
  id: string;
  onDone?: () => void;
  onOpenOverlay?: (initialQ: string) => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (onOpenOverlay) {
      onOpenOverlay(term);
    } else {
      navigate(term ? `/collection?q=${encodeURIComponent(term)}` : '/collection');
    }
    onDone?.();
  };
  return (
    <form role="search" className={styles.search} onSubmit={submit} action="/collection">
      <label htmlFor={id} className="visually-hidden">
        Search fragrances
      </label>
      <Search className={styles.searchIcon} size={16} strokeWidth={1.5} aria-hidden="true" />
      <input
        id={id}
        name="q"
        type="search"
        placeholder="Search by name or note"
        autoComplete="off"
        value={q}
        onFocus={() => {
          if (onOpenOverlay) onOpenOverlay(q);
        }}
        onClick={() => {
          if (onOpenOverlay) onOpenOverlay(q);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          if (onOpenOverlay) onOpenOverlay(e.target.value);
        }}
      />
    </form>
  );
}

function BagLink() {
  const count = useBag((s) => itemCount(s.lines));
  return (
    // Visible text is part of the accessible name ("Bag 2 items"), so voice users can say what they see.
    <Link to="/bag" className={styles.bag}>
      <ShoppingBag size={17} strokeWidth={1.5} aria-hidden="true" />
      <span>Bag</span>{' '}
      <span className={`${styles.count} tabular`}>{count}</span>{' '}
      <span className="visually-hidden">{count === 1 ? 'item' : 'items'}</span>
    </Link>
  );
}

export function SiteHeader() {
  const dialog = useRef<HTMLDialogElement>(null);
  const header = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Compact bar once the full header has scrolled out of view (one observer).
  const [compact, setCompact] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const el = header.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry?.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Close the menu whenever the route changes.
  useEffect(() => {
    if (typeof dialog.current?.close === 'function') {
      dialog.current.close();
    }
  }, [location.pathname, location.search]);

  return (
    <header ref={header} className={styles.header}>
      {/* Only one set of controls is ever operable: the full header goes inert while the compact bar shows. */}
      <div className={styles.full} inert={compact || undefined} aria-hidden={compact || undefined}>
        <div className={styles.inner}>
          <div className={styles.lead}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => dialog.current?.showModal()}
            >
              <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <Link to="/" className={styles.brand} aria-label="Make My Perfume, home">
            <SealMark size="sm" decorative />
            <span className={styles.wordmark} aria-hidden="true">
              Make My Perfume
            </span>
          </Link>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconLink}
              aria-label="Search fragrances"
              onClick={() => {
                setSearchQuery('');
                setSearchOpen(true);
              }}
            >
              <Search size={19} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <ProfileLink />
            <BagLink />
          </div>
        </div>
        <div className={styles.categoryRow}>
          <CategoryNav label="Categories" />
        </div>
      </div>

      <div className={styles.compactBar} data-visible={compact || undefined} inert={!compact || undefined} aria-hidden={!compact || undefined}>
        <div className={styles.compactInner}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => dialog.current?.showModal()}
          >
            <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <Link to="/" className={styles.compactBrand} aria-label="Make My Perfume, home">
            <SealMark size="sm" decorative />
          </Link>
          <div className={styles.compactActions}>
            <button
              type="button"
              className={styles.iconLink}
              aria-label="Search fragrances"
              onClick={() => {
                setSearchQuery('');
                setSearchOpen(true);
              }}
            >
              <Search size={19} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <ProfileLink />
            <BagLink />
          </div>
        </div>
      </div>

      <dialog
        ref={dialog}
        id="site-menu"
        className={styles.sheet}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        // The dialog only opens through showModal(); mirror its state for aria-expanded.
        onToggle={(e) => setOpen((e.currentTarget as HTMLDialogElement).open)}
      >
        <div className={styles.sheetTop}>
          <SealMark size="sm" decorative />
          <button type="button" className={styles.close} aria-label="Close menu" onClick={() => dialog.current?.close()}>
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Menu">
          <ul className={styles.sheetNav}>
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className={('highlight' in n && n.highlight) ? styles.highlight : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <NavLink to="/profile">Profile</NavLink>
            </li>
          </ul>
        </nav>
        <SearchForm
          id="menu-search"
          onDone={() => dialog.current?.close()}
          onOpenOverlay={(q) => {
            dialog.current?.close();
            setSearchQuery(q);
            setSearchOpen(true);
          }}
        />
      </dialog>

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialQuery={searchQuery}
      />
    </header>
  );
}
