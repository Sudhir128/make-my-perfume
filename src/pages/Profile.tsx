import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Package, ShoppingBag, UserRound } from 'lucide-react';
import { itemCount } from '../lib/pricing';
import { useBag } from '../store/bag';
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
  const show = useToast((s) => s.show);
  const [form, setForm] = useState<ProfileDetails>(saved);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileDetails, string>>>({});

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
            <p className={styles.muted}>No orders yet.</p>
            <Link to="/collection" className={styles.link}>
              Find your signature
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
