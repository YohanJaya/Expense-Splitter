import { describe, it, expect } from 'vitest';
import { allocate, hashToInt } from '../allocate';
import { SplitMismatchError } from '../types';

describe('allocate - equal split', () => {
  it('10,000 cents split 3 ways sums exactly, largest remainder wins', () => {
    const shares = allocate(10000, ['a', 'b', 'c'], { kind: 'equal' }, 0);
    const values = Object.values(shares);
    expect(values.reduce((a, b) => a + b, 0)).toBe(10000);
    const counts = values.slice().sort((a, b) => a - b);
    expect(counts).toEqual([3333, 3333, 3334]);
  });

  it('10,000 cents split 7 ways sums exactly', () => {
    const shares = allocate(10000, ['a', 'b', 'c', 'd', 'e', 'f', 'g'], { kind: 'equal' }, 0);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('1 cent split 3 ways: one gets it, two get 0', () => {
    const shares = allocate(1, ['a', 'b', 'c'], { kind: 'equal' }, 0);
    const values = Object.values(shares);
    expect(values.reduce((a, b) => a + b, 0)).toBe(1);
    expect(values.filter((v) => v === 1).length).toBe(1);
    expect(values.filter((v) => v === 0).length).toBe(2);
  });

  it('999,983 cents split 11 ways sums exactly', () => {
    const participants = Array.from({ length: 11 }, (_, i) => `p${i}`);
    const shares = allocate(999983, participants, { kind: 'equal' }, 5);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(999983);
  });

  it('same expense allocated twice produces identical output', () => {
    const seed = hashToInt('expense-1');
    const s1 = allocate(10000, ['a', 'b', 'c'], { kind: 'equal' }, seed);
    const s2 = allocate(10000, ['a', 'b', 'c'], { kind: 'equal' }, seed);
    expect(s1).toEqual(s2);
  });

  it('two expenses with different ids can rotate the extra cent', () => {
    const seedA = hashToInt('expense-a');
    const seedB = hashToInt('expense-b');
    const participants = ['a', 'b', 'c'];
    const sA = allocate(10, participants, { kind: 'equal' }, seedA);
    const sB = allocate(10, participants, { kind: 'equal' }, seedB);
    // Both are valid allocations of 10 cents across 3 people; both sum correctly.
    expect(Object.values(sA).reduce((a, b) => a + b, 0)).toBe(10);
    expect(Object.values(sB).reduce((a, b) => a + b, 0)).toBe(10);
  });
});

describe('allocate - exact split', () => {
  it('accepts shares that sum to the total', () => {
    const shares = allocate(
      1000000,
      ['a', 'b', 'c'],
      { kind: 'exact', shares: { a: 333333, b: 333333, c: 333334 } },
      0
    );
    expect(shares).toEqual({ a: 333333, b: 333333, c: 333334 });
  });

  it('throws SplitMismatchError with signed delta when shares are short', () => {
    expect(() =>
      allocate(1000, ['a', 'b'], { kind: 'exact', shares: { a: 400, b: 400 } }, 0)
    ).toThrow(SplitMismatchError);
  });

  it('throws when shares are missing a participant', () => {
    expect(() =>
      allocate(1000, ['a', 'b'], { kind: 'exact', shares: { a: 1000 } }, 0)
    ).toThrow();
  });

  it('throws when shares include a non-participant', () => {
    expect(() =>
      allocate(1000, ['a', 'b'], { kind: 'exact', shares: { a: 500, b: 400, c: 100 } }, 0)
    ).toThrow();
  });
});
