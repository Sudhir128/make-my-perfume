import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Package, ShoppingBag, UserCheck, UserRound } from 'lucide-react';
import { fetchMyOrders } from '../data/orders';
import { itemCount } from '../lib/pricing';
import { formatINR } from '../lib/format';
import { downloadInvoiceHtml, downloadInvoicePdf, printInvoiceHtml } from '../lib/invoice';
import { useBag } from '../store/bag';
import { useCustomerAuth } from '../store/customerAuth';
import { useOrders, type PlacedOrderReceipt } from '../store/orders';
import { useToast } from '../store/toast';
import { EMPTY_PROFILE, useProfile, validateProfile, type ProfileDetails } from '../store/profile';
import { Button, ButtonLink } from '../components/Button';
import styles from './Profile.module.css';

const FIELDS: Array<{ key: keyof ProfileDetails; label: string; type?: string; autoComplete: string; wide?: boolean; inputMode?: 'tel' | 'numeric' | 'email' }> = [
  { key: 'name', label: 'Full name', autoComplete: 'name' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', inputMode: 'email' },
  { key: 'phone', label: 'Mobile number', type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  { key: 'address', label: 'Address', autoComplete: 'street-address', wide: true },
  { key: 'city', label: 'City', autoComplete: 'address-level2' },
  { key: 'state', label: 'State', autoComplete: 'address-level1' },
  { key: 'pincode', label: 'PIN code', autoComplete: 'postal-code', inputMode: 'numeric' },
];

export default function Profile() {
  const saved = useProfile((s) => s.details);
  const save = useProfile((s) => s.save);
  const clear = useProfile((s) => s.clear);
  const bagCount = useBag((s) => itemCount(s.lines));
  const localOrders = useOrders((s) => s.orders);
  const [remoteOrders, setRemoteOrders] = useState<PlacedOrderReceipt[]>([]);
  const customerUser = useCustomerAuth((s) => s.user);
  const initCustomerAuth = useCustomerAuth((s) => s.init);
  const signInCustomer = useCustomerAuth((s) => s.signIn);
  const signUpCustomer = useCustomerAuth((s) => s.signUp);
  const signOutCustomer = useCustomerAuth((s) => s.signOut);

  const show = useToast((s) => s.show);
  const [form, setForm] = useState<ProfileDetails>(saved);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileDetails, string>>>({});

  const [acctMode, setAcctMode] = useState<'login' | 'register'>('login');
  const [acctName, setAcctName] = useState('');
  const [acctEmail, setAcctEmail] = useState('');
  const [acctPassword, setAcctPassword] = useState('');
  const [acctBusy, setAcctBusy] = useState(false);
  const [acctMsg, setAcctMsg] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    void initCustomerAuth();
  }, [initCustomerAuth]);

  useEffect(() => {
    if (!customerUser) {
      setRemoteOrders([]);
      return;
    }
    fetchMyOrders().then(setRemoteOrders).catch(() => {});
  }, [customerUser]);

  const orders = useMemo(() => {
    const map = new Map<string, PlacedOrderReceipt>();
    for (const o of remoteOrders) map.set(o.orderNumber, o);
    for (const o of localOrders) if (!map.has(o.orderNumber)) map.set(o.orderNumber, o);
    return [...map.values()];
  }, [remoteOrders, localOrders]);

  const handleAccountAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAcctMsg(null);
    setAcctBusy(true);
    try {
      if (acctMode === 'login') {
        await signInCustomer(acctEmail, acctPassword);
        show('Signed in to your account.');
      } else {
        const res = await signUpCustomer(acctName, acctEmail, acctPassword);
        if (res.needsVerification) {
          setAcctMode('login');
          setAcctMsg('Account created! Check your email to confirm, then sign in.');
        } else {
          show('Account created & signed in.');
        }
      }
      setAcctPassword('');
    } catch (err) {
      setAcctMsg(err instanceof Error ? err.message : 'Account sign-in failed.');
    } finally {
      setAcctBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateProfile(form);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      document.getElementById(`profile-${first}`)?.focus();
      return;
    }
    save(form);
    show('Your details are saved.');
  };

  const greeting = saved.name.trim() ? `Hello, ${saved.name.trim().split(/\s+/)[0]}.` : 'Your profile.';

  return (
    <div className={`${styles.page} page-width`}>
      <header className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {saved.name.trim() ? saved.name.trim()[0]!.toUpperCase() : <UserRound size={26} strokeWidth={1.5} />}
        </span>
        <div>
          <p className="eyebrow eyebrow--lead">Profile</p>
          <h1 className={styles.title}>{greeting}</h1>
        </div>
      </header>

      <div className={styles.layout}>
        <form className={styles.card} onSubmit={submit} method="post" noValidate aria-labelledby="details-title">
          <h2 id="details-title" className={styles.cardTitle}>
            Your details
          </h2>
          <p className={styles.muted}>Used to fill in delivery details. Saved on this device.</p>
          <div className={styles.fields}>
            {FIELDS.map((f) => (
              <div key={f.key} className={[styles.field, f.wide ? styles.wide : ''].join(' ')}>
                <label htmlFor={`profile-${f.key}`}>{f.label}</label>
                <input
                  id={`profile-${f.key}`}
                  name={f.key}
                  type={f.type ?? 'text'}
                  inputMode={f.inputMode}
                  autoComplete={f.autoComplete}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  aria-invalid={errors[f.key] ? true : undefined}
                  aria-describedby={errors[f.key] ? `profile-${f.key}-error` : undefined}
                />
                {errors[f.key] && (
                  <span id={`profile-${f.key}-error`} className={styles.error}>
                    {errors[f.key]}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className={styles.actions}>
            <Button type="submit">Save details</Button>
            {saved.name && (
              <Button
                variant="quiet"
                onClick={() => {
                  clear();
                  setForm(EMPTY_PROFILE);
                  setErrors({});
                  show('Your details were removed from this device.');
                }}
              >
                Remove my details
              </Button>
            )}
          </div>
        </form>

        <div className={styles.side}>
          <section className={styles.card} aria-labelledby="account-title">
            <h2 id="account-title" className={styles.cardTitle}>
              <UserCheck size={18} strokeWidth={1.5} aria-hidden="true" /> Customer Account
            </h2>
            {customerUser ? (
              <>
                <p className={styles.muted}>
                  Signed in as <strong>{customerUser.email}</strong>. Orders you place are linked to this account.
                </p>
                {confirmSignOut ? (
                  <div className={styles.confirmBox}>
                    <p className={styles.confirmText}>Are you sure you want to sign out?</p>
                    <div className={styles.confirmActions}>
                      <Button
                        small
                        onClick={async () => {
                          await signOutCustomer();
                          setConfirmSignOut(false);
                          show('Signed out successfully.');
                        }}
                      >
                        Yes, sign out
                      </Button>
                      <Button variant="ghost" small onClick={() => setConfirmSignOut(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" small onClick={() => setConfirmSignOut(true)}>
                    Sign out
                  </Button>
                )}
              </>
            ) : (
              <form className={styles.acctForm} onSubmit={handleAccountAuth}>
                <p className={styles.muted}>Sign in or create an account to place orders quickly.</p>
                {acctMode === 'register' && (
                  <div className={styles.field}>
                    <label htmlFor="acct-name">Account name</label>
                    <input id="acct-name" value={acctName} onChange={(e) => setAcctName(e.target.value)} required />
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor="acct-email">Account email</label>
                  <input id="acct-email" type="email" value={acctEmail} onChange={(e) => setAcctEmail(e.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="acct-password">Account password</label>
                  <input
                    id="acct-password"
                    type="password"
                    minLength={6}
                    value={acctPassword}
                    onChange={(e) => setAcctPassword(e.target.value)}
                    required
                  />
                </div>
                {acctMsg && <p className={styles.error}>{acctMsg}</p>}
                <div className={styles.actions}>
                  <Button type="submit" small disabled={acctBusy}>
                    {acctBusy ? 'Working...' : acctMode === 'login' ? 'Log in' : 'Create account'}
                  </Button>
                  <button
                    type="button"
                    className={styles.orderBtn}
                    onClick={() => {
                      setAcctMode(acctMode === 'login' ? 'register' : 'login');
                      setAcctMsg(null);
                    }}
                  >
                    {acctMode === 'login' ? 'Create an account' : 'Already registered? Log in'}
                  </button>
                </div>
              </form>
            )}
          </section>
          <section className={styles.card} aria-labelledby="bag-title">
            <h2 id="bag-title" className={styles.cardTitle}>
              <ShoppingBag size={18} strokeWidth={1.5} aria-hidden="true" /> Your bag
            </h2>
            <p className={styles.muted}>
              {bagCount === 0 ? 'Your bag is empty.' : `${bagCount} ${bagCount === 1 ? 'item' : 'items'} waiting for you.`}
            </p>
            <ButtonLink to={bagCount ? '/bag' : '/collection'} variant="ghost" small>
              {bagCount ? 'View bag' : 'Shop the collection'}
            </ButtonLink>
          </section>
          <section className={styles.card} aria-labelledby="orders-title">
            <h2 id="orders-title" className={styles.cardTitle}>
              <Package size={18} strokeWidth={1.5} aria-hidden="true" /> Orders
            </h2>
            {orders.length === 0 ? (
              <>
                <p className={styles.muted}>No orders yet.</p>
                <Link to="/collection" className={styles.link}>
                  Find your signature
                </Link>
              </>
            ) : (
              <ul className={styles.orderList}>
                {orders.map((o) => (
                  <li key={o.orderNumber} className={styles.orderItem}>
                    <div className={styles.orderTop}>
                      <strong>{o.orderNumber}</strong>
                      <span className="tabular">{formatINR(o.totalInr)}</span>
                    </div>
                    <p className={styles.muted}>
                      {o.paymentMethod.toUpperCase()} &middot; {o.orderStatus} &middot; {o.invoiceNumber}
                    </p>
                    <div className={styles.orderActions}>
                      <button type="button" className={styles.orderBtn} onClick={() => printInvoiceHtml(o.invoiceHtml)}>
                        Print
                      </button>
                      <button
                        type="button"
                        className={styles.orderBtn}
                        onClick={() => downloadInvoicePdf(o.invoiceNumber, o.invoiceHtml)}
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        className={styles.orderBtn}
                        onClick={() => downloadInvoiceHtml(o.invoiceNumber, o.invoiceHtml)}
                      >
                        HTML
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
