import { useEffect, useMemo, useState } from 'react';
import type { AppState, Expense, PersonId, SplitMethod } from '../core/types';
import type { Action } from '../state/reducer';
import { toCents, formatLKR } from '../core/money';
import { allocate, hashToInt } from '../core/allocate';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  editingExpense: Expense | null;
  onDoneEditing: () => void;
}

export default function ExpenseForm({ state, dispatch, editingExpense, onDoneEditing }: Props) {
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [paidBy, setPaidBy] = useState<PersonId>('');
  const [participants, setParticipants] = useState<Set<PersonId>>(new Set());
  const [splitKind, setSplitKind] = useState<'equal' | 'exact'>('equal');
  const [exactInputs, setExactInputs] = useState<Record<PersonId, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editingExpense) {
      setDescription(editingExpense.description);
      setAmountInput((editingExpense.amount / 100).toFixed(2));
      setPaidBy(editingExpense.paidBy);
      setParticipants(new Set(editingExpense.participants));
      setSplitKind(editingExpense.split.kind);
      if (editingExpense.split.kind === 'exact') {
        const inputs: Record<PersonId, string> = {};
        for (const [id, cents] of Object.entries(editingExpense.split.shares)) {
          inputs[id] = (cents / 100).toFixed(2);
        }
        setExactInputs(inputs);
      } else {
        setExactInputs({});
      }
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExpense]);

  function resetForm() {
    setDescription('');
    setAmountInput('');
    setPaidBy(state.people[0]?.id ?? '');
    setParticipants(new Set(state.people.map((p) => p.id)));
    setSplitKind('equal');
    setExactInputs({});
    setFormError(null);
  }

  function toggleParticipant(id: PersonId) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const participantList = useMemo(
    () => state.people.filter((p) => participants.has(p.id)),
    [state.people, participants]
  );

  let totalCents: number | null = null;
  let amountError: string | null = null;
  try {
    totalCents = amountInput.trim() ? toCents(amountInput) : null;
  } catch (e) {
    totalCents = null;
    amountError = e instanceof Error ? e.message : 'Invalid amount';
  }

  const exactSumCents = participantList.reduce((sum, p) => {
    const raw = exactInputs[p.id];
    try {
      return sum + (raw?.trim() ? toCents(raw) : 0);
    } catch {
      return sum;
    }
  }, 0);
  const exactDelta = totalCents !== null ? exactSumCents - totalCents : 0;

  let preview: Record<PersonId, number> | null = null;
  let previewError: string | null = null;
  if (totalCents !== null && participantList.length > 0) {
    try {
      const split: SplitMethod =
        splitKind === 'equal'
          ? { kind: 'equal' }
          : {
              kind: 'exact',
              shares: Object.fromEntries(
                participantList.map((p) => [p.id, toCents(exactInputs[p.id] || '0')])
              ),
            };
      preview = allocate(
        totalCents,
        participantList.map((p) => p.id),
        split,
        hashToInt(editingExpense?.id ?? 'preview')
      );
    } catch (e) {
      previewError = e instanceof Error ? e.message : 'Invalid split';
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!description.trim()) {
      setFormError('Enter a description.');
      return;
    }
    if (totalCents === null || totalCents <= 0) {
      setFormError(amountError ?? 'Enter a valid amount.');
      return;
    }
    if (!paidBy) {
      setFormError('Choose who paid.');
      return;
    }
    if (participantList.length === 0) {
      setFormError('Select at least one participant.');
      return;
    }

    const split: SplitMethod =
      splitKind === 'equal'
        ? { kind: 'equal' }
        : {
            kind: 'exact',
            shares: Object.fromEntries(
              participantList.map((p) => {
                try {
                  return [p.id, toCents(exactInputs[p.id] || '0')];
                } catch {
                  return [p.id, 0];
                }
              })
            ),
          };

    if (split.kind === 'exact' && exactDelta !== 0) {
      setFormError(
        exactDelta > 0
          ? `Shares are ${formatLKR(exactDelta)} over the total.`
          : `Shares are ${formatLKR(-exactDelta)} under the total.`
      );
      return;
    }

    const expense: Expense = {
      id: editingExpense?.id ?? crypto.randomUUID(),
      description: description.trim(),
      amount: totalCents,
      paidBy,
      participants: participantList.map((p) => p.id),
      split,
    };

    dispatch({ type: editingExpense ? 'UPDATE_EXPENSE' : 'ADD_EXPENSE', expense });
    resetForm();
    onDoneEditing();
  }

  if (state.people.length < 2) {
    return (
      <section className="panel">
        <h2>Log an expense</h2>
        <p className="empty">Add at least two people first.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>{editingExpense ? 'Edit expense' : 'Log an expense'}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Description
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label>
          Amount (Rs.)
          <input
            type="text"
            placeholder="0.00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
        </label>
        {amountInput.trim() !== '' && amountError && <p className="error">{amountError}</p>}

        <label>
          Paid by
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            <option value="" disabled>
              Select a person
            </option>
            {state.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Participants</legend>
          {state.people.map((p) => (
            <label key={p.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={participants.has(p.id)}
                onChange={() => toggleParticipant(p.id)}
              />
              {p.name}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Split method</legend>
          <label className="checkbox-row">
            <input
              type="radio"
              name="split"
              checked={splitKind === 'equal'}
              onChange={() => setSplitKind('equal')}
            />
            Equal
          </label>
          <label className="checkbox-row">
            <input
              type="radio"
              name="split"
              checked={splitKind === 'exact'}
              onChange={() => setSplitKind('exact')}
            />
            Exact amount
          </label>
        </fieldset>

        {splitKind === 'exact' && (
          <div className="exact-inputs">
            {participantList.map((p) => (
              <label key={p.id}>
                {p.name}
                <input
                  type="text"
                  placeholder="0.00"
                  value={exactInputs[p.id] ?? ''}
                  onChange={(e) =>
                    setExactInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                />
              </label>
            ))}
            {totalCents !== null && (
              <p className={exactDelta === 0 ? 'delta ok' : 'delta warn'}>
                {exactDelta === 0
                  ? 'Shares match the total.'
                  : exactDelta > 0
                  ? `Rs. ${(exactDelta / 100).toFixed(2)} over the total`
                  : `Rs. ${(-exactDelta / 100).toFixed(2)} remaining`}
              </p>
            )}
          </div>
        )}

        <div className="preview">
          <h3>Preview</h3>
          {previewError && <p className="error">{previewError}</p>}
          {preview && !previewError && (
            <ul>
              {participantList.map((p) => (
                <li key={p.id}>
                  {p.name}: {formatLKR(preview![p.id] ?? 0)}
                </li>
              ))}
            </ul>
          )}
          {!preview && !previewError && <p className="empty">Enter an amount to preview shares.</p>}
        </div>

        {formError && <p className="error">{formError}</p>}

        <div className="row">
          <button type="submit">{editingExpense ? 'Save changes' : 'Add expense'}</button>
          {editingExpense && (
            <button type="button" onClick={() => onDoneEditing()}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
