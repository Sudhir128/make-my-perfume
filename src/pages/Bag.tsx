import { useRef } from 'react';
import { Link } from 'react-router';
import { Trash2, X } from 'lucide-react';
import { productImage } from '../data/productImages';
import { formatINR } from '../lib/format';
import { itemCount, subtotal } from '../lib/pricing';
import { useBag } from '../store/bag';
import { useToast } from '../store/toast';
import { Button, ButtonLink } from '../components/Button';
import { ImageryPending } from '../components/ImageryPending';
import { QuantityStepper } from '../components/QuantityStepper';
import styles from './Bag.module.css';

export default function Bag() {
  const lines = useBag((s) => s.lines);
  const setQty = useBag((s) => s.setQty);
  const remove = useBag((s) => s.remove);
  const restore = useBag((s) => s.restore);
  const show = useToast((s) => s.show);
  const dialog = useRef<HTMLDialogElement>(null);
  const count = itemCount(lines);
  const total = subtotal(lines);

  if (lines.length === 0) {
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
      <h1 className={styles.title}>
        Your <em>bag.</em>
      </h1>
      <div className={styles.layout}>
        <ul className={styles.lines} aria-label="Items in your bag">
          {lines.map((l) => (
            <li key={l.id} className={styles.line}>
              <Link to={`/product/${l.slug}`} className={styles.thumb} tabIndex={-1} aria-hidden="true">
                {productImage(l.slug) ? (
                  <img className={`${styles.photo} shoulder-mask`} src={productImage(l.slug)!.src} srcSet={productImage(l.slug)!.srcSet} sizes="104px" width={480} height={480} alt="" loading="lazy" decoding="async" />
                ) : (
                  <ImageryPending subject={l.name} family={l.collection} shape="shoulder" ratio="1 / 1" />
                )}
              </Link>
              <div className={styles.lineBody}>
                <p className={styles.family}>{l.collection}</p>
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
            <div className={styles.subtotal}>
              <dt>Subtotal</dt>
              <dd className="tabular">{formatINR(total)}</dd>
            </div>
          </dl>
          <Button className={styles.checkout} onClick={() => dialog.current?.showModal()}>
            Checkout
          </Button>
          <ButtonLink to="/collection" variant="quiet" arrow>
            Continue shopping
          </ButtonLink>
        </aside>
      </div>

      <dialog ref={dialog} className={styles.dialog} aria-labelledby="checkout-title">
        <button type="button" className={styles.dialogClose} onClick={() => dialog.current?.close()} aria-label="Close">
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <h2 id="checkout-title" className={styles.dialogTitle}>
          Checkout is <em>coming soon.</em>
        </h2>
        <p className={styles.muted}>
          Online payment is not available yet, so no order has been placed and nothing has been charged. Your bag is
          saved on this device.
        </p>
        <Button onClick={() => dialog.current?.close()}>Back to bag</Button>
      </dialog>
    </div>
  );
}
