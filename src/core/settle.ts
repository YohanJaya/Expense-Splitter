import type { Cents, PersonId, Transfer } from './types';

const TIER2_MAX_PEOPLE = 15;

/**
 * Computes a minimal-ish set of transfers that zeroes out every balance.
 * For groups of 15 or fewer, finds the true minimum via exact zero-sum
 * partitioning (subset-sum is NP-hard, so this cutoff keeps runtime bounded).
 * Larger groups fall back to a greedy heuristic that is never worse than n-1 transfers.
 */
export function settleUp(balances: Map<PersonId, Cents>): Transfer[] {
  const entries = [...balances.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  if (entries.length === 0) return [];

  if (entries.length <= TIER2_MAX_PEOPLE) {
    const groups = partitionZeroSumGroups(entries);
    const transfers: Transfer[] = [];
    for (const group of groups) {
      transfers.push(...greedySettle(group));
    }
    return transfers;
  }

  return greedySettle(entries);
}

/** Tier 1: greedy max-debtor-vs-max-creditor matching. Emits at most n-1 transfers. */
function greedySettle(entries: [PersonId, Cents][]): Transfer[] {
  const people = entries.map(([id, amount]) => ({ id, amount }));
  const transfers: Transfer[] = [];

  while (true) {
    let debtorIdx = -1;
    let creditorIdx = -1;
    for (let i = 0; i < people.length; i++) {
      if (people[i].amount === 0) continue;
      if (people[i].amount < 0) {
        if (
          debtorIdx === -1 ||
          people[i].amount < people[debtorIdx].amount ||
          (people[i].amount === people[debtorIdx].amount && people[i].id < people[debtorIdx].id)
        ) {
          debtorIdx = i;
        }
      } else {
        if (
          creditorIdx === -1 ||
          people[i].amount > people[creditorIdx].amount ||
          (people[i].amount === people[creditorIdx].amount && people[i].id < people[creditorIdx].id)
        ) {
          creditorIdx = i;
        }
      }
    }

    if (debtorIdx === -1 || creditorIdx === -1) break;

    const debtor = people[debtorIdx];
    const creditor = people[creditorIdx];
    const amount = Math.min(-debtor.amount, creditor.amount);

    transfers.push({ from: debtor.id, to: creditor.id, amount });

    debtor.amount += amount;
    creditor.amount -= amount;
  }

  return transfers;
}

/** Tier 2: partitions entries into the maximum number of disjoint zero-sum subsets via bitmask DP. */
function partitionZeroSumGroups(entries: [PersonId, Cents][]): [PersonId, Cents][][] {
  const n = entries.length;
  const amounts = entries.map(([, amount]) => amount);
  const fullMask = (1 << n) - 1;

  const subsetSum = new Int32Array(1 << n);
  for (let mask = 1; mask <= fullMask; mask++) {
    const lowBit = mask & -mask;
    const lowIdx = Math.log2(lowBit);
    subsetSum[mask] = subsetSum[mask & (mask - 1)] + amounts[lowIdx];
  }

  const NEG_INF = -1;
  const dpCount = new Int32Array((1 << n)).fill(NEG_INF);
  const dpChoice = new Int32Array(1 << n).fill(0);
  dpCount[0] = 0;

  for (let mask = 1; mask <= fullMask; mask++) {
    const lowBit = mask & -mask;
    let best = NEG_INF;
    let bestSub = 0;

    for (let sub = mask; sub > 0; sub = (sub - 1) & mask) {
      if ((sub & lowBit) === 0) continue;
      if (subsetSum[sub] !== 0) continue;
      const rest = mask ^ sub;
      if (dpCount[rest] === NEG_INF) continue;
      const candidate = dpCount[rest] + 1;
      if (candidate > best) {
        best = candidate;
        bestSub = sub;
      }
    }

    dpCount[mask] = best;
    dpChoice[mask] = bestSub;
  }

  const groups: [PersonId, Cents][][] = [];
  let mask = fullMask;
  while (mask > 0) {
    const sub = dpChoice[mask];
    const group: [PersonId, Cents][] = [];
    for (let i = 0; i < n; i++) {
      if (sub & (1 << i)) group.push(entries[i]);
    }
    groups.push(group);
    mask ^= sub;
  }

  return groups;
}
