import type { AppState, Cents, PersonId } from './types';
import { allocate, hashToInt } from './allocate';

/** Computes each person's net balance (positive = owed to them, negative = they owe). */
export function computeBalances(state: AppState): Map<PersonId, Cents> {
  const balances = new Map<PersonId, Cents>();
  for (const person of state.people) balances.set(person.id, 0);

  for (const expense of state.expenses) {
    balances.set(expense.paidBy, (balances.get(expense.paidBy) ?? 0) + expense.amount);

    const shares = allocate(expense.amount, expense.participants, expense.split, hashToInt(expense.id));
    for (const [personId, share] of Object.entries(shares)) {
      balances.set(personId, (balances.get(personId) ?? 0) - share);
    }
  }

  const sum = [...balances.values()].reduce((a, b) => a + b, 0);
  if (sum !== 0) {
    throw new Error(`computeBalances() invariant violated: balances sum to ${sum}, expected 0`);
  }

  return balances;
}
