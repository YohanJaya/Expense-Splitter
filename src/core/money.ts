import type { Cents } from './types';

/**
 * Parses a user-entered rupee amount into integer cents.
 * Accepts "12000", "12,000", "12000.5", "12,000.00".
 * Throws on negative or non-numeric input.
 */
export function toCents(input: string): Cents {
  const cleaned = input.replace(/,/g, '').trim();
  if (!/^\d+(\.\d*)?$/.test(cleaned)) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  const [intPart, fracPartRaw = ''] = cleaned.split('.');
  const fracPart = (fracPartRaw + '00').slice(0, 2);
  return Number(intPart) * 100 + Number(fracPart);
}

/** Formats cents as "Rs. 12,000.00". Negative values are shown as-is (no sign). */
export function formatLKR(c: Cents): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const rupees = Math.floor(abs / 100);
  const cents = abs % 100;
  const rupeesStr = rupees.toLocaleString('en-US');
  return `${sign}Rs. ${rupeesStr}.${String(cents).padStart(2, '0')}`;
}

/** Formats a signed balance as "+Rs. 5,666.67" or "-Rs. 9,333.33". */
export function formatSigned(c: Cents): string {
  if (c === 0) return formatLKR(0);
  const sign = c > 0 ? '+' : '-';
  return `${sign}${formatLKR(Math.abs(c))}`;
}
