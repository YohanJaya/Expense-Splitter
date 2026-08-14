import type {
  AppState,
  Expense,
  ExpenseId,
  LogEntry,
  Person,
  PersonId,
  Settlement,
} from '../core/types';
import { formatLKR } from '../core/money';

export type Action =
  | { type: 'ADD_PERSON'; person: Person }
  | { type: 'REMOVE_PERSON'; personId: PersonId }
  | { type: 'ADD_EXPENSE'; expense: Expense }
  | { type: 'UPDATE_EXPENSE'; expense: Expense }
  | { type: 'DELETE_EXPENSE'; expenseId: ExpenseId }
  | { type: 'ADD_SETTLEMENT'; settlement: Settlement }
  | { type: 'DELETE_SETTLEMENT'; settlementId: string }
  | { type: 'RESET' };

export const initialState: AppState = { people: [], expenses: [], settlements: [], log: [] };

export class PersonInUseError extends Error {
  constructor(personId: PersonId) {
    super(`Cannot remove person ${personId}: they appear in one or more expenses`);
    this.name = 'PersonInUseError';
  }
}

function nameOf(state: AppState, id: PersonId): string {
  return state.people.find((p) => p.id === id)?.name ?? '(removed)';
}

function withLog(state: AppState, message: string): LogEntry[] {
  return [{ id: crypto.randomUUID(), timestamp: Date.now(), message }, ...state.log];
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_PERSON':
      return {
        ...state,
        people: [...state.people, action.person],
        log: withLog(state, `${action.person.name} joined the group.`),
      };

    case 'REMOVE_PERSON': {
      const inUse =
        state.expenses.some(
          (e) => e.paidBy === action.personId || e.participants.includes(action.personId)
        ) ||
        state.settlements.some((s) => s.from === action.personId || s.to === action.personId);
      if (inUse) throw new PersonInUseError(action.personId);
      const name = nameOf(state, action.personId);
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.personId),
        log: withLog(state, `${name} was removed from the group.`),
      };
    }

    case 'ADD_EXPENSE':
      return {
        ...state,
        expenses: [...state.expenses, action.expense],
        log: withLog(
          state,
          `${nameOf(state, action.expense.paidBy)} paid ${formatLKR(action.expense.amount)} for "${action.expense.description}".`
        ),
      };

    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.expense.id ? action.expense : e)),
        log: withLog(state, `Expense "${action.expense.description}" was updated.`),
      };

    case 'DELETE_EXPENSE': {
      const expense = state.expenses.find((e) => e.id === action.expenseId);
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.expenseId),
        log: withLog(state, `Expense "${expense?.description ?? '(unknown)'}" was deleted.`),
      };
    }

    case 'ADD_SETTLEMENT':
      return {
        ...state,
        settlements: [...state.settlements, action.settlement],
        log: withLog(
          state,
          `${nameOf(state, action.settlement.from)} paid ${nameOf(state, action.settlement.to)} ${formatLKR(action.settlement.amount)}.`
        ),
      };

    case 'DELETE_SETTLEMENT': {
      const settlement = state.settlements.find((s) => s.id === action.settlementId);
      const message = settlement
        ? `Payment of ${formatLKR(settlement.amount)} from ${nameOf(state, settlement.from)} to ${nameOf(state, settlement.to)} was undone.`
        : 'A payment was undone.';
      return {
        ...state,
        settlements: state.settlements.filter((s) => s.id !== action.settlementId),
        log: withLog(state, message),
      };
    }

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
