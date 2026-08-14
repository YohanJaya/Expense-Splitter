import type { AppState, Transfer } from '../core/types';
import { formatLKR } from '../core/money';

interface Props {
  state: AppState;
  transfers: Transfer[];
  peopleCount: number;
}

export default function SettleUpPanel({ state, transfers }: Props) {
  function nameOf(id: string): string {
    return state.people.find((p) => p.id === id)?.name ?? '(removed)';
  }

  return (
    <section className="panel">
      <h2>Summary</h2>
      {transfers.length === 0 ? (
        <p className="empty">Everyone is settled up.</p>
      ) : (
        <ol className="transfer-list">
          {transfers.map((t, i) => (
            <li key={i}>
              <div className="transfer-card">
                <span className="transfer-parties">
                  {nameOf(t.from)}
                  <span className="transfer-arrow">&rarr;</span>
                  {nameOf(t.to)}
                </span>
                <span className="transfer-amount currency">{formatLKR(t.amount)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
