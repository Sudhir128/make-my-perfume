export interface PricedLine {
  unitPrice: number;
  qty: number;
}

export const MAX_QTY = 10;

export const clampQty = (qty: number) => Math.min(MAX_QTY, Math.max(1, Math.round(qty) || 1));

/** Sum of line totals in whole rupees. No shipping or tax: out of scope. */
export function subtotal(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
}

export function itemCount(lines: readonly PricedLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}
