import type { AppState, Expense, ExpenseId, Person, PersonId, Settlement } from '../core/types';

export type Action =
  | { type: 'ADD_PERSON'; person: Person }
  | { type: 'REMOVE_PERSON'; personId: PersonId }
  | { type: 'ADD_EXPENSE'; expense: Expense }
  | { type: 'UPDATE_EXPENSE'; expense: Expense }
  | { type: 'DELETE_EXPENSE'; expenseId: ExpenseId }
  | { type: 'ADD_SETTLEMENT'; settlement: Settlement }
  | { type: 'DELETE_SETTLEMENT'; settlementId: string }
  | { type: 'RESET' };

export const initialState: AppState = { people: [], expenses: [], settlements: [] };

export class PersonInUseError extends Error {
  constructor(personId: PersonId) {
    super(`Cannot remove person ${personId}: they appear in one or more expenses`);
    this.name = 'PersonInUseError';
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_PERSON':
      return { ...state, people: [...state.people, action.person] };

    case 'REMOVE_PERSON': {
      const inUse =
        state.expenses.some(
          (e) => e.paidBy === action.personId || e.participants.includes(action.personId)
        ) ||
        state.settlements.some((s) => s.from === action.personId || s.to === action.personId);
      if (inUse) throw new PersonInUseError(action.personId);
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.personId),
      };
    }

    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.expense] };

    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.expense.id ? action.expense : e)),
      };

    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.expenseId) };

    case 'ADD_SETTLEMENT':
      return { ...state, settlements: [...state.settlements, action.settlement] };

    case 'DELETE_SETTLEMENT':
      return {
        ...state,
        settlements: state.settlements.filter((s) => s.id !== action.settlementId),
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
