import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeBalances } from '../balances';
import { settleUp } from '../settle';
import { allocate, hashToInt } from '../allocate';
import type { AppState, Expense, PersonId } from '../types';

function personIds(n: number): PersonId[] {
  return Array.from({ length: n }, (_, i) => `p${i}`);
}

const arbState = fc
  .integer({ min: 2, max: 10 })
  .chain((peopleCount) => {
    const ids = personIds(peopleCount);
    const arbExpense = fc
      .record({
        idSuffix: fc.uuid(),
        amount: fc.integer({ min: 0, max: 10_000_000 }),
        paidBy: fc.constantFrom(...ids),
        participants: fc.uniqueArray(fc.constantFrom(...ids), { minLength: 1 }),
      })
      .map(({ idSuffix, amount, paidBy, participants }) => {
        const isExact = idSuffix.charCodeAt(0) % 2 === 0;
        if (!isExact) {
          return {
            id: `e-${idSuffix}`,
            description: 'expense',
            amount,
            paidBy,
            participants,
            split: { kind: 'equal' as const },
          } satisfies Expense;
        }
        // Build a valid exact split that sums to `amount` using largest-remainder,
        // so exact-split expenses are always well-formed inputs.
        const shares = allocate(amount, participants, { kind: 'equal' }, hashToInt(idSuffix));
        return {
          id: `e-${idSuffix}`,
          description: 'expense',
          amount,
          paidBy,
          participants,
          split: { kind: 'exact' as const, shares },
        } satisfies Expense;
      });

    return fc.array(arbExpense, { minLength: 0, maxLength: 40 }).map(
      (expenses): AppState => ({
        people: ids.map((id) => ({ id, name: id })),
        expenses,
        settlements: [],
      })
    );
  });

describe('property: balances and settlement invariants', () => {
  it('balances always sum to exactly zero', () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const balances = computeBalances(state);
        const sum = [...balances.values()].reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);
      })
    );
  });

  it('every allocation sums to its expense total', () => {
    fc.assert(
      fc.property(arbState, (state) => {
        for (const expense of state.expenses) {
          const shares = allocate(
            expense.amount,
            expense.participants,
            expense.split,
            hashToInt(expense.id)
          );
          const sum = Object.values(shares).reduce((a, b) => a + b, 0);
          expect(sum).toBe(expense.amount);
        }
      })
    );
  });

  it('sum of transfer amounts equals sum of positive balances', () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const balances = computeBalances(state);
        const transfers = settleUp(balances);
        const totalTransferred = transfers.reduce((a, t) => a + t.amount, 0);
        const totalPositive = [...balances.values()]
          .filter((v) => v > 0)
          .reduce((a, v) => a + v, 0);
        expect(totalTransferred).toBe(totalPositive);
      })
    );
  });

  it('applying all transfers leaves every person at exactly zero', () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const balances = computeBalances(state);
        const transfers = settleUp(balances);
        const final = new Map(balances);
        for (const t of transfers) {
          final.set(t.from, (final.get(t.from) ?? 0) + t.amount);
          final.set(t.to, (final.get(t.to) ?? 0) - t.amount);
        }
        for (const v of final.values()) expect(v).toBe(0);
      })
    );
  });

  it('never emits more than people.length - 1 transfers', () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const balances = computeBalances(state);
        const transfers = settleUp(balances);
        expect(transfers.length).toBeLessThanOrEqual(state.people.length - 1);
      })
    );
  });
});
