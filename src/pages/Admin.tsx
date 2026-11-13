import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  Download,
  ExternalLink,
  FolderTree,
  LogOut,
  Mail,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  adminAddAdmin,
  adminDeleteCategory,
  adminDeleteFragranceType,
  adminDeleteProduct,
  adminListActivityLogs,
  adminListAdmins,
  adminListOrders,
  adminListPersonalisedOrders,
  adminListProducts,
  adminListTaxonomy,
  adminResendInvoice,
  adminResendPersonalisedInvoice,
  adminSaveCategory,
  adminSaveCustomPerfumeSizes,
  adminSaveFragranceType,
  adminSaveProduct,
  adminSaveSale,
  adminUpdateOrder,
  adminUpdatePersonalisedOrder,
  claimInitialAdmin,
  getAdminStatus,
  signInAdmin,
  signOutAdmin,
  signUpAdmin,
  type ActivityLogRow,
  type AdminCategory,
  type AdminFragranceType,
  type AdminOrder,
  type AdminPersonalisedOrder,
  type AdminProduct,
  type AdminStatus,
  type AdminVariant,
} from '../data/admin';
import { getProducts, type AvailabilityStatus } from '../data/catalog';
import { fetchCustomPerfumeSizes, type CustomBottleSizeOption } from '../data/customPerfume';
import { enrichShowcaseProduct } from '../data/showcase';
import { formatINR } from '../lib/format';
import { downloadInvoiceHtml, downloadInvoicePdf, printInvoiceHtml } from '../lib/invoice';
import { uploadProductImage } from '../lib/storage';
import { useToast } from '../store/toast';
import { Button } from '../components/Button';
import styles from './Admin.module.css';

type Tab = 'products' | 'editor' | 'taxonomy' | 'orders' | 'personalised' | 'activity';

interface VariantDraft {
  id?: string;
  sku: string;
  size_ml: string;
  price_inr: string;
  compare_at_inr: string;
  sale_starts_at: string;
  sale_ends_at: string;
  quantity: string;
  availability: AvailabilityStatus;
  is_active: boolean;
}

interface ProductEditorState {
  id?: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  topNotes: string;
  heartNotes: string;
  baseNotes: string;
  fragrance_type_id: string;
  status: 'draft' | 'in_review' | 'published' | 'archived';
  availability: AvailabilityStatus;
  is_featured: boolean;
  is_trending: boolean;
  is_signature: boolean;
  is_best_seller: boolean;
  popularity_score: string;
  category_slugs: string[];
  scent_families: string[];
  image_url: string;
  image_alt: string;
  variants: VariantDraft[];
}

const EMPTY_EDITOR: ProductEditorState = {
  title: '',
  slug: '',
  tagline: '',
  description: '',
  topNotes: '',
  heartNotes: '',
  baseNotes: '',
  fragrance_type_id: '',
  status: 'published',
  availability: 'in_stock',
  is_featured: false,
  is_trending: false,
  is_signature: false,
  is_best_seller: false,
  popularity_score: '50',
  category_slugs: ['shop-all'],
  scent_families: [],
  image_url: '',
  image_alt: '',
  variants: [
    {
      sku: '',
      size_ml: '50',
      price_inr: '1290',
      compare_at_inr: '',
      sale_starts_at: '',
      sale_ends_at: '',
      quantity: '25',
      availability: 'in_stock',
      is_active: true,
    },
  ],
};

function toEditorState(p: AdminProduct): ProductEditorState {
  return {
    id: p.id,
    title: p.title ?? p.source_title ?? '',
    slug: p.slug ?? '',
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    topNotes: (p.notes?.top ?? []).join(', '),
    heartNotes: (p.notes?.heart ?? []).join(', '),
    baseNotes: (p.notes?.base ?? []).join(', '),
    fragrance_type_id: p.fragrance_type_id ?? '',
    status: p.status,
    availability: p.availability ?? 'in_stock',
    is_featured: Boolean(p.is_featured),
    is_trending: Boolean(p.is_trending),
    is_signature: Boolean(p.is_signature),
    is_best_seller: Boolean(p.is_best_seller),
    popularity_score: String(p.popularity_score ?? 0),
    category_slugs: p.category_slugs?.length ? p.category_slugs : ['shop-all'],
    scent_families: p.scent_families ?? [],
    image_url: p.primary_image?.url ?? '',
    image_alt: p.primary_image?.alt_text ?? '',
    variants: p.variants?.length
      ? p.variants.map((v: AdminVariant) => ({
          id: v.id,
          sku: v.sku,
          size_ml: String(v.size_ml),
          price_inr: String(v.price_inr),
          compare_at_inr: v.compare_at_inr ? String(v.compare_at_inr) : '',
          sale_starts_at: v.sale_starts_at ? v.sale_starts_at.slice(0, 16) : '',
          sale_ends_at: v.sale_ends_at ? v.sale_ends_at.slice(0, 16) : '',
          quantity: v.quantity !== null && v.quantity !== undefined ? String(v.quantity) : '',
          availability: (v.availability === 'unknown' ? p.availability : v.availability) as AvailabilityStatus,
          is_active: v.is_active,
        }))
      : EMPTY_EDITOR.variants,
  };
}

