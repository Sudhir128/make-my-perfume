import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Copy, Download, Mail, Printer, QrCode, Smartphone, Trash2, Truck, X } from 'lucide-react';
import { trackSiteActivity } from '../data/activity';
import { placeCustomerOrder, type PaymentMethod } from '../data/orders';
import { productImage } from '../data/productImages';
import { formatINR } from '../lib/format';
import { downloadInvoiceHtml, downloadInvoicePdf, printInvoiceHtml } from '../lib/invoice';
import { itemCount, subtotal } from '../lib/pricing';
import { generateQrMatrix } from '../lib/qr';
import { getSupabaseConfig } from '../lib/supabaseConfig';
import { useBag } from '../store/bag';
import { useCustomerAuth } from '../store/customerAuth';
import { useOrders, type PlacedOrderReceipt } from '../store/orders';
import { useProfile, validateProfile, type ProfileDetails } from '../store/profile';
import { useToast } from '../store/toast';
import { Button, ButtonLink } from '../components/Button';
import { ImageryPending } from '../components/ImageryPending';
import { QuantityStepper } from '../components/QuantityStepper';
import styles from './Bag.module.css';

interface CheckoutErrors extends Partial<Record<keyof ProfileDetails, string>> {
  upiReference?: string;
  submit?: string;
}

