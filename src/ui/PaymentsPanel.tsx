import { useState } from 'react';
import type { AppState, Transfer } from '../core/types';
import type { Action } from '../state/reducer';
import { formatLKR, toCents } from '../core/money';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  transfers: Transfer[];
}

export default function PaymentsPanel({ state, dispatch, transfers }: Props) {
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function nameOf(id: string): string {
    return state.people.find((p) => p.id === id)?.name ?? '(removed)';
  }

  function keyOf(t: Transfer): string {
    return `${t.from}:${t.to}`;
  }

  function recordPayment(t: Transfer) {
    const key = keyOf(t);
    const raw = amountInputs[key];
    let amount: number;
    try {
      amount = raw?.trim() ? toCents(raw) : t.amount;
    } catch {
      setErrors((prev) => ({ ...prev, [key]: 'Enter a valid amount.' }));
      return;
    }
    if (amount <= 0) {
      setErrors((prev) => ({ ...prev, [key]: 'Amount must be greater than zero.' }));
      return;
    }
    setErrors((prev) => ({ ...prev, [key]: '' }));
    setAmountInputs((prev) => ({ ...prev, [key]: '' }));
    dispatch({
      type: 'ADD_SETTLEMENT',
      settlement: { id: crypto.randomUUID(), from: t.from, to: t.to, amount },
    });
  }

  function undoSettlement(id: string) {
    dispatch({ type: 'DELETE_SETTLEMENT', settlementId: id });
  }

  return (
    <section className="panel">
      <h2>Record a payment</h2>
      {transfers.length === 0 ? (
        <p className="empty">Everyone is settled up.</p>
      ) : (
        <ol className="transfer-list">
          {transfers.map((t) => {
            const key = keyOf(t);
            return (
              <li key={key}>
                <div className="transfer-row">
                  <span>
                    {nameOf(t.from)} owes {nameOf(t.to)} {formatLKR(t.amount)}
                  </span>
                  <div className="row">
                    <input
                      type="text"
                      placeholder={(t.amount / 100).toFixed(2)}
                      value={amountInputs[key] ?? ''}
                      onChange={(e) =>
                        setAmountInputs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') recordPayment(t);
                      }}
                    />
                    <button className="btn-success" onClick={() => recordPayment(t)}>
                      Record payment
                    </button>
                  </div>
                </div>
                {errors[key] && <p className="error">{errors[key]}</p>}
              </li>
            );
          })}
        </ol>
      )}

      <h3>Payment history</h3>
      {state.settlements.length === 0 ? (
        <p className="empty">No payments recorded yet.</p>
      ) : (
        <ul className="settlement-list">
          {state.settlements.map((s) => (
            <li key={s.id}>
              <span>
                {nameOf(s.from)} paid {nameOf(s.to)} {formatLKR(s.amount)}
              </span>
              <button className="link-button danger" onClick={() => undoSettlement(s.id)}>
                Undo
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
