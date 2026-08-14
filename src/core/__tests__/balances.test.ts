import { describe, it, expect } from 'vitest';
import { computeBalances } from '../balances';
import type { AppState, Expense } from '../types';

function state(expenses: Expense[]): AppState {
  return {
    people: [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
      { id: 'carol', name: 'Carol' },
      { id: 'dave', name: 'Dave' },
    ],
    expenses,
    settlements: [],
  };
}

describe('computeBalances - structural', () => {
  it('payer who is also a participant is counted on both sides', () => {
    const s = state([
      {
        id: 'e1',
        description: 'lunch',
        amount: 1000,
        paidBy: 'alice',
        participants: ['alice', 'bob'],
        split: { kind: 'equal' },
      },
    ]);
    const balances = computeBalances(s);
    expect(balances.get('alice')).toBe(500);
    expect(balances.get('bob')).toBe(-500);
  });

  it('payer not a participant gets full amount as net', () => {
    const s = state([
      {
        id: 'e1',
        description: 'gift',
        amount: 1000,
        paidBy: 'alice',
        participants: ['bob', 'carol'],
        split: { kind: 'equal' },
      },
    ]);
    const balances = computeBalances(s);
    expect(balances.get('alice')).toBe(1000);
    expect(balances.get('bob')).toBe(-500);
    expect(balances.get('carol')).toBe(-500);
  });

  it('single-participant expense: that person owes the whole amount', () => {
    const s = state([
      {
        id: 'e1',
        description: 'solo',
        amount: 500,
        paidBy: 'alice',
        participants: ['bob'],
        split: { kind: 'equal' },
      },
    ]);
    const balances = computeBalances(s);
    expect(balances.get('bob')).toBe(-500);
    expect(balances.get('alice')).toBe(500);
  });

  it('deleting an expense returns balances to pre-expense values exactly', () => {
    const e1: Expense = {
      id: 'e1',
      description: 'lunch',
      amount: 1000,
      paidBy: 'alice',
      participants: ['alice', 'bob'],
      split: { kind: 'equal' },
    };
    const e2: Expense = {
      id: 'e2',
      description: 'dinner',
      amount: 2000,
      paidBy: 'bob',
      participants: ['alice', 'bob', 'carol'],
      split: { kind: 'equal' },
    };
    const before = computeBalances(state([e1]));
    const withBoth = computeBalances(state([e1, e2]));
    expect(withBoth).not.toEqual(before);
    const afterDelete = computeBalances(state([e1]));
    expect(afterDelete).toEqual(before);
  });

  it('editing an expense amount matches a fresh computation from scratch', () => {
    const e1: Expense = {
      id: 'e1',
      description: 'lunch',
      amount: 1000,
      paidBy: 'alice',
      participants: ['alice', 'bob'],
      split: { kind: 'equal' },
    };
    const edited: Expense = { ...e1, amount: 4000 };
    const editedResult = computeBalances(state([edited]));
    const freshResult = computeBalances(state([edited]));
    expect(editedResult).toEqual(freshResult);
  });

  it('every balances map sums to exactly zero', () => {
    const s = state([
      {
        id: 'e1',
        description: 'lunch',
        amount: 999,
        paidBy: 'alice',
        participants: ['alice', 'bob', 'carol'],
        split: { kind: 'equal' },
      },
    ]);
    const balances = computeBalances(s);
    const sum = [...balances.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });
});
