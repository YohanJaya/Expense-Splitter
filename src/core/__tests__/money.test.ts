import { describe, it, expect } from 'vitest';
import { toCents, formatLKR, formatSigned } from '../money';

describe('toCents', () => {
  it('parses plain integers', () => {
    expect(toCents('12000')).toBe(1200000);
  });

  it('parses amounts with commas', () => {
    expect(toCents('12,000.00')).toBe(1200000);
  });

  it('parses decimals correctly, avoiding float drift', () => {
    expect(toCents('19.99')).toBe(1999);
  });

  it('pads a single decimal digit', () => {
    expect(toCents('5.5')).toBe(550);
  });

  it('truncates extra decimal digits', () => {
    expect(toCents('5.999')).toBe(599);
  });

  it('rejects negative input', () => {
    expect(() => toCents('-5')).toThrow();
  });

  it('rejects non-numeric input', () => {
    expect(() => toCents('abc')).toThrow();
  });
});

describe('formatLKR', () => {
  it('formats cents with thousands separators', () => {
    expect(formatLKR(1200000)).toBe('Rs. 12,000.00');
  });

  it('formats zero', () => {
    expect(formatLKR(0)).toBe('Rs. 0.00');
  });
});

describe('formatSigned', () => {
  it('formats positive balances with a plus sign', () => {
    expect(formatSigned(566667)).toBe('+Rs. 5,666.67');
  });

  it('formats negative balances with a minus sign', () => {
    expect(formatSigned(-50)).toBe('-Rs. 0.50');
  });

  it('formats zero without a sign', () => {
    expect(formatSigned(0)).toBe('Rs. 0.00');
  });
});
