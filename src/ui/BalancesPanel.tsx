import type { AppState, Cents, PersonId } from '../core/types';
import { formatLKR } from '../core/money';

interface Props {
  state: AppState;
  balances: Map<PersonId, Cents>;
}

export default function BalancesPanel({ state, balances }: Props) {
  return (
    <section className="panel">
      <h2>Balances</h2>
      {state.people.length === 0 ? (
        <p className="empty">Add people to see balances.</p>
      ) : (
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
                  <td>{p.name}</td>
                  <td className="owed">{amount > 0 ? formatLKR(amount) : '—'}</td>
                  <td className="owes">{amount < 0 ? formatLKR(-amount) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