export default function Bag() {
  const lines = useBag((s) => s.lines);
  const setQty = useBag((s) => s.setQty);
  const remove = useBag((s) => s.remove);
  const restore = useBag((s) => s.restore);
  const clearBag = useBag((s) => s.clear);

  const savedProfile = useProfile((s) => s.details);
  const saveProfile = useProfile((s) => s.save);
  const addOrder = useOrders((s) => s.addOrder);

  const show = useToast((s) => s.show);
  const dialog = useRef<HTMLDialogElement>(null);

  const [form, setForm] = useState<ProfileDetails>(savedProfile);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [upiReference, setUpiReference] = useState('');
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<PlacedOrderReceipt | null>(null);
  const customerUser = useCustomerAuth((s) => s.user);
  const initCustomerAuth = useCustomerAuth((s) => s.init);
  const signInCustomer = useCustomerAuth((s) => s.signIn);
  const signUpCustomer = useCustomerAuth((s) => s.signUp);
  const signOutCustomer = useCustomerAuth((s) => s.signOut);

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [upiConfig, setUpiConfig] = useState<{ vpa: string; name: string }>({
    vpa: 'makemyperfume@upi',
    name: 'Make My Perfume',
  });

  useEffect(() => {
    void initCustomerAuth();
  }, [initCustomerAuth]);

  useEffect(() => {
    setForm((prev) => ({
      ...savedProfile,
      ...prev,
      name: prev.name || savedProfile.name || customerUser?.fullName || '',
      email: prev.email || savedProfile.email || customerUser?.email || '',
    }));
  }, [savedProfile, customerUser]);

  useEffect(() => {
    getSupabaseConfig()
      .then((cfg) => {
        if (cfg.merchantUpiId || cfg.merchantName) {
          setUpiConfig({
            vpa: cfg.merchantUpiId || 'makemyperfume@upi',
            name: cfg.merchantName || 'Make My Perfume',
          });
        }
      })
      .catch(() => {});
  }, []);

  const count = itemCount(lines);
  const total = subtotal(lines);

  const upiUri = useMemo(() => {
    const params = new URLSearchParams({
      pa: upiConfig.vpa,
      pn: upiConfig.name,
      am: String(total),
      cu: 'INR',
      tn: 'Make My Perfume Order',
    });
    return `upi://pay?${params.toString()}`;
  }, [upiConfig, total]);

  const qrMatrix = useMemo(() => (paymentMethod === 'upi' ? generateQrMatrix(upiUri) : null), [paymentMethod, upiUri]);

  const openCheckout = () => {
    setReceipt(null);
    setErrors({});
    setAuthError(null);
    setAuthNotice(null);
    trackSiteActivity('checkout.started', 'bag', null, `Opened checkout with ${count} item(s), total ${formatINR(total)}`);
    dialog.current?.showModal();
  };

  const handleCheckoutAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Enter your email and password.');
      return;
    }
    if (authTab === 'register' && authName.trim().length < 2) {
      setAuthError('Enter your full name to create an account.');
      return;
    }
    if (authTab === 'register' && authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthBusy(true);
    try {
      if (authTab === 'login') {
        await signInCustomer(authEmail, authPassword);
        show('Signed in. Continue to place your order.');
      } else {
        const res = await signUpCustomer(authName, authEmail, authPassword);
        if (res.needsVerification) {
          setAuthTab('login');
          setAuthNotice(`Account created for ${authEmail.trim()}. Please verify your email if prompted, then log in below to continue.`);
        } else {
          show('Account created! Continue with delivery & payment.');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (authTab === 'login' && /invalid login credentials/i.test(msg)) {
        setAuthError('Email or password incorrect, or no account exists yet. Create an account below to continue.');
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrs: CheckoutErrors = validateProfile(form);
    if (!form.phone.trim()) fieldErrs.phone = 'Enter your 10-digit mobile number.';
    if (form.address.trim().length < 5) fieldErrs.address = 'Enter your complete delivery address.';
    if (form.city.trim().length < 2) fieldErrs.city = 'Enter your city.';
    if (form.state.trim().length < 2) fieldErrs.state = 'Enter your state.';
    if (!form.pincode.trim()) fieldErrs.pincode = 'Enter your 6-digit PIN code.';
    if (paymentMethod === 'upi' && upiReference.trim().length < 6) {
      fieldErrs.upiReference = 'Enter the 6–18 character UPI Transaction ID / UTR reference.';
    }

    setErrors(fieldErrs);
    if (Object.keys(fieldErrs).length > 0) return;

    setSubmitting(true);
    try {
      const placed = await placeCustomerOrder({
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
        shippingAddress: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        paymentMethod,
        upiReference: paymentMethod === 'upi' ? upiReference : undefined,
        items: lines,
      });
      saveProfile(form);
      addOrder(placed);
      clearBag();
      setReceipt(placed);
      setUpiReference('');
      show(`Order ${placed.orderNumber} placed!`);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Unable to place order right now. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (lines.length === 0 && !receipt) {
    return (
      <section className={`${styles.empty} page-width`} aria-labelledby="bag-title">
        <h1 id="bag-title" className={styles.title}>
          Your bag <em>is empty.</em>
        </h1>
        <p className={styles.muted}>Find a scent that sounds like you.</p>
        <ButtonLink to="/collection">Shop the collection</ButtonLink>
      </section>
    );
  }

  return (
    <div className={`${styles.page} page-width`}>
      {receipt && lines.length === 0 ? (
        <section className={styles.confirmationCard} aria-labelledby="confirmed-heading">
          <p className="eyebrow eyebrow--lead">Order confirmed</p>
          <h1 id="confirmed-heading" className={styles.title}>
            Thank you, <em>{receipt.customerName.split(' ')[0]}.</em>
          </h1>
          <p className={styles.confirmMeta}>
            Order <strong>{receipt.orderNumber}</strong> &middot; Invoice <strong>{receipt.invoiceNumber}</strong> &middot;{' '}
            {receipt.paymentMethod === 'upi' ? `UPI (${receipt.upiReference})` : 'Cash on Delivery (COD)'}
          </p>
          <div className={styles.emailNotice}>
            <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>
              {receipt.emailStatus === 'sent'
                ? `Confirmation & invoice emailed to ${receipt.customerEmail}.`
                : `Invoice prepared for ${receipt.customerEmail} (${receipt.emailMessage || 'saved in outbox'}). You can print or download your invoice below.`}
            </span>
          </div>
          <div className={styles.invoiceBox}>
            <h2 className={styles.summaryTitle}>Invoice Summary</h2>
            <ul className={styles.receiptItems}>
              {receipt.items.map((it, idx) => (
                <li key={`${it.product_slug}-${idx}`}>
                  <span>
                    {it.product_name} ({it.size_ml} ml) &times; {it.quantity}
                  </span>
                  <span className="tabular">{formatINR(it.line_total_inr)}</span>
                </li>
              ))}
            </ul>
            <div className={styles.receiptTotal}>
              <span>Total</span>
              <span className="tabular">{formatINR(receipt.totalInr)}</span>
            </div>
          </div>
          <div className={styles.receiptActions}>
            <Button onClick={() => printInvoiceHtml(receipt.invoiceHtml)}>
              <Printer size={16} strokeWidth={1.5} aria-hidden="true" />
              Print / Save PDF Invoice
            </Button>
            <Button onClick={() => downloadInvoicePdf(receipt.invoiceNumber, receipt.invoiceHtml)}>
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              Download Invoice (PDF)
            </Button>
            <Button variant="ghost" onClick={() => downloadInvoiceHtml(receipt.invoiceNumber, receipt.invoiceHtml)}>
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              Download Invoice HTML
            </Button>
            <ButtonLink to="/collection" variant="quiet" arrow>
              Continue shopping
            </ButtonLink>
          </div>
        </section>
      ) : (
        <>
          <h1 className={styles.title}>
            Your <em>bag.</em>
          </h1>
          <div className={styles.layout}>
            <ul className={styles.lines} aria-label="Items in your bag">
              {lines.map((l) => (
                <li key={l.id} className={styles.line}>
                  <Link to={`/product/${l.slug}`} className={styles.thumb} tabIndex={-1} aria-hidden="true">
                    {productImage(l.slug) ? (
                      <img
                        className={`${styles.photo} shoulder-mask`}
                        src={productImage(l.slug)!.src}
                        srcSet={productImage(l.slug)!.srcSet}
                        sizes="104px"
                        width={480}
                        height={480}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <ImageryPending subject={l.name} family={l.collection || 'Warm'} shape="shoulder" ratio="1 / 1" />
                    )}
                  </Link>
                  <div className={styles.lineBody}>
                    <p className={styles.family}>{l.collection || 'Fragrance'}</p>
                    <h2 className={styles.lineName}>
                      <Link to={`/product/${l.slug}`}>{l.name}</Link>
                    </h2>
                    <p className={styles.muted}>
                      {l.sizeMl} ml · <span className="tabular">{formatINR(l.unitPrice)}</span> each
                    </p>
                    <div className={styles.lineActions}>
                      <QuantityStepper value={l.qty} onChange={(n) => setQty(l.id, n)} label={l.name} size="sm" />
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => {
                          const removed = remove(l.id);
                          if (removed) show(`${l.name} removed from your bag.`, { label: 'Undo', onAction: () => restore(removed.line, removed.index) });
                        }}
                      >
                        <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
                        Remove<span className="visually-hidden"> {l.name}</span>
                      </button>
                    </div>
                  </div>
                  <p className={`${styles.lineTotal} tabular`}>
                    <span className="visually-hidden">Line total </span>
                    {formatINR(l.unitPrice * l.qty)}
                  </p>
                </li>
              ))}
            </ul>

            <aside className={styles.summary} aria-labelledby="summary-title">
              <h2 id="summary-title" className={styles.summaryTitle}>
                Order summary
              </h2>
              <dl className={styles.totals}>
                <div>
                  <dt>Items</dt>
                  <dd className="tabular">{count}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>Complimentary</dd>
                </div>
                <div className={styles.subtotal}>
                  <dt>Subtotal</dt>
                  <dd className="tabular">{formatINR(total)}</dd>
                </div>
              </dl>
              <Button className={styles.checkout} onClick={openCheckout}>
                Proceed to Checkout
              </Button>
              <ButtonLink to="/collection" variant="quiet" arrow>
                Continue shopping
              </ButtonLink>
            </aside>
          </div>
        </>
      )}

      <dialog ref={dialog} className={styles.dialog} aria-labelledby="checkout-title">
        <button type="button" className={styles.dialogClose} onClick={() => dialog.current?.close()} aria-label="Close">
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>

        {receipt ? (
          <div className={styles.receiptModal}>
            <div className={styles.receiptIcon}>
              <CheckCircle2 size={28} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h2 id="checkout-title" className={styles.dialogTitle}>
              Order <em>placed.</em>
            </h2>
            <p className={styles.muted}>
              Order <strong>{receipt.orderNumber}</strong> &middot; Invoice <strong>{receipt.invoiceNumber}</strong>
            </p>
            <div className={styles.emailNotice}>
              <Mail size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>
                {receipt.emailStatus === 'sent'
                  ? `Order invoice sent to ${receipt.customerEmail}.`
                  : `Invoice recorded for ${receipt.customerEmail} (${receipt.emailMessage || 'queued in outbox'}).`}
              </span>
            </div>
            <div className={styles.receiptActions}>
              <Button onClick={() => printInvoiceHtml(receipt.invoiceHtml)}>
                <Printer size={16} strokeWidth={1.5} aria-hidden="true" />
                Print Invoice
              </Button>
              <Button onClick={() => downloadInvoicePdf(receipt.invoiceNumber, receipt.invoiceHtml)}>
                <Download size={16} strokeWidth={1.5} aria-hidden="true" />
                Download PDF
              </Button>
              <Button variant="ghost" onClick={() => downloadInvoiceHtml(receipt.invoiceNumber, receipt.invoiceHtml)}>
                <Download size={16} strokeWidth={1.5} aria-hidden="true" />
                Download HTML
              </Button>
              <Button variant="quiet" onClick={() => dialog.current?.close()}>
                Done
              </Button>
            </div>
          </div>
        ) : !customerUser ? (
          <form className={styles.checkoutForm} onSubmit={handleCheckoutAuth} noValidate>
            <div>
              <h2 id="checkout-title" className={styles.dialogTitle}>
                {authTab === 'login' ? (
                  <>
                    Sign in <em>to continue.</em>
                  </>
                ) : (
                  <>
                    Create <em>your account.</em>
                  </>
                )}
              </h2>
              <p className={styles.muted}>
                {authTab === 'login'
                  ? 'Please log in with your account to place this order. If you do not have an account yet, create one to continue.'
                  : 'Create an account to complete your order and receive your official invoice.'}
              </p>
            </div>

            <div className={styles.authTabs} role="tablist" aria-label="Account options">
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'login'}
                className={authTab === 'login' ? styles.authTabActive : styles.authTab}
                onClick={() => {
                  setAuthTab('login');
                  setAuthError(null);
                  setAuthNotice(null);
                }}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'register'}
                className={authTab === 'register' ? styles.authTabActive : styles.authTab}
                onClick={() => {
                  setAuthTab('register');
                  setAuthError(null);
                  setAuthNotice(null);
                }}
              >
                Create account
              </button>
            </div>

            <div className={styles.authFields}>
              {authTab === 'register' && (
                <div className={styles.field}>
                  <label htmlFor="co-reg-name">Full name</label>
                  <input
                    id="co-reg-name"
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              )}
              <div className={styles.field}>
                <label htmlFor="co-auth-email">Email</label>
                <input
                  id="co-auth-email"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="co-auth-password">Password</label>
                <input
                  id="co-auth-password"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </div>
            </div>

            {authNotice && <p className={styles.emailNotice}>{authNotice}</p>}
            {authError && <p className={styles.error}>{authError}</p>}

            <div className={styles.authActions}>
              <Button type="submit" disabled={authBusy}>
                {authBusy ? 'Please wait...' : authTab === 'login' ? 'Log in & continue' : 'Create account & continue'}
              </Button>
              <button
                type="button"
                className={styles.switchAuthBtn}
                onClick={() => {
                  setAuthTab(authTab === 'login' ? 'register' : 'login');
                  setAuthError(null);
                }}
              >
                {authTab === 'login' ? 'New customer? Create an account' : 'Already have an account? Log in'}
              </button>
            </div>
          </form>
        ) : (
          <form className={styles.checkoutForm} onSubmit={handleCheckout} noValidate>
            <div className={styles.signedInBar}>
              <span>
                Signed in as <strong>{customerUser.email}</strong>
              </span>
              <button type="button" className={styles.switchAuthBtn} onClick={() => void signOutCustomer()}>
                Switch account
              </button>
            </div>
            <div>
              <h2 id="checkout-title" className={styles.dialogTitle}>
                Complete <em>your order.</em>
              </h2>
              <p className={styles.muted}>
                Order total: <strong className="tabular">{formatINR(total)}</strong> ({count} {count === 1 ? 'item' : 'items'})
              </p>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="co-name">Full name</label>
                <input id="co-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
                {errors.name && <span className={styles.error}>{errors.name}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="co-email">Email (for invoice)</label>
                <input id="co-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
                {errors.email && <span className={styles.error}>{errors.email}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="co-phone">Mobile number</label>
                <input id="co-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
                {errors.phone && <span className={styles.error}>{errors.phone}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="co-pincode">PIN code</label>
                <input id="co-pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} autoComplete="postal-code" />
                {errors.pincode && <span className={styles.error}>{errors.pincode}</span>}
              </div>
              <div className={`${styles.field} ${styles.wide}`}>
                <label htmlFor="co-address">Delivery address</label>
                <input id="co-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" />
                {errors.address && <span className={styles.error}>{errors.address}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="co-city">City</label>
                <input id="co-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" />
                {errors.city && <span className={styles.error}>{errors.city}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="co-state">State</label>
                <input id="co-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} autoComplete="address-level1" />
                {errors.state && <span className={styles.error}>{errors.state}</span>}
              </div>
            </div>

            <fieldset className={styles.paymentGroup}>
              <legend className={styles.legend}>Payment method</legend>
              <div className={styles.paymentOptions}>
                <label className={styles.payCard}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <Truck size={18} strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <strong>Cash on Delivery (COD)</strong>
                    <span>Pay when your fragrance arrives at your doorstep.</span>
                  </div>
                </label>

                <label className={styles.payCard}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="upi"
                    checked={paymentMethod === 'upi'}
                    onChange={() => setPaymentMethod('upi')}
                  />
                  <Smartphone size={18} strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <strong>UPI (GPay, PhonePe, Paytm, BHIM)</strong>
                    <span>Scan QR or pay via UPI ID &amp; enter transaction UTR below.</span>
                  </div>
                </label>
              </div>
            </fieldset>

            {paymentMethod === 'upi' && qrMatrix && (
              <div className={styles.upiBox}>
                <div className={styles.qrWrap}>
                  <svg
                    viewBox={`0 0 ${qrMatrix.size + 4} ${qrMatrix.size + 4}`}
                    className={styles.qrSvg}
                    role="img"
                    aria-label={`UPI QR code to pay ${formatINR(total)} to ${upiConfig.vpa}`}
                  >
                    <rect width={qrMatrix.size + 4} height={qrMatrix.size + 4} fill="#FAF8F4" />
                    {qrMatrix.modules.map((m, i) =>
                      m ? (
                        <rect
                          key={i}
                          x={(i % qrMatrix.size) + 2}
                          y={Math.floor(i / qrMatrix.size) + 2}
                          width={1}
                          height={1}
                          fill="#1A1612"
                        />
                      ) : null,
                    )}
                  </svg>
                </div>
                <div className={styles.upiDetails}>
                  <p className={styles.upiTitle}>
                    <QrCode size={15} strokeWidth={1.5} aria-hidden="true" /> Pay <span className="tabular">{formatINR(total)}</span> via UPI
                  </p>
                  <div className={styles.vpaRow}>
                    <code>{upiConfig.vpa}</code>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => {
                        navigator.clipboard?.writeText(upiConfig.vpa);
                        show('UPI ID copied.');
                      }}
                    >
                      <Copy size={13} strokeWidth={1.5} aria-hidden="true" /> Copy
                    </button>
                  </div>
                  <a href={upiUri} className={styles.upiAppLink}>
                    Open UPI app on device
                  </a>
                  <div className={styles.field}>
                    <label htmlFor="co-utr">UPI Transaction ID / UTR Reference</label>
                    <input
                      id="co-utr"
                      placeholder="e.g. 412890123456"
                      value={upiReference}
                      onChange={(e) => setUpiReference(e.target.value)}
                    />
                    {errors.upiReference && <span className={styles.error}>{errors.upiReference}</span>}
                  </div>
                </div>
              </div>
            )}

            {errors.submit && <p className={styles.error}>{errors.submit}</p>}

            <div className={styles.submitRow}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Placing order...' : `Place order & send invoice (${formatINR(total)})`}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
