import { useEffect, useMemo, useReducer, useState } from 'react';
import { reducer, initialState } from '../state/reducer';
import { loadState, saveState } from '../state/persist';
import { computeBalances } from '../core/balances';
import { settleUp } from '../core/settle';
import type { Expense } from '../core/types';
import PeoplePanel from './PeoplePanel';
import ExpenseForm from './ExpenseForm';
import ExpenseList from './ExpenseList';
import BalancesPanel from './BalancesPanel';
import SettleUpPanel from './SettleUpPanel';
import PaymentsPanel from './PaymentsPanel';

type Tab = 'people' | 'expenses' | 'balances' | 'settle' | 'payments';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? initialState);
  const [tab, setTab] = useState<Tab>('people');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const balances = useMemo(() => computeBalances(state), [state]);
  const transfers = useMemo(() => settleUp(balances), [balances]);

  function resetSession() {
    if (state.people.length === 0 && state.expenses.length === 0) {
      dispatch({ type: 'RESET' });
      return;
    }
    if (window.confirm('Start a new session? This clears all people, expenses, and payments.')) {
      dispatch({ type: 'RESET' });
      setTab('people');
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Expense Splitter</h1>
        <button className="link-button warn" onClick={resetSession}>
          New session
        </button>
      </header>

      <nav className="tabs">
        <button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          1. People
        </button>
        <button
          className={tab === 'expenses' ? 'active' : ''}
          onClick={() => setTab('expenses')}
          disabled={state.people.length < 2}
        >
          2. Expenses
        </button>
        <button
          className={tab === 'balances' ? 'active' : ''}
          onClick={() => setTab('balances')}
          disabled={state.people.length === 0}
        >
          3. Balances
        </button>
        <button
          className={tab === 'settle' ? 'active' : ''}
          onClick={() => setTab('settle')}
          disabled={state.people.length === 0}
        >
          4. Settle up
        </button>
        <button
          className={tab === 'payments' ? 'active' : ''}
          onClick={() => setTab('payments')}
          disabled={state.people.length === 0}
        >
          5. Payments
        </button>
      </nav>

      <main>
        {tab === 'people' && <PeoplePanel state={state} dispatch={dispatch} />}

        {tab === 'expenses' && (
          <>
            <ExpenseForm
              state={state}
              dispatch={dispatch}
              editingExpense={editingExpense}
              onDoneEditing={() => setEditingExpense(null)}
            />
            <ExpenseList
              state={state}
              dispatch={dispatch}
              onEdit={(expense) => {
                setEditingExpense(expense);
              }}
            />
          </>
        )}

        {tab === 'balances' && <BalancesPanel state={state} balances={balances} />}

        {tab === 'settle' && (
          <SettleUpPanel state={state} transfers={transfers} peopleCount={state.people.length} />
        )}

        {tab === 'payments' && (
          <PaymentsPanel state={state} dispatch={dispatch} transfers={transfers} />
        )}
      </main>
    </div>
  );
}
