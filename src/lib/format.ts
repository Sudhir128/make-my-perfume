const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹1,490 style. Prices in this prototype are whole rupees. */
export function formatINR(amount: number): string {
  return inr.format(amount);
}
