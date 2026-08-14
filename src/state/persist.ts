import type { AppState } from '../core/types';
import { initialState } from './reducer';

const STORAGE_KEY = 'expense-splitter-v1';
const VERSION = 1;

interface StoredEnvelope {
  version: number;
  state: AppState;
}

function isValidAppState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.people) && Array.isArray(v.expenses);
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw) as StoredEnvelope;
    if (parsed.version !== VERSION || !isValidAppState(parsed.state)) {
      return initialState;
    }
    return {
      ...parsed.state,
      settlements: parsed.state.settlements ?? [],
      log: parsed.state.log ?? [],
    };
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState): void {
  try {
    const envelope: StoredEnvelope = { version: VERSION, state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Storage unavailable or full; state simply won't persist this time.
  }
}
