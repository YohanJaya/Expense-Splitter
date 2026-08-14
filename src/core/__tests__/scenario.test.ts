import { describe, it, expect } from 'vitest';
import { computeBalances } from '../balances';
import { settleUp } from '../settle';
import type { AppState } from '../types';

describe('brief acceptance scenario', () => {
  const state: AppState = {
    people: [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
      { id: 'carol', name: 'Carol' },
      { id: 'dave', name: 'Dave' },
    ],
    expenses: [
      {
        id: 'e1',
        description: 'Groceries',
        amount: 1200000,
        paidBy: 'alice',
        participants: ['alice', 'bob', 'carol', 'dave'],
        split: { kind: 'equal' },
      },
      {
        id: 'e2',
        description: 'Hotel',
        amount: 1000000,
        paidBy: 'carol',
        participants: ['alice', 'bob', 'dave'],
        split: {
          kind: 'exact',
          shares: { alice: 333333, bob: 333333, dave: 333334 },
        },
      },
      {
        id: 'e3',
        description: 'Taxi',
        amount: 600000,
        paidBy: 'dave',
        participants: ['dave', 'bob'],
        split: { kind: 'equal' },
      },
    ],
    settlements: [],
  };

  it('produces the exact expected balances in cents', () => {
    const balances = computeBalances(state);
    expect(balances.get('alice')).toBe(566667);
    expect(balances.get('carol')).toBe(700000);
    expect(balances.get('dave')).toBe(-333334);
    expect(balances.get('bob')).toBe(-933333);

    const sum = [...balances.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it('settles in exactly 3 transfers, the proven minimum', () => {
    const balances = computeBalances(state);
    const transfers = settleUp(balances);
    expect(transfers.length).toBe(3);

    // Every transfer amount is positive and the total matches total owed.
    for (const t of transfers) expect(t.amount).toBeGreaterThan(0);
    const totalTransferred = transfers.reduce((a, t) => a + t.amount, 0);
    const totalOwed = [...balances.values()]
      .filter((v) => v > 0)
      .reduce((a, v) => a + v, 0);
    expect(totalTransferred).toBe(totalOwed);

    // Applying all transfers zeroes every balance.
    const final = new Map(balances);
    for (const t of transfers) {
      final.set(t.from, (final.get(t.from) ?? 0) + t.amount);
      final.set(t.to, (final.get(t.to) ?? 0) - t.amount);
    }
    for (const v of final.values()) expect(v).toBe(0);
  });
});
