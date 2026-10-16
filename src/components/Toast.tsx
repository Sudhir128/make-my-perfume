import { useEffect } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { useToast } from '../store/toast';
import styles from './Toast.module.css';

const LIFETIME_MS = 6000;

/** One polite live region, always mounted, so screen readers hear each message. */
export function Toast() {
  const toast = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismiss, LIFETIME_MS);
    return () => window.clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`${styles.toast} noir`}>
          <p className={styles.message}>{toast.message}</p>
          {toast.action?.to && (
            <Link to={toast.action.to} className={styles.action} onClick={dismiss}>
              {toast.action.label}
            </Link>
          )}
          {toast.action?.onAction && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action?.onAction?.();
                dismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className={styles.close} onClick={dismiss} aria-label="Dismiss message">
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
