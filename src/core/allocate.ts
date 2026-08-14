import type { Cents, PersonId, SplitMethod } from './types';
import { SplitMismatchError } from './types';

/** Deterministic small hash of a string, for use as an allocation seed. */
export function hashToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Splits `total` cents among `participants` according to `split`.
 * Returns exact per-person shares. Sum of returned values always equals `total`.
 */
export function allocate(
  total: Cents,
  participants: PersonId[],
  split: SplitMethod,
  seed: number
): Record<PersonId, Cents> {
  const result =
    split.kind === 'equal'
      ? allocateEqual(total, participants, seed)
      : allocateExact(total, participants, split.shares);

  const sum = Object.values(result).reduce((a, b) => a + b, 0);
  if (sum !== total) {
    throw new Error(
      `allocate() invariant violated: shares sum to ${sum}, expected ${total}`
    );
  }
  return result;
}

function allocateEqual(
  total: Cents,
  participants: PersonId[],
  seed: number
): Record<PersonId, Cents> {
  const n = participants.length;
  if (n === 0) {
    if (total !== 0) throw new Error('Cannot split a non-zero amount among zero participants');
    return {};
  }
  const base = Math.floor(total / n);
  const remainder = total - base * n;

  const shares: Record<PersonId, Cents> = {};
  for (const p of participants) shares[p] = base;

  const start = seed % n;
  for (let i = 0; i < remainder; i++) {
    const idx = (start + i) % n;
    shares[participants[idx]] += 1;
  }
  return shares;
}

function allocateExact(
  total: Cents,
  participants: PersonId[],
  shares: Record<PersonId, Cents>
): Record<PersonId, Cents> {
  const shareKeys = Object.keys(shares);
  if (shareKeys.length !== participants.length) {
    throw new Error('Exact split must specify a share for every participant, and no extras');
  }
  for (const p of participants) {
    if (!(p in shares)) {
      throw new Error(`Missing exact share for participant ${p}`);
    }
  }
  for (const key of shareKeys) {
    if (!participants.includes(key)) {
      throw new Error(`Exact share specified for non-participant ${key}`);
    }
  }
  const sum = participants.reduce((a, p) => a + shares[p], 0);
  if (sum !== total) {
    throw new SplitMismatchError(sum - total);
  }
  const result: Record<PersonId, Cents> = {};
  for (const p of participants) result[p] = shares[p];
  return result;
}