const splitNotes = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const toggleArr = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export default function Admin() {
  const show = useToast((s) => s.show);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [signOutStep, setSignOutStep] = useState<'none' | 'confirm' | 'done'>('none');
  const [signedOutEmail, setSignedOutEmail] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<Tab>('products');
  const [loadingData, setLoadingData] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [fragranceTypes, setFragranceTypes] = useState<AdminFragranceType[]>([]);
  const [scentFamilies, setScentFamilies] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [customOrders, setCustomOrders] = useState<AdminPersonalisedOrder[]>([]);
  const [customSizes, setCustomSizes] = useState<CustomBottleSizeOption[]>([]);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; email: string; role: string; is_active: boolean }>>([]);

  // Products list search & filter
  const [prodFilter, setProdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Product & Sale editor
  const [editor, setEditor] = useState<ProductEditorState>(EMPTY_EDITOR);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await uploadProductImage(file, 'perfumes');
      setEditor((prev) => ({
        ...prev,
        image_url: res.url,
        image_alt: prev.image_alt || `${prev.title || 'Perfume'} bottle`,
      }));
      show(`Image "${file.name}" uploaded to product-images bucket.`);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Taxonomy CRUD forms
  const [ftForm, setFtForm] = useState({ id: '', name: '', slug: '', category_slug: 'shop-all', description: '', sort_order: '10', is_active: true });
  const [catForm, setCatForm] = useState({ id: '', name: '', slug: '', kind: 'type' as 'all' | 'audience' | 'type' | 'landing', filter_value: '', sort_order: '50', is_active: true });
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Activity filter
  const [logActor, setLogActor] = useState<string>('all');

  const refreshStatus = useCallback(async () => {
    setLoadingAuth(true);
    try {
      const st = await getAdminStatus();
      setStatus(st);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to reach Supabase Auth');
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    setLoadingData(true);
    try {
      const [prods, tax, ords, custOrds, custSizes, act, adm] = await Promise.all([
        adminListProducts(),
        adminListTaxonomy(),
        adminListOrders(),
        adminListPersonalisedOrders(),
        fetchCustomPerfumeSizes(),
        adminListActivityLogs(150, logActor === 'all' ? null : logActor),
        adminListAdmins(),
      ]);
      setProducts(prods);
      setCategories(tax.categories);
      setFragranceTypes(tax.fragrance_types);
      setScentFamilies(tax.scent_families);
      setOrders(ords);
      setCustomOrders(custOrds);
      setCustomSizes(custSizes);
      setLogs(act);
      setAdmins(adm);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Failed loading admin data.');
    } finally {
      setLoadingData(false);
    }
  }, [logActor, show]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status?.is_admin) {
      void refreshWorkspace();
    }
  }, [status?.is_admin, refreshWorkspace]);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (authMode === 'signin') {
        await signInAdmin(email, password);
        show('Signed in.');
      } else {
        const res = await signUpAdmin(email, password);
        if (res.needsConfirmation) {
          setAuthError('Check your inbox to confirm your email, then sign in.');
        } else {
          show('Account created & signed in.');
        }
      }
      await refreshStatus();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleClaimAdmin = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await claimInitialAdmin();
      show('Owner admin access granted.');
      await refreshStatus();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not claim admin role.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editor.title.trim()) {
      show('Product title is required.');
      return;
    }
    setSavingProduct(true);
    try {
      await adminSaveProduct({
        id: editor.id ?? null,
        title: editor.title.trim(),
        slug: editor.slug.trim() || null,
        tagline: editor.tagline.trim(),
        description: editor.description.trim(),
        notes: {
          top: splitNotes(editor.topNotes),
          heart: splitNotes(editor.heartNotes),
          base: splitNotes(editor.baseNotes),
        },
        fragrance_type_id: editor.fragrance_type_id || null,
        status: editor.status,
        availability: editor.availability,
        is_featured: editor.is_featured,
        is_trending: editor.is_trending,
        is_signature: editor.is_signature,
        is_best_seller: editor.is_best_seller,
        popularity_score: Number(editor.popularity_score) || 0,
        category_slugs: editor.category_slugs,
        scent_families: editor.scent_families,
        image_url: editor.image_url.trim() || null,
        image_alt: editor.image_alt.trim() || null,
        variants: editor.variants.map((v) => ({
          id: v.id ?? null,
          sku: v.sku.trim().toUpperCase() || null,
          size_ml: Number(v.size_ml) || 50,
          price_inr: Number(v.price_inr) || 990,
          compare_at_inr: v.compare_at_inr ? Number(v.compare_at_inr) : null,
          sale_starts_at: v.sale_starts_at ? new Date(v.sale_starts_at).toISOString() : null,
          sale_ends_at: v.sale_ends_at ? new Date(v.sale_ends_at).toISOString() : null,
          quantity: v.quantity ? Number(v.quantity) : null,
          availability: v.availability,
          is_active: v.is_active,
        })),
      });
      show(`Saved "${editor.title}" (${editor.status}).`);
      setTab('products');
      await refreshWorkspace();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSavingProduct(false);
    }
  };

  const importShowcaseToDb = async () => {
    const legacy = getProducts().map(enrichShowcaseProduct);
    setLoadingData(true);
    try {
      for (const p of legacy) {
        const matchFt = fragranceTypes.find((ft) => ft.slug === p.fragranceTypeSlug);
        await adminSaveProduct({
          product_key: `showcase-${p.slug}`,
          slug: p.slug,
          title: p.name,
          tagline: p.tagline,
          description: p.description,
          notes: p.notes,
          fragrance_type_id: matchFt?.id ?? null,
          status: 'published',
          availability: p.availability ?? 'in_stock',
          is_featured: Boolean(p.isFeatured),
          is_trending: Boolean(p.isTrending),
          is_signature: Boolean(p.isSignature),
          is_best_seller: Boolean(p.isBestSeller),
          popularity_score: p.popularityScore ?? 80,
          category_slugs: p.categorySlugs ?? ['shop-all'],
          scent_families: p.families ?? [p.collection],
          variants: (p.variants ?? []).map((v) => ({
            sku: v.sku,
            size_ml: v.sizeMl,
            price_inr: v.price,
            availability: v.availability ?? 'in_stock',
            quantity: 25,
            is_active: true,
          })),
        });
      }
      show('Imported showcase fragrances into live database catalogue.');
      await refreshWorkspace();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoadingData(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = prodFilter.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.title, p.source_title, p.slug, p.product_key, p.fragrance_type_name, ...p.scent_families]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [products, prodFilter, statusFilter]);

  const metrics = useMemo(() => {
    const published = products.filter((p) => p.status === 'published').length;
    const onSale = products.filter((p) => p.variants?.some((v) => v.compare_at_inr && v.compare_at_inr > v.price_inr)).length;
    const revenue = orders.filter((o) => o.order_status !== 'cancelled').reduce((s, o) => s + Number(o.total_inr), 0);
    return { totalProducts: products.length, published, onSale, totalOrders: orders.length, revenue };
  }, [products, orders]);

  const handleConfirmSignOut = async () => {
    const prevEmail = status?.email ?? '';
    setAuthBusy(true);
    try {
      await signOutAdmin();
      setSignedOutEmail(prevEmail);
      setProducts([]);
      setOrders([]);
      setLogs([]);
      setAdmins([]);
      setStatus({ authenticated: false, is_admin: false, has_any_admin: status?.has_any_admin ?? true, email: null });
      setSignOutStep('done');
    } finally {
      setAuthBusy(false);
    }
  };

  if (loadingAuth) {
    return (
      <main className={styles.shell}>
        <div className={styles.confirmCard}>
          <p className={styles.muted}>Checking admin session...</p>
        </div>
      </main>
    );
  }

  if (signOutStep === 'confirm') {
    return (
      <main className={styles.shell}>
        <div className={styles.confirmCard}>
          <p className={styles.kicker}>Admin Session</p>
          <h1 className={styles.confirmTitle}>Confirm sign out</h1>
          <p className={styles.muted}>
            You are currently signed in as <strong>{status?.email ?? 'Admin'}</strong>. Signing out ends your administrative session on this device.
          </p>
          <div className={styles.authActions}>
            <Button onClick={handleConfirmSignOut} disabled={authBusy}>
              <LogOut size={15} aria-hidden="true" />
              {authBusy ? 'Signing out...' : 'Confirm sign out'}
            </Button>
            <Button variant="ghost" onClick={() => setSignOutStep('none')} disabled={authBusy}>
              Cancel, stay signed in
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (signOutStep === 'done') {
    return (
      <main className={styles.shell}>
        <div className={styles.confirmCard}>
          <div className={styles.confirmBadge}>
            <ShieldCheck size={24} strokeWidth={1.6} aria-hidden="true" />
          </div>
          <p className={styles.kicker}>Signed out</p>
          <h1 className={styles.confirmTitle}>You have signed out</h1>
          <p className={styles.muted}>
            {signedOutEmail
              ? `Your admin session for ${signedOutEmail} has been closed cleanly.`
              : 'Your admin session has been closed cleanly.'}
          </p>
          <div className={styles.authActions}>
            <Button
              onClick={() => {
                setSignOutStep('none');
                void refreshStatus();
              }}
            >
              Sign in again
            </Button>
            <a href="/" className={styles.storeLink}>
              Open website
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (!status?.is_admin) {
    return (
      <main className={styles.shell}>
        <div className={styles.authCard}>
          <p className={styles.kicker}>Make My Perfume &middot; Admin Panel</p>
          <h1 className={styles.confirmTitle}>Admin Sign In</h1>

          {status?.authenticated ? (
            <div className={styles.claimBox}>
              <p className={styles.muted}>
                Signed in as <strong>{status.email}</strong>.
              </p>
              {!status.has_any_admin ? (
                <>
                  <p className={styles.muted}>No owner admin exists in Supabase yet. Claim initial owner access to manage products, sales, categories, orders, and logs.</p>
                  <Button onClick={handleClaimAdmin} disabled={authBusy}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    {authBusy ? 'Activating...' : 'Claim Initial Admin Access'}
                  </Button>
                </>
              ) : (
                <p className={styles.error}>This account does not have admin permission. Sign in with an authorized admin email.</p>
              )}
              <Button variant="ghost" onClick={() => setSignOutStep('confirm')}>
                Sign out
              </Button>
            </div>
          ) : (
            <form className={styles.authForm} onSubmit={handleAuth}>
              <p className={styles.muted}>Sign in with your administrator credentials to manage products, categories, types, orders, and website activity logs.</p>
              <div className={styles.field}>
                <label htmlFor="admin-email">Admin email</label>
                <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className={styles.field}>
                <label htmlFor="admin-password">Password</label>
                <input id="admin-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {authError && <p className={styles.error}>{authError}</p>}
              <div className={styles.authActions}>
                <Button type="submit" disabled={authBusy}>
                  {authBusy ? 'Working...' : authMode === 'signin' ? 'Sign in to Admin' : 'Create Admin Account'}
                </Button>
                {!status?.has_any_admin && (
                  <Button variant="quiet" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
                    {authMode === 'signin' ? 'First-time setup? Register owner account' : 'Already registered? Sign in'}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.workspaceBar}>
        <div>
          <p className={styles.kicker}>Make My Perfume &middot; Internal</p>
          <h1 className={styles.title}>Admin Panel</h1>
        </div>
        <div className={styles.topActions}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.viewSiteLink}
            aria-label="View storefront in a new tab"
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span>View Website</span>
          </a>
          <span className={styles.userPill}>{status.email}</span>
          <Button
            variant="ghost"
            small
            onClick={() => {
              setEditor({ ...EMPTY_EDITOR, fragrance_type_id: fragranceTypes[0]?.id ?? '' });
              setTab('editor');
            }}
          >
            <Plus size={15} aria-hidden="true" /> New Perfume
          </Button>
          <Button variant="ghost" small onClick={() => void refreshWorkspace()} disabled={loadingData}>
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </Button>
          <Button variant="quiet" small onClick={() => setSignOutStep('confirm')}>
            <LogOut size={15} aria-hidden="true" /> Sign out
          </Button>
        </div>
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span>Website DB Products</span>
          <strong className="tabular">{metrics.totalProducts}</strong>
          <small>{metrics.published} published</small>
        </div>
        <div className={styles.kpi}>
          <span>Active Sales</span>
          <strong className="tabular">{metrics.onSale}</strong>
          <small>promotional SKUs</small>
        </div>
        <div className={styles.kpi}>
          <span>Categories &amp; Types</span>
          <strong className="tabular">{categories.length} / {fragranceTypes.length}</strong>
          <small>taxonomy records</small>
        </div>
        <div className={styles.kpi}>
          <span>Orders &amp; Revenue</span>
          <strong className="tabular">{metrics.totalOrders} &middot; {formatINR(metrics.revenue)}</strong>
          <small>COD &amp; UPI placed</small>
        </div>
      </div>

      <nav className={styles.tabs} aria-label="Admin sections">
        <button type="button" className={tab === 'products' ? styles.tabActive : styles.tab} onClick={() => setTab('products')}>
          <Sparkles size={15} aria-hidden="true" /> All Products ({products.length})
        </button>
        <button type="button" className={tab === 'editor' ? styles.tabActive : styles.tab} onClick={() => setTab('editor')}>
          <TagIcon size={15} aria-hidden="true" /> {editor.id ? 'Edit Perfume & Sale' : 'Create Perfume'}
        </button>
        <button type="button" className={tab === 'taxonomy' ? styles.tabActive : styles.tab} onClick={() => setTab('taxonomy')}>
          <FolderTree size={15} aria-hidden="true" /> Categories &amp; Types
        </button>
        <button type="button" className={tab === 'orders' ? styles.tabActive : styles.tab} onClick={() => setTab('orders')}>
          <PackageCheck size={15} aria-hidden="true" /> Orders ({orders.length})
        </button>
        <button type="button" className={tab === 'personalised' ? styles.tabActive : styles.tab} onClick={() => setTab('personalised')}>
          <Sparkles size={15} aria-hidden="true" /> Personalised Perfumes ({customOrders.length})
        </button>
        <button type="button" className={tab === 'activity' ? styles.tabActive : styles.tab} onClick={() => setTab('activity')}>
          <Activity size={15} aria-hidden="true" /> Activity Log ({logs.length})
        </button>
      </nav>

      {/* ── TAB 1: ALL WEBSITE PRODUCTS & QUICK SALES ───────────────────── */}
      {tab === 'products' && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.filtersRow}>
              <input
                type="search"
                placeholder="Filter products, SKU, slug or family..."
                value={prodFilter}
                onChange={(e) => setProdFilter(e.target.value)}
                className={styles.searchInput}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.selectInput}>
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            {products.filter((p) => p.status === 'published').length === 0 && (
              <Button variant="ghost" small onClick={importShowcaseToDb}>
                Publish 6 Showcase Perfumes to DB
              </Button>
            )}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Perfume</th>
                  <th>Status</th>
                  <th>Price &amp; Sale</th>
                  <th>Categories / Type</th>
                  <th>Carousels</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const lead = p.variants?.[0];
                  const hasSale = lead && lead.compare_at_inr && lead.compare_at_inr > lead.price_inr;
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.title || p.source_title || p.product_key}</strong>
                        <div className={styles.sub}>{p.slug ? `/product/${p.slug}` : 'No public slug (draft)'}</div>
                      </td>
                      <td>
                        <span className={styles.pill} data-status={p.status}>
                          {p.status}
                        </span>
                        <div className={styles.sub}>{p.availability.replace(/_/g, ' ')}</div>
                      </td>
                      <td>
                        {lead ? (
                          <div>
                            <strong>{formatINR(lead.price_inr)}</strong> ({lead.size_ml} ml)
                            {hasSale && <div className={styles.sub}>Sale: Was {formatINR(lead.compare_at_inr!)}</div>}
                          </div>
                        ) : (
                          'No variants'
                        )}
                      </td>
                      <td>
                        <div>{p.fragrance_type_name || 'Unassigned'}</div>
                        <div className={styles.sub}>{p.category_slugs.join(', ') || 'No categories'}</div>
                      </td>
                      <td>
                        <div className={styles.flags}>
                          {p.is_trending && <span className={styles.miniTag}>Trending</span>}
                          {p.is_signature && <span className={styles.miniTag}>Signature</span>}
                          {p.is_best_seller && <span className={styles.miniTag}>Best Seller</span>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.rowBtns}>
                          <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={() => {
                              setEditor(toEditorState(p));
                              setTab('editor');
                            }}
                          >
                            Edit
                          </button>
                          {lead && (
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={async () => {
                                const input = window.prompt(
                                  `Set Compare-At MRP (> ${lead.price_inr}) for ${lead.sku} to activate sale, or leave empty to clear sale:`,
                                  lead.compare_at_inr ? String(lead.compare_at_inr) : '',
                                );
                                if (input === null) return;
                                try {
                                  await adminSaveSale({
                                    variantId: lead.id!,
                                    priceInr: Number(lead.price_inr),
                                    compareAtInr: input.trim() ? Number(input.trim()) : null,
                                  });
                                  show('Promotion updated.');
                                  await refreshWorkspace();
                                } catch (err) {
                                  show(err instanceof Error ? err.message : 'Failed updating sale.');
                                }
                              }}
                            >
                              Sale
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            aria-label={`Delete ${p.title || p.product_key}`}
                            onClick={async () => {
                              if (!window.confirm(`Delete or archive "${p.title || p.source_title || p.product_key}"?`)) return;
                              try {
                                await adminDeleteProduct(p.id);
                                show('Product removed.');
                                await refreshWorkspace();
                              } catch (err) {
                                show(err instanceof Error ? err.message : 'Delete failed.');
                              }
                            }}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 2: CREATE / EDIT PRODUCT & SALE EDITOR ──────────────────── */}
      {tab === 'editor' && (
        <section className={styles.panel}>
          <form className={styles.editorForm} onSubmit={handleSaveProduct}>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label htmlFor="ed-title">Perfume Title</label>
                <input id="ed-title" required value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-slug">URL Slug (auto-generated if empty)</label>
                <input id="ed-slug" value={editor.slug} onChange={(e) => setEditor({ ...editor, slug: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-tagline">Tagline</label>
                <input id="ed-tagline" value={editor.tagline} onChange={(e) => setEditor({ ...editor, tagline: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-ft">Fragrance Type</label>
                <select id="ed-ft" value={editor.fragrance_type_id} onChange={(e) => setEditor({ ...editor, fragrance_type_id: e.target.value })}>
                  <option value="">-- Select Type --</option>
                  {fragranceTypes.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.name} {ft.category_slug ? `(${ft.category_slug})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${styles.field} ${styles.wide}`}>
                <label htmlFor="ed-desc">Description</label>
                <textarea id="ed-desc" rows={3} value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-top">Top Notes (comma-separated)</label>
                <input id="ed-top" value={editor.topNotes} onChange={(e) => setEditor({ ...editor, topNotes: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-heart">Heart Notes (comma-separated)</label>
                <input id="ed-heart" value={editor.heartNotes} onChange={(e) => setEditor({ ...editor, heartNotes: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-base">Base Notes (comma-separated)</label>
                <input id="ed-base" value={editor.baseNotes} onChange={(e) => setEditor({ ...editor, baseNotes: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-status">Publication Status</label>
                <select id="ed-status" value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as ProductEditorState['status'] })}>
                  <option value="draft">Draft</option>
                  <option value="in_review">In Review</option>
                  <option value="published">Published (Live on Website)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-avail">Availability</label>
                <select id="ed-avail" value={editor.availability} onChange={(e) => setEditor({ ...editor, availability: e.target.value as AvailabilityStatus })}>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="preorder">Preorder</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-pop">Popularity Score</label>
                <input id="ed-pop" type="number" min={0} value={editor.popularity_score} onChange={(e) => setEditor({ ...editor, popularity_score: e.target.value })} />
              </div>
              <div className={`${styles.field} ${styles.wide}`}>
                <label>Product Photography (Supabase Bucket: product-images)</label>
                <div className={styles.imageUploadArea}>
                  {editor.image_url ? (
                    <div className={styles.imagePreviewRow}>
                      <img src={editor.image_url} alt={editor.image_alt || 'Product preview'} className={styles.imageThumb} />
                      <div className={styles.imageDetails}>
                        <p className={styles.imagePathText}>{editor.image_url}</p>
                        <div className={styles.imageBtns}>
                          <label className={styles.uploadLabel}>
                            <Upload size={14} aria-hidden="true" />
                            <span>{uploadingImage ? 'Uploading...' : 'Replace Image'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingImage}
                              onChange={handleImageFileChange}
                              className="visually-hidden"
                            />
                          </label>
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => setEditor({ ...editor, image_url: '' })}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.dropzone}>
                      <label className={styles.dropzoneLabel}>
                        <Upload size={24} strokeWidth={1.5} className={styles.uploadIcon} aria-hidden="true" />
                        <span className={styles.dropzoneText}>
                          {uploadingImage ? 'Uploading to product-images bucket...' : 'Upload fragrance image'}
                        </span>
                        <span className={styles.dropzoneHint}>Supports PNG, JPG, WebP, AVIF up to 10MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingImage}
                          onChange={handleImageFileChange}
                          className="visually-hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-img">Or External Image URL</label>
                <input id="ed-img" value={editor.image_url} onChange={(e) => setEditor({ ...editor, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className={styles.field}>
                <label htmlFor="ed-alt">Image Alt Text</label>
                <input id="ed-alt" value={editor.image_alt} onChange={(e) => setEditor({ ...editor, image_alt: e.target.value })} />
              </div>
            </div>

            <div className={styles.checkGroups}>
              <fieldset className={styles.checkBox}>
                <legend>Homepage Carousels</legend>
                <label><input type="checkbox" checked={editor.is_trending} onChange={(e) => setEditor({ ...editor, is_trending: e.target.checked })} /> Trending Perfumes</label>
                <label><input type="checkbox" checked={editor.is_signature} onChange={(e) => setEditor({ ...editor, is_signature: e.target.checked })} /> Signature Perfumes</label>
                <label><input type="checkbox" checked={editor.is_best_seller} onChange={(e) => setEditor({ ...editor, is_best_seller: e.target.checked })} /> Best Sellers</label>
                <label><input type="checkbox" checked={editor.is_featured} onChange={(e) => setEditor({ ...editor, is_featured: e.target.checked })} /> Recommended / Featured</label>
              </fieldset>

              <fieldset className={styles.checkBox}>
                <legend>Categories</legend>
                {categories.filter((c) => c.kind !== 'landing').map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={editor.category_slugs.includes(c.slug)}
                      onChange={() => setEditor({ ...editor, category_slugs: toggleArr(editor.category_slugs, c.slug) })}
                    />
                    {c.name}
                  </label>
                ))}
              </fieldset>

              <fieldset className={styles.checkBox}>
                <legend>Scent Families</legend>
                {scentFamilies.map((f) => (
                  <label key={f.id}>
                    <input
                      type="checkbox"
                      checked={editor.scent_families.includes(f.name)}
                      onChange={() => setEditor({ ...editor, scent_families: toggleArr(editor.scent_families, f.name) })}
                    />
                    {f.name}
                  </label>
                ))}
              </fieldset>
            </div>

            <div className={styles.variantsBox}>
              <div className={styles.variantsHead}>
                <h3>Sizes, Pricing &amp; Sale Promotions</h3>
                <Button
                  variant="ghost"
                  small
                  onClick={() =>
                    setEditor({
                      ...editor,
                      variants: [
                        ...editor.variants,
                        { sku: '', size_ml: '100', price_inr: '1790', compare_at_inr: '', sale_starts_at: '', sale_ends_at: '', quantity: '20', availability: 'in_stock', is_active: true },
                      ],
                    })
                  }
                >
                  + Add Size Variant
                </Button>
              </div>
              {editor.variants.map((v, idx) => (
                <div key={idx} className={styles.variantRow}>
                  <input
                    placeholder="SKU (auto)"
                    aria-label="Variant SKU"
                    value={v.sku}
                    onChange={(e) => {
                      const next = [...editor.variants];
                      next[idx] = { ...v, sku: e.target.value };
                      setEditor({ ...editor, variants: next });
                    }}
                  />
                  <input
                    type="number"
                    placeholder="ml"
                    aria-label="Size ml"
                    value={v.size_ml}
                    onChange={(e) => {
                      const next = [...editor.variants];
                      next[idx] = { ...v, size_ml: e.target.value };
                      setEditor({ ...editor, variants: next });
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Price ₹"
                    aria-label="Price INR"
                    value={v.price_inr}
                    onChange={(e) => {
                      const next = [...editor.variants];
                      next[idx] = { ...v, price_inr: e.target.value };
                      setEditor({ ...editor, variants: next });
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Sale Compare-At ₹"
                    aria-label="Compare at INR"
                    value={v.compare_at_inr}
                    onChange={(e) => {
                      const next = [...editor.variants];
                      next[idx] = { ...v, compare_at_inr: e.target.value };
                      setEditor({ ...editor, variants: next });
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Stock Qty"
                    aria-label="Stock quantity"
                    value={v.quantity}
                    onChange={(e) => {
                      const next = [...editor.variants];
                      next[idx] = { ...v, quantity: e.target.value };
                      setEditor({ ...editor, variants: next });
                    }}
                  />
                  <label className={styles.inlineCheck}>
                    <input
                      type="checkbox"
                      checked={v.is_active}
                      onChange={(e) => {
                        const next = [...editor.variants];
                        next[idx] = { ...v, is_active: e.target.checked };
                        setEditor({ ...editor, variants: next });
                      }}
                    />
                    Active
                  </label>
                </div>
              ))}
            </div>

            <div className={styles.editorActions}>
              <Button type="submit" disabled={savingProduct}>
                {savingProduct ? 'Saving...' : 'Save & Update Product'}
              </Button>
              <Button variant="ghost" onClick={() => setTab('products')}>
                Cancel
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* ── TAB 3: FRAGRANCE TYPES & CATEGORIES CRUD ────────────────────── */}
      {tab === 'taxonomy' && (
        <section className={styles.taxonomyGrid}>
          <div className={styles.panel}>
            <h2>Fragrance Types (CRUD by Category)</h2>
            <form
              className={styles.miniForm}
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await adminSaveFragranceType({
                    id: ftForm.id || null,
                    name: ftForm.name,
                    slug: ftForm.slug || null,
                    category_slug: ftForm.category_slug || null,
                    description: ftForm.description || null,
                    sort_order: Number(ftForm.sort_order) || 10,
                    is_active: ftForm.is_active,
                  });
                  setFtForm({ id: '', name: '', slug: '', category_slug: 'shop-all', description: '', sort_order: '10', is_active: true });
                  show('Fragrance type saved.');
                  await refreshWorkspace();
                } catch (err) {
                  show(err instanceof Error ? err.message : 'Save failed.');
                }
              }}
            >
              <input placeholder="Type Name (e.g. Extrait de Parfum)" required value={ftForm.name} onChange={(e) => setFtForm({ ...ftForm, name: e.target.value })} />
              <select value={ftForm.category_slug} onChange={(e) => setFtForm({ ...ftForm, category_slug: e.target.value })}>
                <option value="">Any Category</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    Category: {c.name}
                  </option>
                ))}
              </select>
              <Button type="submit" small>
                {ftForm.id ? 'Update Type' : 'Add Fragrance Type'}
              </Button>
            </form>

            <ul className={styles.crudList}>
              {fragranceTypes.map((ft) => (
                <li key={ft.id}>
                  <div>
                    <strong>{ft.name}</strong>
                    <div className={styles.sub}>
                      slug: {ft.slug} &middot; category: {ft.category_slug || 'all'} &middot; {ft.is_active ? 'active' : 'hidden'}
                    </div>
                  </div>
                  <div className={styles.rowBtns}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() =>
                        setFtForm({
                          id: ft.id,
                          name: ft.name,
                          slug: ft.slug,
                          category_slug: ft.category_slug ?? '',
                          description: ft.description ?? '',
                          sort_order: String(ft.sort_order),
                          is_active: ft.is_active,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      aria-label={`Delete ${ft.name}`}
                      onClick={async () => {
                        await adminDeleteFragranceType(ft.id);
                        show('Fragrance type deleted.');
                        await refreshWorkspace();
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.panel}>
            <h2>Categories CRUD</h2>
            <form
              className={styles.miniForm}
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await adminSaveCategory({
                    id: catForm.id || null,
                    name: catForm.name,
                    slug: catForm.slug || null,
                    kind: catForm.kind,
                    filter_value: catForm.filter_value || null,
                    sort_order: Number(catForm.sort_order) || 50,
                    is_active: catForm.is_active,
                  });
                  setCatForm({ id: '', name: '', slug: '', kind: 'type', filter_value: '', sort_order: '50', is_active: true });
                  show('Category saved.');
                  await refreshWorkspace();
                } catch (err) {
                  show(err instanceof Error ? err.message : 'Save failed.');
                }
              }}
            >
              <input placeholder="Category Name" required value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              <select value={catForm.kind} onChange={(e) => setCatForm({ ...catForm, kind: e.target.value as AdminCategory['kind'] })}>
                <option value="type">Type Category</option>
                <option value="audience">Audience Category</option>
                <option value="all">All</option>
              </select>
              <Button type="submit" small>
                {catForm.id ? 'Update Category' : 'Add Category'}
              </Button>
            </form>

            <ul className={styles.crudList}>
              {categories.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.name}</strong>
                    <div className={styles.sub}>
                      slug: {c.slug} &middot; kind: {c.kind} {c.filter_value ? `(${c.filter_value})` : ''}
                    </div>
                  </div>
                  <div className={styles.rowBtns}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() =>
                        setCatForm({
                          id: c.id,
                          name: c.name,
                          slug: c.slug,
                          kind: c.kind,
                          filter_value: c.filter_value ?? '',
                          sort_order: String(c.sort_order),
                          is_active: c.is_active,
                        })
                      }
                    >
                      Edit
                    </button>
                    {!['shop-all', 'personalized-perfumes'].includes(c.slug) && (
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        aria-label={`Delete ${c.name}`}
                        onClick={async () => {
                          await adminDeleteCategory(c.id);
                          show('Category deleted.');
                          await refreshWorkspace();
                        }}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── TAB 4: ORDERS & INVOICE EMAIL MANAGER ───────────────────────── */}
      {tab === 'orders' && (
        <section className={styles.panel}>
          {orders.length === 0 ? (
            <p className={styles.muted}>No customer orders have been placed yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order &amp; Invoice</th>
                    <th>Customer</th>
                    <th>Items &amp; Total</th>
                    <th>Payment</th>
                    <th>Fulfillment Status</th>
                    <th>Invoice &amp; Mail</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.order_number}</strong>
                        <div className={styles.sub}>{o.invoice_number}</div>
                        <div className={styles.sub}>{new Date(o.created_at).toLocaleString()}</div>
                      </td>
                      <td>
                        <strong>{o.customer_name}</strong>
                        <div className={styles.sub}>{o.customer_email} &middot; {o.customer_phone}</div>
                        <div className={styles.sub}>{o.shipping_address}, {o.city} - {o.pincode}</div>
                      </td>
                      <td>
                        <strong className="tabular">{formatINR(o.total_inr)}</strong>
                        <div className={styles.sub}>
                          {o.items.map((it) => `${it.product_name} (${it.size_ml}ml × ${it.quantity})`).join(', ')}
                        </div>
                      </td>
                      <td>
                        <strong>{o.payment_method.toUpperCase()}</strong>
                        {o.upi_reference && <div className={styles.sub}>UTR: {o.upi_reference}</div>}
                        <select
                          aria-label={`Payment status for ${o.order_number}`}
                          value={o.payment_status}
                          onChange={async (e) => {
                            await adminUpdateOrder(o.id, o.order_status, e.target.value);
                            show('Payment status updated.');
                            await refreshWorkspace();
                          }}
                          className={styles.inlineSelect}
                        >
                          <option value="pending">Pending (COD)</option>
                          <option value="awaiting_verification">Awaiting Verification</option>
                          <option value="paid">Paid</option>
                          <option value="failed">Failed</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Order status for ${o.order_number}`}
                          value={o.order_status}
                          onChange={async (e) => {
                            await adminUpdateOrder(o.id, e.target.value, o.payment_status);
                            show('Order status updated.');
                            await refreshWorkspace();
                          }}
                          className={styles.inlineSelect}
                        >
                          <option value="placed">Placed</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="packed">Packed</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>
                        <div className={styles.sub}>Email: {o.email_status}</div>
                        <div className={styles.rowBtns}>
                          {o.invoice_html && (
                            <>
                              <button type="button" className={styles.linkBtn} onClick={() => printInvoiceHtml(o.invoice_html!)}>
                                <Printer size={13} aria-hidden="true" /> Print
                              </button>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() => downloadInvoicePdf(o.invoice_number, o.invoice_html!)}
                              >
                                <Download size={13} aria-hidden="true" /> PDF
                              </button>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() => downloadInvoiceHtml(o.invoice_number, o.invoice_html!)}
                              >
                                HTML
                              </button>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={async () => {
                                  const res = await adminResendInvoice(o);
                                  show(res.message || `Email status: ${res.status}`);
                                  await refreshWorkspace();
                                }}
                              >
                                <Mail size={13} aria-hidden="true" /> Send
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── TAB 5: PERSONALISED PERFUMES ────────────────────────────────── */}
      {tab === 'personalised' && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>Personalised Perfume Bottle Sizes &amp; Studio Rates</h2>
              <p className={styles.sub}>Control which custom sizes are enabled on /make and their studio consultation pricing.</p>
            </div>
            <Button
              small
              variant="ghost"
              onClick={async () => {
                await adminSaveCustomPerfumeSizes(customSizes);
                show('Saved personalised bottle size configuration.');
                await refreshWorkspace();
              }}
            >
              Save Sizes &amp; Rates
            </Button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Rate (₹ INR)</th>
                  <th>Available on /make</th>
                  <th>Provisional Flag</th>
                </tr>
              </thead>
              <tbody>
                {customSizes.map((sz, idx) => (
                  <tr key={sz.size_ml}>
                    <td>
                      <strong>{sz.label}</strong>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={sz.price_inr}
                        aria-label={`Price for ${sz.label}`}
                        onChange={(e) =>
                          setCustomSizes((list) =>
                            list.map((item, i) => (i === idx ? { ...item, price_inr: Number(e.target.value) || item.price_inr } : item)),
                          )
                        }
                        className={styles.inlineSelect}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={sz.is_available}
                        aria-label={`Enable ${sz.label}`}
                        onChange={(e) =>
                          setCustomSizes((list) =>
                            list.map((item, i) => (i === idx ? { ...item, is_available: e.target.checked } : item)),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={sz.is_provisional}
                        aria-label={`Mark ${sz.label} provisional`}
                        onChange={(e) =>
                          setCustomSizes((list) =>
                            list.map((item, i) => (i === idx ? { ...item, is_provisional: e.target.checked } : item)),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ marginTop: '1rem' }}>Personalised Perfume Orders ({customOrders.length})</h2>
          {customOrders.length === 0 ? (
            <p className={styles.muted}>No personalised perfume orders submitted yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Request &amp; Order</th>
                    <th>Customer</th>
                    <th>Blend Preferences</th>
                    <th>Quote (₹) &amp; Statuses</th>
                    <th>Invoice &amp; Mail</th>
                  </tr>
                </thead>
                <tbody>
                  {customOrders.map((co) => (
                    <tr key={co.id}>
                      <td>
                        <strong>{co.request_ref}</strong>
                        {co.order_number && <div className={styles.sub}>{co.order_number}</div>}
                        {co.invoice_number && <div className={styles.sub}>{co.invoice_number}</div>}
                        <div className={styles.sub}>{new Date(co.created_at).toLocaleString()}</div>
                      </td>
                      <td>
                        <strong>{co.full_name}</strong>
                        <div className={styles.sub}>
                          {co.mobile_number} {co.email ? `· ${co.email}` : ''}
                        </div>
                        {co.shipping_address && (
                          <div className={styles.sub}>
                            {co.shipping_address}, {co.city}, {co.state} {co.pincode}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>
                          <strong>{co.bottle_label || 'House Signature Label'}</strong> ({co.bottle_size_ml} ml &middot; {co.packaging})
                        </div>
                        <div className={styles.sub}>Families: {co.families.join(', ')} &middot; {co.fragrance_character}</div>
                        <div className={styles.sub}>
                          Intensity: {co.intensity} {co.occasion ? `· ${co.occasion}` : ''}
                        </div>
                        {co.preferred_notes.length > 0 && <div className={styles.sub}>Notes: {co.preferred_notes.join(', ')}</div>}
                        {co.notes_to_avoid && <div className={styles.sub}>Avoid: {co.notes_to_avoid}</div>}
                        {co.additional_instructions && <div className={styles.sub}>Notes: {co.additional_instructions}</div>}
                      </td>
                      <td>
                        <div className={styles.sub}>
                          {co.payment_method?.toUpperCase()} {co.upi_reference ? `· UTR ${co.upi_reference}` : ''}
                        </div>
                        <input
                          type="number"
                          min={1}
                          aria-label={`Quoted INR for ${co.request_ref}`}
                          defaultValue={co.quoted_price_inr}
                          onBlur={async (e) => {
                            const val = Number(e.target.value);
                            if (val > 0 && val !== co.quoted_price_inr) {
                              await adminUpdatePersonalisedOrder({
                                requestId: co.id,
                                requestStatus: co.request_status,
                                orderStatus: co.order_status ?? 'placed',
                                paymentStatus: co.payment_status ?? 'pending',
                                quotedPriceInr: val,
                                staffNotes: co.staff_notes ?? undefined,
                              });
                              show('Custom perfume price & invoice updated.');
                              await refreshWorkspace();
                            }
                          }}
                          className={styles.inlineSelect}
                        />
                        <select
                          aria-label={`Request status for ${co.request_ref}`}
                          value={co.request_status}
                          onChange={async (e) => {
                            await adminUpdatePersonalisedOrder({
                              requestId: co.id,
                              requestStatus: e.target.value,
                              orderStatus: co.order_status ?? 'placed',
                              paymentStatus: co.payment_status ?? 'pending',
                              quotedPriceInr: co.quoted_price_inr,
                              staffNotes: co.staff_notes ?? undefined,
                            });
                            show('Request status updated.');
                            await refreshWorkspace();
                          }}
                          className={styles.inlineSelect}
                        >
                          <option value="pending_review">Pending Review</option>
                          <option value="under_review">Under Review</option>
                          <option value="quotation_prepared">Quotation Prepared</option>
                          <option value="awaiting_customer_approval">Awaiting Customer Approval</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="closed">Closed</option>
                        </select>
                        <select
                          aria-label={`Payment status for ${co.request_ref}`}
                          value={co.payment_status ?? 'pending'}
                          onChange={async (e) => {
                            await adminUpdatePersonalisedOrder({
                              requestId: co.id,
                              requestStatus: co.request_status,
                              orderStatus: co.order_status ?? 'placed',
                              paymentStatus: e.target.value,
                              quotedPriceInr: co.quoted_price_inr,
                              staffNotes: co.staff_notes ?? undefined,
                            });
                            show('Payment status updated.');
                            await refreshWorkspace();
                          }}
                          className={styles.inlineSelect}
                        >
                          <option value="pending">Pending (COD)</option>
                          <option value="awaiting_verification">Awaiting Verification</option>
                          <option value="paid">Paid</option>
                          <option value="failed">Failed</option>
                          <option value="refunded">Refunded</option>
                        </select>
                        <select
                          aria-label={`Order status for ${co.request_ref}`}
                          value={co.order_status ?? 'placed'}
                          onChange={async (e) => {
                            await adminUpdatePersonalisedOrder({
                              requestId: co.id,
                              requestStatus: co.request_status,
                              orderStatus: e.target.value,
                              paymentStatus: co.payment_status ?? 'pending',
                              quotedPriceInr: co.quoted_price_inr,
                              staffNotes: co.staff_notes ?? undefined,
                            });
                            show('Fulfillment status updated.');
                            await refreshWorkspace();
                          }}
                          className={styles.inlineSelect}
                        >
                          <option value="placed">Placed</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="packed">Packed</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>
                        <div className={styles.sub}>Email: {co.email_status ?? 'pending'}</div>
                        <div className={styles.rowBtns}>
                          {co.invoice_html && (
                            <>
                              <button type="button" className={styles.linkBtn} onClick={() => printInvoiceHtml(co.invoice_html!)}>
                                <Printer size={13} aria-hidden="true" /> Print
                              </button>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() => downloadInvoicePdf(co.invoice_number ?? co.request_ref, co.invoice_html!)}
                              >
                                <Download size={13} aria-hidden="true" /> PDF
                              </button>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() => downloadInvoiceHtml(co.invoice_number ?? co.request_ref, co.invoice_html!)}
                              >
                                HTML
                              </button>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={async () => {
                                  const res = await adminResendPersonalisedInvoice(co);
                                  show(res.message || `Email status: ${res.status}`);
                                  await refreshWorkspace();
                                }}
                              >
                                <Mail size={13} aria-hidden="true" /> Send
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── TAB 6: ACTIVITY LOG & ADMIN ACCESS ──────────────────────────── */}
      {tab === 'activity' && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.filtersRow}>
              <label htmlFor="log-actor">Actor:</label>
              <select id="log-actor" value={logActor} onChange={(e) => setLogActor(e.target.value)} className={styles.selectInput}>
                <option value="all">All Website Activities</option>
                <option value="customer">Customer Actions</option>
                <option value="admin">Admin CRUD Actions</option>
                <option value="system">System / Email Dispatch</option>
              </select>
            </div>
            <form
              className={styles.inlineInvite}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newAdminEmail.trim()) return;
                try {
                  await adminAddAdmin(newAdminEmail);
                  setNewAdminEmail('');
                  show('Admin added.');
                  await refreshWorkspace();
                } catch (err) {
                  show(err instanceof Error ? err.message : 'Failed adding admin.');
                }
              }}
            >
              <input
                type="email"
                placeholder="Grant admin email..."
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className={styles.searchInput}
              />
              <Button type="submit" small variant="ghost">
                Authorize Admin
              </Button>
            </form>
          </div>

          <p className={styles.sub}>Authorized admins: {admins.map((a) => `${a.email} (${a.role})`).join(', ')}</p>

          <ul className={styles.logList}>
            {logs.map((l) => (
              <li key={l.id} className={styles.logItem}>
                <span className={styles.pill} data-status={l.actor_type}>
                  {l.actor_type}
                </span>
                <div className={styles.logBody}>
                  <strong>{l.summary}</strong>
                  <div className={styles.sub}>
                    {l.action} &middot; {l.entity_type} {l.actor_email ? `· ${l.actor_email}` : ''}
                  </div>
                </div>
                <time className={styles.sub}>{new Date(l.created_at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

