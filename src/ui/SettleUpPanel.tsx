import type { AppState, Transfer } from '../core/types';
import { formatLKR } from '../core/money';

const TIER2_MAX_PEOPLE = 15;

interface Props {
  state: AppState;
  transfers: Transfer[];
  peopleCount: number;
}

export default function SettleUpPanel({ state, transfers, peopleCount }: Props) {
  function nameOf(id: string): string {
    return state.people.find((p) => p.id === id)?.name ?? '(removed)';
  }

  const isProvenMinimum = peopleCount <= TIER2_MAX_PEOPLE;

  return (
    <section className="panel">
      <h2>Summary</h2>
      {transfers.length === 0 ? (
        <p className="empty">Everyone is settled up.</p>
      ) : (
        <>
          <ol className="transfer-list">
            {transfers.map((t, i) => (
              <li key={i}>
                {nameOf(t.from)} pays {nameOf(t.to)} {formatLKR(t.amount)}
              </li>
            ))}
          </ol>
          <p className="note">
            {transfers.length} transfer{transfers.length === 1 ? '' : 's'}
            {isProvenMinimum ? ' — proven minimum.' : ' (heuristic; group exceeds 15 people).'}
          </p>
        </>
      )}
    </section>
  );
}
