import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Mail,
  Pencil,
  Printer,
  QrCode,
  ShieldCheck,
  Smartphone,
  Truck,
  X,
} from 'lucide-react';
import { trackSiteActivity } from '../data/activity';
import {
  BOTTLE_LABEL_MAX,
  createInitialDraft,
  CUSTOM_CHARACTERS,
  CUSTOM_FAMILIES,
  CUSTOM_INTENSITIES,
  CUSTOM_NOTES,
  CUSTOM_OCCASIONS,
  CUSTOM_PACKAGING,
  fetchCustomPerfumeSizes,
  type CustomBottleSizeOption,
  type CustomOrderConfirmation,
  type CustomPerfumeDraft,
  validateInternationalPhone,
  validateOptionalEmail,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4Contact,
  submitCustomPerfumeOrder,
} from '../data/customPerfume';
import type { PaymentMethod } from '../data/orders';
import { formatINR } from '../lib/format';
import { downloadInvoiceHtml, downloadInvoicePdf, printInvoiceHtml } from '../lib/invoice';
import { generateQrMatrix } from '../lib/qr';
import { getSupabaseConfig } from '../lib/supabaseConfig';
import { useCustomerAuth } from '../store/customerAuth';
import { useOrders } from '../store/orders';
import { useProfile } from '../store/profile';
import { useToast } from '../store/toast';
import { BottlePreview } from '../components/BottlePreview';
import { Button, ButtonLink } from '../components/Button';
import { NoteGlyph } from '../components/NoteGlyph';
import styles from './Make.module.css';

export async function loader() {
  const sizes = await fetchCustomPerfumeSizes();
  return { sizes };
}

type StepNumber = 1 | 2 | 3 | 4;

const STEPS: Array<{ num: StepNumber; code: string; label: string }> = [
  { num: 1, code: '01.', label: 'Fragrance Profile' },
  { num: 2, code: '02.', label: 'Scent Preferences' },
  { num: 3, code: '03.', label: 'Personalize Your Bottle' },
  { num: 4, code: '04.', label: 'Review & Create' },
];

