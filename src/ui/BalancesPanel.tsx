import type { AppState, Cents, PersonId } from '../core/types';
import { formatSigned, formatLKR } from '../core/money';

interface Props {
  state: AppState;
  balances: Map<PersonId, Cents>;
}

export default function BalancesPanel({ state, balances }: Props) {
  const total = [...balances.values()].reduce((a, b) => a + b, 0);

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
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {state.people.map((p) => {
              const amount = balances.get(p.id) ?? 0;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className={amount > 0 ? 'owed' : amount < 0 ? 'owes' : ''}>
                    {formatSigned(amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Sum</td>
              <td>{formatLKR(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
