export type PersonId = string;
export type ExpenseId = string;

/** Integer number of cents. Never a float. */
export type Cents = number;

export interface Person {
  id: PersonId;
  name: string;
}

export type SplitMethod =
  | { kind: 'equal' }
  | { kind: 'exact'; shares: Record<PersonId, Cents> };

export interface Expense {
  id: ExpenseId;
  description: string;
  amount: Cents;
  paidBy: PersonId;
  participants: PersonId[];
  split: SplitMethod;
}

export interface AppState {
  people: Person[];
  expenses: Expense[];
  settlements: Settlement[];
}

export interface Transfer {
  from: PersonId;
  to: PersonId;
  amount: Cents;
}

/** A recorded real-world payment made to reduce a balance between two people. */
export interface Settlement {
  id: string;
  from: PersonId;
  to: PersonId;
  amount: Cents;
}

export class SplitMismatchError extends Error {
  /** Positive: shares exceed the total. Negative: shares fall short. */
  delta: Cents;
  constructor(delta: Cents) {
    super(`Exact shares do not sum to the expense total (delta: ${delta} cents)`);
    this.name = 'SplitMismatchError';
    this.delta = delta;
  }
}
