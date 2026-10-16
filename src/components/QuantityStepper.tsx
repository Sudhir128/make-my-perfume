import { Minus, Plus } from 'lucide-react';
import { MAX_QTY } from '../lib/pricing';
import styles from './QuantityStepper.module.css';

interface QuantityStepperProps {
  value: number;
  onChange: (qty: number) => void;
  /** Names what is being counted, for screen readers ("Amber Veil"). */
  label: string;
  size?: 'md' | 'sm';
}

/** 1 to 10, with buttons that disable at the ends and a live value. */
export function QuantityStepper({ value, onChange, label, size = 'md' }: QuantityStepperProps) {
  return (
    <div className={[styles.stepper, size === 'sm' ? styles.sm : ''].join(' ')} role="group" aria-label={`Quantity, ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`Decrease quantity of ${label}`}>
        <Minus size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <output className="tabular" aria-live="polite" aria-label={`Quantity ${value}`}>
        {value}
      </output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= MAX_QTY} aria-label={`Increase quantity of ${label}`}>
        <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
