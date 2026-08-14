import { describe, it, expect } from 'vitest';
import { reducer, initialState, PersonInUseError } from '../reducer';
import type { AppState, Expense } from '../../core/types';

describe('reducer', () => {
  it('adds and removes a person not in use', () => {
    let state: AppState = reducer(initialState, {
      type: 'ADD_PERSON',
      person: { id: 'a', name: 'Alice' },
    });
    expect(state.people).toHaveLength(1);
    state = reducer(state, { type: 'REMOVE_PERSON', personId: 'a' });
    expect(state.people).toHaveLength(0);
  });

  it('blocks removing a person who appears in an expense', () => {
    const expense: Expense = {
      id: 'e1',
      description: 'lunch',
      amount: 100,
      paidBy: 'a',
      participants: ['a', 'b'],
      split: { kind: 'equal' },
    };
    let state: AppState = {
      people: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      expenses: [expense],
      settlements: [],
      log: [],
    };
    expect(() => reducer(state, { type: 'REMOVE_PERSON', personId: 'a' })).toThrow(
      PersonInUseError
    );
  });

  it('adds, updates, and deletes an expense', () => {
    const expense: Expense = {
      id: 'e1',
      description: 'lunch',
      amount: 100,
      paidBy: 'a',
      participants: ['a', 'b'],
      split: { kind: 'equal' },
    };
    let state = reducer(initialState, { type: 'ADD_EXPENSE', expense });
    expect(state.expenses).toHaveLength(1);

    const updated = { ...expense, amount: 200 };
    state = reducer(state, { type: 'UPDATE_EXPENSE', expense: updated });
    expect(state.expenses[0].amount).toBe(200);

    state = reducer(state, { type: 'DELETE_EXPENSE', expenseId: 'e1' });
    expect(state.expenses).toHaveLength(0);
  });

  it('RESET returns to initial state', () => {
    const state = reducer(initialState, {
      type: 'ADD_PERSON',
      person: { id: 'a', name: 'Alice' },
    });
    expect(reducer(state, { type: 'RESET' })).toEqual(initialState);
  });
});
