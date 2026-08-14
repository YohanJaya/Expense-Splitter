import type { AppState, Expense } from '../core/types';
import type { Action } from '../state/reducer';
import { formatLKR } from '../core/money';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  onEdit: (expense: Expense) => void;
}

export default function ExpenseList({ state, dispatch, onEdit }: Props) {
  function nameOf(id: string): string {
    return state.people.find((p) => p.id === id)?.name ?? '(removed)';
  }

  if (state.expenses.length === 0) {
    return (
      <section className="panel">
        <h2>Expenses</h2>
        <p className="empty">No expenses logged yet.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
            <th>Paid by</th>
            <th>Split</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {state.expenses.map((expense) => (
            <tr key={expense.id}>
              <td>{expense.description}</td>
              <td className="currency">{formatLKR(expense.amount)}</td>
              <td>{nameOf(expense.paidBy)}</td>
              <td>{expense.split.kind === 'equal' ? 'Equal' : 'Exact'}</td>
              <td className="row">
                <button className="link-button" onClick={() => onEdit(expense)}>
                  Edit
                </button>
                <button
                  className="link-button danger"
                  onClick={() => dispatch({ type: 'DELETE_EXPENSE', expenseId: expense.id })}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