export default function Make() {
  const { sizes } = useLoaderData() as { sizes: CustomBottleSizeOption[] };
  const [searchParams] = useSearchParams();
  const initialName = searchParams.get('name') ?? '';

  const [step, setStep] = useState<StepNumber>(1);
  const [maxVisited, setMaxVisited] = useState<StepNumber>(1);
  const [draft, setDraft] = useState<CustomPerfumeDraft>(() => createInitialDraft(initialName));
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  // Payment & customer auth dialog after clicking CREATE MY PERFUME
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savedProfile = useProfile((s) => s.details);
  const saveProfile = useProfile((s) => s.save);
  const addOrder = useOrders((s) => s.addOrder);
  const showToast = useToast((s) => s.show);

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

  const [shippingAddress, setShippingAddress] = useState(savedProfile.address);
  const [city, setCity] = useState(savedProfile.city);
  const [stateName, setStateName] = useState(savedProfile.state);
  const [pincode, setPincode] = useState(savedProfile.pincode);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [upiReference, setUpiReference] = useState('');
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [confirmation, setConfirmation] = useState<CustomOrderConfirmation | null>(null);

  const [upiConfig, setUpiConfig] = useState({ vpa: 'makemyperfume@upi', name: 'Make My Perfume' });

  useEffect(() => {
    void initCustomerAuth();
  }, [initCustomerAuth]);

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

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      fullName: prev.fullName || savedProfile.name || customerUser?.fullName || '',
      mobileNumber: prev.mobileNumber || savedProfile.phone || '',
      email: prev.email || savedProfile.email || customerUser?.email || '',
    }));
    setShippingAddress((p) => p || savedProfile.address);
    setCity((p) => p || savedProfile.city);
    setStateName((p) => p || savedProfile.state);
    setPincode((p) => p || savedProfile.pincode);
  }, [savedProfile, customerUser]);

  const activeSize = useMemo(
    () => sizes.find((s) => s.size_ml === draft.bottleSizeMl) ?? sizes.find((s) => s.is_available) ?? sizes[0]!,
    [sizes, draft.bottleSizeMl],
  );

  const orderTotal = activeSize?.price_inr ?? 1290;

  const upiUri = useMemo(() => {
    const p = new URLSearchParams({
      pa: upiConfig.vpa,
      pn: upiConfig.name,
      am: String(orderTotal),
      cu: 'INR',
      tn: 'Personalised Perfume',
    });
    return `upi://pay?${p.toString()}`;
  }, [upiConfig, orderTotal]);

  const qrMatrix = useMemo(() => (paymentMethod === 'upi' ? generateQrMatrix(upiUri) : null), [paymentMethod, upiUri]);

  const goToStep = (next: StepNumber) => {
    setStepErrors({});
    setStep(next);
    setMaxVisited((m) => (next > m ? next : m));
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleNextFrom1 = () => {
    const errs = validateStep1(draft);
    if (Object.keys(errs).length > 0) {
      setStepErrors(errs);
      return;
    }
    goToStep(2);
  };

  const handleNextFrom2 = () => {
    const errs = validateStep2(draft);
    if (Object.keys(errs).length > 0) {
      setStepErrors(errs);
      return;
    }
    goToStep(3);
  };

  const handleNextFrom3 = () => {
    const errs = validateStep3(draft, sizes);
    if (Object.keys(errs).length > 0) {
      setStepErrors(errs);
      return;
    }
    goToStep(4);
  };

  const toggleFamily = (family: string) => {
    setStepErrors((e) => ({ ...e, families: '' }));
    setDraft((prev) => {
      const exists = prev.families.includes(family);
      return {
        ...prev,
        families: exists ? prev.families.filter((f) => f !== family) : [...prev.families, family],
      };
    });
  };

  const toggleNote = (note: string) => {
    setDraft((prev) => {
      const exists = prev.preferredNotes.includes(note);
      return {
        ...prev,
        preferredNotes: exists ? prev.preferredNotes.filter((n) => n !== note) : [...prev.preferredNotes, note],
      };
    });
  };

  const handleCreateClick = (e: FormEvent) => {
    e.preventDefault();
    const s1 = validateStep1(draft);
    const s2 = validateStep2(draft);
    const s3 = validateStep3(draft, sizes);
    const s4 = validateStep4Contact(draft, false);

    if (Object.keys(s1).length) {
      setStep(1);
      setStepErrors(s1);
      return;
    }
    if (Object.keys(s2).length) {
      setStep(2);
      setStepErrors(s2);
      return;
    }
    if (Object.keys(s3).length) {
      setStep(3);
      setStepErrors(s3);
      return;
    }
    if (Object.keys(s4).length) {
      setStepErrors(s4);
      return;
    }

    setStepErrors({});
    setPayErrors({});
    setAuthError(null);
    setAuthNotice(null);
    setAuthName((prev) => prev || draft.fullName);
    setAuthEmail((prev) => prev || draft.email);
    dialogRef.current?.showModal();
  };

  const handleModalAuth = async (e: FormEvent) => {
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
        showToast('Signed in. Choose Cash on Delivery (COD) or UPI to place your order.');
      } else {
        const res = await signUpCustomer(authName, authEmail, authPassword);
        if (res.needsVerification) {
          setAuthTab('login');
          setAuthNotice(`Account created for ${authEmail.trim()}. Please verify your email if prompted, then log in below.`);
        } else {
          showToast('Account created! Select COD or UPI below to confirm.');
        }
      }
      setDraft((prev) => ({
        ...prev,
        email: prev.email || authEmail.trim(),
        fullName: prev.fullName || authName.trim(),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (authTab === 'login' && /invalid login credentials/i.test(msg)) {
        setAuthError('Account not found or incorrect password. If you have not created an account yet, create one below.');
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleConfirmPaymentOrder = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const phoneErr = validateInternationalPhone(draft.mobileNumber);
    if (phoneErr) errs.mobileNumber = phoneErr;
    const emailErr = validateOptionalEmail(draft.email, true);
    if (emailErr) errs.email = emailErr;
    if (shippingAddress.trim().length < 5) errs.shippingAddress = 'Enter your complete delivery address.';
    if (city.trim().length < 2) errs.city = 'Enter your city.';
    if (stateName.trim().length < 2) errs.stateName = 'Enter your state / region.';
    if (!/^[A-Za-z0-9 -]{4,12}$/.test(pincode.trim())) errs.pincode = 'Enter a valid PIN / postal code (4–12 characters).';
    if (paymentMethod === 'upi' && upiReference.trim().length < 6) {
      errs.upiReference = 'Enter the 6–18 character UPI Transaction ID / UTR reference.';
    }

    setPayErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmittingOrder(true);
    try {
      const placed = await submitCustomPerfumeOrder({
        draft,
        shippingAddress,
        city,
        state: stateName,
        pincode,
        paymentMethod,
        upiReference,
      });

      saveProfile({
        name: draft.fullName,
        email: draft.email,
        phone: draft.mobileNumber,
        address: shippingAddress,
        city,
        state: stateName,
        pincode,
      });
      addOrder(placed);
      trackSiteActivity(
        'checkout.started',
        'make',
        placed.requestRef,
        `Personalised perfume ${placed.requestRef} placed via ${paymentMethod.toUpperCase()}`,
      );
      setConfirmation(placed);
      dialogRef.current?.close();
      showToast(`Order ${placed.orderNumber} placed!`);
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      setPayErrors({
        submit: err instanceof Error ? err.message : 'Unable to submit your personalized perfume order right now.',
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (confirmation) {
    return (
      <div className={`${styles.page} page-width`}>
        <section className={styles.successCard} aria-labelledby="custom-success-heading">
          <div className={styles.successIcon}>
            <CheckCircle2 size={32} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <p className="eyebrow eyebrow--lead">Request &amp; Order Confirmed</p>
          <h1 id="custom-success-heading" className={styles.title}>
            Your fragrance journey <em>begins here.</em>
          </h1>
          <p className={styles.lede}>
            Your personalized perfume request has been received. Our team will review your preferences and contact you regarding availability, pricing, and the next steps.
          </p>

          <dl className={styles.refGrid}>
            <div>
              <dt>Request Reference</dt>
              <dd className="tabular">{confirmation.requestRef}</dd>
            </div>
            <div>
              <dt>Order Number</dt>
              <dd className="tabular">{confirmation.orderNumber}</dd>
            </div>
            <div>
              <dt>Invoice Number</dt>
              <dd className="tabular">{confirmation.invoiceNumber}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>
                {confirmation.paymentMethod === 'upi' ? `UPI (${confirmation.upiReference})` : 'Cash on Delivery (COD)'} ·{' '}
                <strong className="tabular">{formatINR(confirmation.totalInr)}</strong>
              </dd>
            </div>
          </dl>

          <div className={styles.emailNotice}>
            <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>
              {confirmation.emailStatus === 'sent'
                ? `Price summary & invoice emailed to ${confirmation.customerEmail}.`
                : `Invoice recorded for ${confirmation.customerEmail} (${confirmation.emailMessage || 'queued in outbox'}). Print or download your official invoice below.`}
            </span>
          </div>

          <div className={styles.successActions}>
            <Button onClick={() => printInvoiceHtml(confirmation.invoiceHtml)}>
              <Printer size={16} strokeWidth={1.5} aria-hidden="true" />
              Print Invoice
            </Button>
            <Button onClick={() => downloadInvoicePdf(confirmation.invoiceNumber, confirmation.invoiceHtml)}>
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              Download Invoice (PDF)
            </Button>
            <Button variant="ghost" onClick={() => downloadInvoiceHtml(confirmation.invoiceNumber, confirmation.invoiceHtml)}>
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              Download HTML
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setConfirmation(null);
                setDraft(createInitialDraft());
                setUpiReference('');
                goToStep(1);
              }}
            >
              Create another perfume
            </Button>
            <ButtonLink to="/collection" variant="quiet" arrow>
              Browse collection
            </ButtonLink>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.page} page-width`}>
      {/* ── SECTION A: INTRODUCTION & STEPPER ──────────────────────────────── */}
      <header className={styles.intro}>
        <p className="eyebrow eyebrow--lead">Bespoke Atelier</p>
        <h1 className={styles.title}>
          Create <em>Your Perfume</em>
        </h1>
        <p className={styles.subtitle}>Your fragrance. Your preferences. Your signature.</p>
        <p className={styles.lede}>
          Discover the fragrance that feels like you. Choose the notes you love, define your preferences, and personalize your bottle.
        </p>

        <nav className={styles.stepper} aria-label="Perfume customization steps">
          <ol className={styles.stepList}>
            {STEPS.map((s) => {
              const isCurrent = step === s.num;
              const isCompleted = step > s.num;
              const canJump = s.num <= maxVisited && s.num !== step;
              return (
                <li key={s.num} className={styles.stepItem}>
                  <button
                    type="button"
                    className={[
                      styles.stepBtn,
                      isCurrent ? styles.stepCurrent : '',
                      isCompleted ? styles.stepDone : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={isCurrent ? 'step' : undefined}
                    disabled={!canJump && !isCurrent}
                    onClick={() => canJump && goToStep(s.num)}
                  >
                    <span className={styles.stepCode}>{s.code}</span>
                    <span className={styles.stepLabel}>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      {/* ── STEP 1: FRAGRANCE PROFILE ──────────────────────────────────────── */}
      {step === 1 && (
        <section className={styles.panel} aria-labelledby="step1-heading">
          <div className={styles.panelHeader}>
            <p className={styles.stepEyebrow}>01 · Fragrance Profile</p>
            <h2 id="step1-heading" className={styles.panelTitle}>
              What kind of scent <em>feels like you?</em>
            </h2>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Preferred fragrance families (select one or more)</legend>
            <div className={styles.familyGrid}>
              {CUSTOM_FAMILIES.map((f) => {
                const selected = draft.families.includes(f.name);
                return (
                  <button
                    key={f.name}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    className={[styles.choiceCard, selected ? styles.choiceSelected : ''].filter(Boolean).join(' ')}
                    onClick={() => toggleFamily(f.name)}
                  >
                    <div className={styles.choiceTop}>
                      <NoteGlyph family={f.name} size={22} className={styles.choiceGlyph} />
                      {selected && (
                        <span className={styles.checkBadge} aria-hidden="true">
                          <Check size={14} strokeWidth={2} />
                        </span>
                      )}
                    </div>
                    <strong className={styles.choiceName}>{f.name}</strong>
                    <span className={styles.choiceDesc}>{f.subtitle}</span>
                  </button>
                );
              })}
            </div>
            {stepErrors.families && (
              <p className={styles.error} role="alert">
                {stepErrors.families}
              </p>
            )}
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Fragrance character (choose one)</legend>
            <div className={styles.optionRow} role="radiogroup" aria-label="Fragrance character">
              {CUSTOM_CHARACTERS.map((c) => {
                const selected = draft.character === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={[styles.optionCard, selected ? styles.choiceSelected : ''].filter(Boolean).join(' ')}
                    onClick={() => {
                      setStepErrors((e) => ({ ...e, character: '' }));
                      setDraft((prev) => ({ ...prev, character: c.value }));
                    }}
                  >
                    <div className={styles.optionHead}>
                      <strong>{c.value}</strong>
                      {selected && <Check size={15} strokeWidth={2} aria-hidden="true" />}
                    </div>
                    <span>{c.detail}</span>
                  </button>
                );
              })}
            </div>
            {stepErrors.character && (
              <p className={styles.error} role="alert">
                {stepErrors.character}
              </p>
            )}
          </fieldset>

          <div className={styles.navActions}>
            <span />
            <Button onClick={handleNextFrom1} arrow>
              Continue
            </Button>
          </div>
        </section>
      )}

      {/* ── STEP 2: SCENT PREFERENCES ──────────────────────────────────────── */}
      {step === 2 && (
        <section className={styles.panel} aria-labelledby="step2-heading">
          <div className={styles.panelHeader}>
            <p className={styles.stepEyebrow}>02 · Scent Preferences</p>
            <h2 id="step2-heading" className={styles.panelTitle}>
              Define <em>Your Scent</em>
            </h2>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Preferred fragrance notes (optional)</legend>
            <p className={styles.hint}>
              These notes serve as preference guides for your consultation rather than verified raw ingredients.
            </p>
            <div className={styles.chipsWrap}>
              {CUSTOM_NOTES.map((note) => {
                const selected = draft.preferredNotes.includes(note);
                return (
                  <button
                    key={note}
                    type="button"
                    aria-pressed={selected}
                    className={[styles.chip, selected ? styles.chipActive : ''].filter(Boolean).join(' ')}
                    onClick={() => toggleNote(note)}
                  >
                    {selected && <Check size={14} strokeWidth={2} aria-hidden="true" />}
                    {note}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="notes-to-avoid">Notes to avoid (optional)</label>
            <input
              id="notes-to-avoid"
              type="text"
              maxLength={250}
              placeholder="Any scents you dislike?"
              value={draft.notesToAvoid}
              onChange={(e) => setDraft((p) => ({ ...p, notesToAvoid: e.target.value }))}
            />
            <span className={styles.hint}>Example: Heavy vanilla, strong musk, smoky notes.</span>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Fragrance intensity (required)</legend>
            <div className={styles.optionRow} role="radiogroup" aria-label="Fragrance intensity">
              {CUSTOM_INTENSITIES.map((i) => {
                const selected = draft.intensity === i.value;
                return (
                  <button
                    key={i.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={[styles.optionCard, selected ? styles.choiceSelected : ''].filter(Boolean).join(' ')}
                    onClick={() => {
                      setStepErrors((e) => ({ ...e, intensity: '' }));
                      setDraft((prev) => ({ ...prev, intensity: i.value }));
                    }}
                  >
                    <div className={styles.optionHead}>
                      <strong>{i.value}</strong>
                      {selected && <Check size={15} strokeWidth={2} aria-hidden="true" />}
                    </div>
                    <span>{i.detail}</span>
                  </button>
                );
              })}
            </div>
            {stepErrors.intensity && (
              <p className={styles.error} role="alert">
                {stepErrors.intensity}
              </p>
            )}
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Occasion (optional)</legend>
            <div className={styles.chipsWrap}>
              {CUSTOM_OCCASIONS.map((occ) => {
                const selected = draft.occasion === occ;
                return (
                  <button
                    key={occ}
                    type="button"
                    aria-pressed={selected}
                    className={[styles.chip, selected ? styles.chipActive : ''].filter(Boolean).join(' ')}
                    onClick={() => setDraft((prev) => ({ ...prev, occasion: selected ? '' : occ }))}
                  >
                    {selected && <Check size={14} strokeWidth={2} aria-hidden="true" />}
                    {occ}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className={styles.navActions}>
            <Button variant="ghost" onClick={() => goToStep(1)}>
              Back
            </Button>
            <Button onClick={handleNextFrom2} arrow>
              Continue
            </Button>
          </div>
        </section>
      )}

      {/* ── STEP 3: PERSONALIZE YOUR BOTTLE ────────────────────────────────── */}
      {step === 3 && (
        <section className={styles.panel} aria-labelledby="step3-heading">
          <div className={styles.panelHeader}>
            <p className={styles.stepEyebrow}>03 · Personalize Your Bottle</p>
            <h2 id="step3-heading" className={styles.panelTitle}>
              Make It <em>Yours</em>
            </h2>
          </div>

          <div className={styles.bottleLayout}>
            <div className={styles.bottleControls}>
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Bottle size</legend>
                <p className={styles.hint}>
                  Provisional studio rates shown for consultation; final availability and pricing are confirmed by our team.
                </p>
                <div className={styles.sizeRow} role="radiogroup" aria-label="Bottle size">
                  {sizes.map((s) => {
                    const selected = draft.bottleSizeMl === s.size_ml;
                    return (
                      <button
                        key={s.size_ml}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!s.is_available}
                        className={[styles.sizeCard, selected ? styles.choiceSelected : ''].filter(Boolean).join(' ')}
                        onClick={() => {
                          setStepErrors((e) => ({ ...e, bottleSizeMl: '' }));
                          setDraft((p) => ({ ...p, bottleSizeMl: s.size_ml }));
                        }}
                      >
                        <strong className={styles.sizeLabel}>{s.label}</strong>
                        <span className="tabular">{formatINR(s.price_inr)}</span>
                        <small>{s.is_provisional ? 'Provisional rate' : 'Confirmed'}</small>
                      </button>
                    );
                  })}
                </div>
                {stepErrors.bottleSizeMl && (
                  <p className={styles.error} role="alert">
                    {stepErrors.bottleSizeMl}
                  </p>
                )}
              </fieldset>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="bottle-label-name">Name Your Fragrance</label>
                  <span className={styles.counter}>
                    {draft.bottleLabel.length} / {BOTTLE_LABEL_MAX}
                  </span>
                </div>
                <input
                  id="bottle-label-name"
                  type="text"
                  maxLength={BOTTLE_LABEL_MAX}
                  placeholder="Enter your signature fragrance name"
                  value={draft.bottleLabel}
                  onChange={(e) => {
                    setStepErrors((er) => ({ ...er, bottleLabel: '' }));
                    setDraft((p) => ({ ...p, bottleLabel: e.target.value }));
                  }}
                />
                {stepErrors.bottleLabel ? (
                  <p className={styles.error} role="alert">
                    {stepErrors.bottleLabel}
                  </p>
                ) : (
                  <span className={styles.hint}>Optional. Shown live on your illustrative bottle label.</span>
                )}
              </div>

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Packaging</legend>
                <div className={styles.optionRow} role="radiogroup" aria-label="Packaging">
                  {CUSTOM_PACKAGING.map((pkg) => {
                    const selected = draft.packaging === pkg.value;
                    return (
                      <button
                        key={pkg.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={[styles.optionCard, selected ? styles.choiceSelected : ''].filter(Boolean).join(' ')}
                        onClick={() => setDraft((p) => ({ ...p, packaging: pkg.value }))}
                      >
                        <div className={styles.optionHead}>
                          <strong>{pkg.value}</strong>
                          {selected && <Check size={15} strokeWidth={2} aria-hidden="true" />}
                        </div>
                        <span>{pkg.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className={styles.field}>
                <label htmlFor="additional-instructions">Anything else we should know? (optional)</label>
                <textarea
                  id="additional-instructions"
                  rows={3}
                  maxLength={600}
                  placeholder="Tell us more about the fragrance you have in mind..."
                  value={draft.additionalInstructions}
                  onChange={(e) => setDraft((p) => ({ ...p, additionalInstructions: e.target.value }))}
                />
              </div>
            </div>

            <aside className={styles.previewPane} aria-label="Illustrative bottle preview">
              <BottlePreview name={draft.bottleLabel} accent={draft.families[0]} />
              <p className={styles.previewCaption}>
                Illustrative studio bottle preview for <strong>{draft.bottleLabel.trim() || 'Your name'}</strong> ({draft.bottleSizeMl ?? 50} ml). Final label print layout is confirmed before production.
              </p>
            </aside>
          </div>

          <div className={styles.navActions}>
            <Button variant="ghost" onClick={() => goToStep(2)}>
              Back
            </Button>
            <Button onClick={handleNextFrom3} arrow>
              Continue
            </Button>
          </div>
        </section>
      )}

      {/* ── STEP 4: REVIEW YOUR PERFUME & CONTACT ──────────────────────────── */}
      {step === 4 && (
        <form className={styles.panel} onSubmit={handleCreateClick} noValidate aria-labelledby="step4-heading">
          <div className={styles.panelHeader}>
            <p className={styles.stepEyebrow}>04 · Review &amp; Create</p>
            <h2 id="step4-heading" className={styles.panelTitle}>
              Your Signature <em>Fragrance</em>
            </h2>
          </div>

          <div className={styles.reviewLayout}>
            <div className={styles.summaryCol}>
              <div className={styles.summaryGroup}>
                <div className={styles.summaryHead}>
                  <h3>01. Fragrance Profile</h3>
                  <button type="button" className={styles.editBtn} onClick={() => goToStep(1)}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </button>
                </div>
                <dl className={styles.summaryList}>
                  <div>
                    <dt>Fragrance families</dt>
                    <dd>{draft.families.join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Fragrance character</dt>
                    <dd>{draft.character}</dd>
                  </div>
                </dl>
              </div>

              <div className={styles.summaryGroup}>
                <div className={styles.summaryHead}>
                  <h3>02. Scent Preferences</h3>
                  <button type="button" className={styles.editBtn} onClick={() => goToStep(2)}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </button>
                </div>
                <dl className={styles.summaryList}>
                  <div>
                    <dt>Preferred notes</dt>
                    <dd>{draft.preferredNotes.length ? draft.preferredNotes.join(', ') : 'None selected'}</dd>
                  </div>
                  <div>
                    <dt>Notes to avoid</dt>
                    <dd>{draft.notesToAvoid.trim() || 'None specified'}</dd>
                  </div>
                  <div>
                    <dt>Intensity</dt>
                    <dd>{draft.intensity}</dd>
                  </div>
                  <div>
                    <dt>Occasion</dt>
                    <dd>{draft.occasion || 'Not specified'}</dd>
                  </div>
                </dl>
              </div>

              <div className={styles.summaryGroup}>
                <div className={styles.summaryHead}>
                  <h3>03. Personalize Your Bottle</h3>
                  <button type="button" className={styles.editBtn} onClick={() => goToStep(3)}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </button>
                </div>
                <dl className={styles.summaryList}>
                  <div>
                    <dt>Bottle size</dt>
                    <dd>
                      {activeSize?.label} ({formatINR(orderTotal)} provisional studio rate)
                    </dd>
                  </div>
                  <div>
                    <dt>Personalized perfume name</dt>
                    <dd>{draft.bottleLabel.trim() || 'House signature label'}</dd>
                  </div>
                  <div>
                    <dt>Packaging</dt>
                    <dd>{draft.packaging}</dd>
                  </div>
                  <div>
                    <dt>Additional instructions</dt>
                    <dd>{draft.additionalInstructions.trim() || 'None'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className={styles.contactCol}>
              <h3 className={styles.contactHeading}>Customer Contact Information</h3>
              <p className={styles.hint}>Provide your contact details, then choose UPI or Cash on Delivery (COD) to send your request to our studio.</p>

              <div className={styles.field}>
                <label htmlFor="cp-full-name">Full Name</label>
                <input
                  id="cp-full-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={draft.fullName}
                  onChange={(e) => {
                    setStepErrors((er) => ({ ...er, fullName: '' }));
                    setDraft((p) => ({ ...p, fullName: e.target.value }));
                  }}
                />
                {stepErrors.fullName && (
                  <span className={styles.error} role="alert">
                    {stepErrors.fullName}
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="cp-mobile">Mobile / WhatsApp Number</label>
                <input
                  id="cp-mobile"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98400 12345 or +44 7911 123456"
                  required
                  value={draft.mobileNumber}
                  onChange={(e) => {
                    setStepErrors((er) => ({ ...er, mobileNumber: '' }));
                    setDraft((p) => ({ ...p, mobileNumber: e.target.value }));
                  }}
                />
                {stepErrors.mobileNumber && (
                  <span className={styles.error} role="alert">
                    {stepErrors.mobileNumber}
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="cp-email">Email Address (optional for review; used for invoice email)</label>
                <input
                  id="cp-email"
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(e) => {
                    setStepErrors((er) => ({ ...er, email: '' }));
                    setDraft((p) => ({ ...p, email: e.target.value }));
                  }}
                />
                {stepErrors.email && (
                  <span className={styles.error} role="alert">
                    {stepErrors.email}
                  </span>
                )}
              </div>

              <label className={styles.consentLabel}>
                <input
                  type="checkbox"
                  checked={draft.consentAccepted}
                  onChange={(e) => {
                    setStepErrors((er) => ({ ...er, consentAccepted: '' }));
                    setDraft((p) => ({ ...p, consentAccepted: e.target.checked }));
                  }}
                />
                <span>I agree to be contacted about my personalized perfume request and acknowledge the Privacy Policy.</span>
              </label>
              {stepErrors.consentAccepted && (
                <p className={styles.error} role="alert">
                  {stepErrors.consentAccepted}
                </p>
              )}

              <div className={styles.finalActions}>
                <Button variant="ghost" onClick={() => goToStep(3)}>
                  Back
                </Button>
                <Button type="submit" className={styles.createBtn} disabled={submittingOrder}>
                  CREATE MY PERFUME
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── POST-CREATE PAYMENT & ACCOUNT DIALOG ───────────────────────────── */}
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="custom-pay-title">
        <button type="button" className={styles.dialogClose} onClick={() => dialogRef.current?.close()} aria-label="Close">
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>

        {!customerUser ? (
          <form className={styles.modalForm} onSubmit={handleModalAuth} noValidate>
            <div>
              <h2 id="custom-pay-title" className={styles.dialogTitle}>
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
              <p className={styles.hint}>
                Sign in or create an account before selecting Cash on Delivery (COD) or UPI payment for your personalised perfume.
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

            {authTab === 'register' && (
              <div className={styles.field}>
                <label htmlFor="mk-auth-name">Full name</label>
                <input id="mk-auth-name" value={authName} onChange={(e) => setAuthName(e.target.value)} autoComplete="name" required />
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor="mk-auth-email">Email</label>
              <input id="mk-auth-email" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="mk-auth-password">Password</label>
              <input
                id="mk-auth-password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {authNotice && <p className={styles.emailNotice}>{authNotice}</p>}
            {authError && <p className={styles.error}>{authError}</p>}

            <div className={styles.authActions}>
              <Button type="submit" disabled={authBusy}>
                {authBusy ? 'Please wait...' : authTab === 'login' ? 'Log in & continue' : 'Create account & continue'}
              </Button>
              <button
                type="button"
                className={styles.linkBtn}
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
          <form className={styles.modalForm} onSubmit={handleConfirmPaymentOrder} noValidate>
            <div className={styles.signedInBar}>
              <span>
                Signed in as <strong>{customerUser.email}</strong>
              </span>
              <button type="button" className={styles.linkBtn} onClick={() => void signOutCustomer()}>
                Switch account
              </button>
            </div>

            <div>
              <h2 id="custom-pay-title" className={styles.dialogTitle}>
                Payment &amp; <em>Delivery.</em>
              </h2>
              <p className={styles.hint}>
                {draft.bottleLabel.trim() || 'Personalised Perfume'} ({activeSize?.label}) · Provisional total:{' '}
                <strong className="tabular">{formatINR(orderTotal)}</strong>
              </p>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.wide}`}>
                <label htmlFor="mk-order-email">Email (for price breakdown &amp; invoice)</label>
                <input
                  id="mk-order-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                  autoComplete="email"
                />
                {payErrors.email && <span className={styles.error}>{payErrors.email}</span>}
              </div>
              <div className={`${styles.field} ${styles.wide}`}>
                <label htmlFor="mk-address">Delivery address</label>
                <input
                  id="mk-address"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  autoComplete="street-address"
                />
                {payErrors.shippingAddress && <span className={styles.error}>{payErrors.shippingAddress}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="mk-city">City</label>
                <input id="mk-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
                {payErrors.city && <span className={styles.error}>{payErrors.city}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="mk-state">State / Region</label>
                <input id="mk-state" value={stateName} onChange={(e) => setStateName(e.target.value)} autoComplete="address-level1" />
                {payErrors.state && <span className={styles.error}>{payErrors.state}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="mk-pincode">PIN / Postal code</label>
                <input id="mk-pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} autoComplete="postal-code" />
                {payErrors.pincode && <span className={styles.error}>{payErrors.pincode}</span>}
              </div>
            </div>

            <fieldset className={styles.paymentGroup}>
              <legend className={styles.legend}>Choose Payment Method</legend>
              <div className={styles.paymentOptions}>
                <label className={styles.payCard}>
                  <input
                    type="radio"
                    name="customPaymentMethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <Truck size={18} strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <strong>Cash on Delivery (COD)</strong>
                    <span>Pay when your bespoke perfume arrives.</span>
                  </div>
                </label>

                <label className={styles.payCard}>
                  <input
                    type="radio"
                    name="customPaymentMethod"
                    value="upi"
                    checked={paymentMethod === 'upi'}
                    onChange={() => setPaymentMethod('upi')}
                  />
                  <Smartphone size={18} strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <strong>UPI (GPay, PhonePe, Paytm, BHIM)</strong>
                    <span>Scan QR or pay via UPI ID &amp; enter your UTR reference.</span>
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
                    aria-label={`UPI QR code to pay ${formatINR(orderTotal)} to ${upiConfig.vpa}`}
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
                    <QrCode size={15} strokeWidth={1.5} aria-hidden="true" /> Pay <span className="tabular">{formatINR(orderTotal)}</span> via UPI
                  </p>
                  <div className={styles.vpaRow}>
                    <code>{upiConfig.vpa}</code>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => {
                        navigator.clipboard?.writeText(upiConfig.vpa);
                        showToast('UPI ID copied.');
                      }}
                    >
                      <Copy size={13} strokeWidth={1.5} aria-hidden="true" /> Copy
                    </button>
                  </div>
                  <a href={upiUri} className={styles.upiAppLink}>
                    Open UPI app on device
                  </a>
                  <div className={styles.field}>
                    <label htmlFor="mk-utr">UPI Transaction ID / UTR Reference</label>
                    <input
                      id="mk-utr"
                      placeholder="e.g. 412890123456"
                      value={upiReference}
                      onChange={(e) => setUpiReference(e.target.value)}
                    />
                    {payErrors.upiReference && <span className={styles.error}>{payErrors.upiReference}</span>}
                  </div>
                </div>
              </div>
            )}

            {payErrors.submit && <p className={styles.error}>{payErrors.submit}</p>}

            <div className={styles.submitRow}>
              <Button type="submit" disabled={submittingOrder}>
                <ShieldCheck size={16} strokeWidth={1.5} aria-hidden="true" />
                {submittingOrder ? 'Submitting order...' : `Confirm & place custom order (${formatINR(orderTotal)})`}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
