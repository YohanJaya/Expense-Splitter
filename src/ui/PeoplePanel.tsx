import { useState } from 'react';
import type { AppState } from '../core/types';
import type { Action } from '../state/reducer';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

export default function PeoplePanel({ state, dispatch }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addPerson() {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({ type: 'ADD_PERSON', person: { id: crypto.randomUUID(), name: trimmed } });
    setName('');
  }

  function removePerson(id: string) {
    const inUse = state.expenses.some(
      (e) => e.paidBy === id || e.participants.includes(id)
    );
    if (inUse) {
      setError('Cannot remove this person: they appear in one or more expenses.');
      return;
    }
    setError(null);
    dispatch({ type: 'REMOVE_PERSON', personId: id });
  }

  return (
    <section className="panel">
      <h2>People</h2>
      <div className="row">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addPerson();
          }}
        />
        <button className="btn-success" onClick={addPerson}>
          Add
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {state.people.length === 0 && (
        <p className="empty">Add at least two people to start logging expenses.</p>
      )}

      <ul className="people-list">
        {state.people.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <button className="link-button danger" onClick={() => removePerson(p.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
