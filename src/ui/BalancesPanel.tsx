import type { AppState, Cents, PersonId } from '../core/types';
import { formatLKR } from '../core/money';
import { initials, avatarClass } from './avatar';

interface Props {
  state: AppState;
  balances: Map<PersonId, Cents>;
}

export default function BalancesPanel({ state, balances }: Props) {
  const outstanding = [...balances.values()]
    .filter((a) => a > 0)
    .reduce((sum, a) => sum + a, 0);
  const settled = state.settlements.reduce((sum, s) => sum + s.amount, 0);
  const total = outstanding + settled;
  const percentSettled = total === 0 ? 100 : Math.round((settled / total) * 100);

  return (
    <section className="panel">
      <h2>Balances</h2>
      {state.people.length === 0 ? (
        <p className="empty">Add people to see balances.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>To receive</th>
                <th>To pay</th>
              </tr>
            </thead>
            <tbody>
              {state.people.map((p) => {
                const amount = balances.get(p.id) ?? 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="person-info">
                        <span className={`avatar ${avatarClass(p.id)}`}>{initials(p.name)}</span>
                        {p.name}
                      </span>
                    </td>
                    <td className="owed currency">{amount > 0 ? formatLKR(amount) : '—'}</td>
                    <td className="owes currency">{amount < 0 ? formatLKR(-amount) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: '1.25rem' }}>
            <div className="progress-label">
              <span>Settlement progress</span>
              <span className="progress-pct">{percentSettled}% settled</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${percentSettled}%` }} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
