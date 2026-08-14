import { describe, it, expect } from 'vitest';
import { settleUp } from '../settle';
import type { Cents, PersonId } from '../types';

function balancesOf(pairs: [PersonId, Cents][]): Map<PersonId, Cents> {
  return new Map(pairs);
}

describe('settleUp - correctness', () => {
  it('never emits more than n-1 transfers', () => {
    const balances = balancesOf([
      ['a', 500],
      ['b', -200],
      ['c', -100],
      ['d', -200],
    ]);
    const transfers = settleUp(balances);
    expect(transfers.length).toBeLessThanOrEqual(3);
  });

  it('every transfer amount is strictly positive', () => {
    const balances = balancesOf([
      ['a', 700],
      ['b', -300],
      ['c', -400],
    ]);
    const transfers = settleUp(balances);
    for (const t of transfers) expect(t.amount).toBeGreaterThan(0);
  });

  it('+7,-3,-4,+5,-5 settles in 3 transfers via independent zero-sum groups', () => {
    const balances = balancesOf([
      ['a', 7],
      ['b', -3],
      ['c', -4],
      ['d', 5],
      ['e', -5],
    ]);
    const transfers = settleUp(balances);
    expect(transfers.length).toBe(3);
  });

  it('already-settled group produces an empty transfer list', () => {
    const balances = balancesOf([
      ['a', 0],
      ['b', 0],
    ]);
    expect(settleUp(balances)).toEqual([]);
  });

  it('two people, equal and opposite, settle in exactly one transfer', () => {
    const balances = balancesOf([
      ['a', 500],
      ['b', -500],
    ]);
    const transfers = settleUp(balances);
    expect(transfers).toEqual([{ from: 'b', to: 'a', amount: 500 }]);
  });
});
