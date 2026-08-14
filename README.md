# Expense Splitter

A single-session web app that lets a group log shared expenses in LKR, see
who owes whom, record real-world payments against those debts, and settle
up in as few transfers as possible. No login, no accounts, no backend — one
group at a time, persisted to `localStorage` on the device you're using.

## Contents

- [Running it](#running-it)
- [How to use it](#how-to-use-it)
- [Features](#features)
- [User flow](#user-flow)
- [Architecture](#architecture)
- [Domain model](#domain-model)
- [Methods used](#methods-used-core-algorithms)
- [Assumptions](#assumptions)
- [Rounding strategy](#rounding-strategy)
- [Settle-up honesty](#settle-up-honesty)
- [Testing](#testing)
- [What was left incomplete](#what-was-left-incomplete)

## Running it

```bash
npm install
npm run dev        # starts the app at http://localhost:5173
npm test           # runs the full test suite (unit + property-based)
npm run typecheck  # tsc --noEmit, strict mode
npm run build      # production build to dist/
```

No `.env` file is needed or used — the app has no backend and no external
services to configure. Fonts are loaded from Google Fonts over HTTPS; the
app has no other network dependency.

## How to use it

1. **Members** — add everyone in the group by name. You need at least two
   people before you can log an expense. Removing someone who already
   appears in an expense or a settlement is blocked with an explanation,
   rather than silently corrupting the numbers.
2. **Expenses** — log what was paid, by whom, for whom, and how it's split
   (equal or exact amounts). A live preview under the form shows exactly
   what each participant's share will be before you save. Edit or delete
   any expense later — balances recompute from scratch every time, so
   there's nothing to get out of sync.
3. **Balances** — see each person's net position: how much they're owed
   ("to receive") and how much they owe ("to pay"), plus a settlement
   progress bar showing how much of the group's total spend has been paid
   back so far.
4. **Payments** — the app proposes the minimal set of transfers that would
   zero everyone out. Record a payment when it actually happens (defaults
   to the suggested amount, editable) to log it against that debt; undo a
   recorded payment if it was a mistake.
5. **Summary** — the current settle-up transfer list plus a full activity
   log (who joined, who paid what, who paid whom, what was edited or
   undone), each with a timestamp, newest first.

**New session** (top right) clears everyone and everything after a
confirmation prompt — use it to start over with a different group.

## Features

- Add / remove group members, with removal blocked while a person is
  referenced by any expense or settlement
- Log expenses with a description, amount, payer, and a per-expense
  participant list
- Two split methods: **equal** (with a fair, deterministic rounding rule —
  see below) and **exact amount** per participant, with live delta
  validation ("Rs. 0.01 remaining") before you can submit a mismatched split
- Edit or delete any expense; balances always reflect a fresh computation,
  never a stale cache
- Live per-person share preview on the expense form, so the rounding
  behavior is visible before you commit
- Net balance table with amounts owed vs. amounts owing, and a settlement
  progress bar
- Minimal settle-up suggestions (see [Settle-up honesty](#settle-up-honesty))
- Record and undo real payments against suggested transfers, kept as a
  separate `settlements` ledger from the expenses themselves
- A running, timestamped activity log of everything that's happened in the
  session
- Per-person color-coded avatar chips (deterministic from the person's id,
  so a given person's color never changes across a session)
- State survives a page refresh via `localStorage`; a corrupted or
  version-mismatched stored value falls back to an empty session instead of
  crashing the app

## User flow

```
Add people  →  Log expenses  →  Review balances  →  Record payments  →  Check summary
   (≥2)          (edit/delete       (who owes         (against the         (transfer
                  freely)             whom)             suggested           list +
                                                          transfers)         activity log)
```

Balances and the settle-up transfer list are **derived, not stored** — they
are recomputed from `expenses` and `settlements` on every render via
`useMemo`, so any sequence of adds, edits, deletes, and recorded payments
always produces internally consistent numbers.

## Architecture

```
src/
  core/            pure calculation library — zero React, DOM, or storage imports
    types.ts       domain types: Person, Expense, Settlement, LogEntry, Transfer
    money.ts       string <-> integer-cent conversion, LKR formatting
    allocate.ts    equal / exact split algorithms
    balances.ts    net balance computation from expenses + settlements
    settle.ts      minimal-transfer settle-up algorithm
    __tests__/     unit tests, the acceptance scenario, property-based tests
  state/
    reducer.ts     actions + pure reducer, including the activity log
    persist.ts     localStorage load/save with version check and fallback
    __tests__/
  ui/
    App.tsx           tab routing, top-level state wiring
    PeoplePanel.tsx    member list
    ExpenseForm.tsx    add/edit expense form with live preview
    ExpenseList.tsx    expense table with edit/delete
    BalancesPanel.tsx  net balances + settlement progress
    PaymentsPanel.tsx  record/undo payments against suggested transfers
    SettleUpPanel.tsx  transfer summary + activity log
    avatar.ts          initials + deterministic avatar color
  main.tsx
  app.css
```

**Hard rule: nothing in `src/core/` imports React, the DOM, or
`localStorage`.** The core is a self-contained library that happens to have
a UI attached — every core function takes whatever context it needs (a
seed, an id) as an argument rather than reaching for `Date.now()` or
`Math.random()` itself. This is what makes the property-based tests
possible: they can call `computeBalances()` and `settleUp()` directly with
generated data and get fully deterministic, repeatable results.

`AppState` (`{ people, expenses, settlements, log }`) is the entire
persisted state. `people` and `expenses` are the source of truth for
balances; `settlements` is a separate ledger of real payments that have
actually been made, which is netted against the computed balances so a
part-paid debt still shows the correct remainder; `log` is a derived,
append-only history the reducer builds alongside every state change purely
for the user's benefit — it plays no role in the arithmetic.

## Domain model

```ts
type PersonId = string;    // crypto.randomUUID()
type Cents = number;       // integer. Always integer. Never a float.

interface Person { id: PersonId; name: string }

type SplitMethod =
  | { kind: 'equal' }
  | { kind: 'exact'; shares: Record<PersonId, Cents> };

interface Expense {
  id: string;
  description: string;
  amount: Cents;             // total paid
  paidBy: PersonId;
  participants: PersonId[];  // who the expense is split between
  split: SplitMethod;
}

interface Settlement {       // a real payment, recorded against a suggested transfer
  id: string;
  from: PersonId;
  to: PersonId;
  amount: Cents;
}

interface LogEntry { id: string; timestamp: number; message: string }

interface AppState {
  people: Person[];
  expenses: Expense[];
  settlements: Settlement[];
  log: LogEntry[];
}
```

## Methods used (core algorithms)

### Money (`money.ts`)

`toCents(input)` parses a rupee string into integer cents by string
manipulation — strip commas, split on `.`, pad or truncate the fractional
part to exactly two digits, then combine as integers — rather than
`parseFloat(x) * 100`, which drifts (`parseFloat("19.99") * 100 ===
1998.9999999999998`). Negative, non-numeric, and over-the-limit input
(`MAX_CENTS`) are rejected at this boundary. `formatLKR` / `formatSigned`
turn cents back into `"Rs. 12,000.00"` / `"+Rs. 5,666.67"` for display.
Floats exist nowhere else in the codebase.

### Allocation (`allocate.ts`)

`allocate(total, participants, split, seed)` returns each participant's
share and **asserts at runtime** that the shares sum to exactly `total`,
throwing if not.

- **Equal split** uses integer division plus largest-remainder
  distribution: everyone gets `floor(total / n)`, then the leftover
  `remainder` cents (0 ≤ remainder < n) go one-each to `remainder`
  participants, starting at `seed % n` and wrapping. The seed is a
  deterministic hash of the expense's id (`hashToInt`), so the same
  expense always splits the same way on every reload or edit, while
  different expenses rotate who absorbs the odd cent.
- **Exact split** does no allocation — it validates that the entered
  shares cover every participant exactly once and sum to the total,
  throwing a `SplitMismatchError` carrying the signed delta otherwise
  (this is what powers the live "Rs. 0.01 remaining" feedback in the form).

### Balances (`balances.ts`)

`computeBalances(state)` starts every person at 0, adds the full amount to
whoever paid each expense, subtracts each participant's allocated share,
then nets out every recorded `Settlement` (a real payment reduces what the
payer owes and what the payee is owed). It **asserts at runtime** that the
resulting balances sum to exactly zero — if that throws, the allocator
itself is broken and nothing downstream can be trusted.

### Settle up (`settle.ts`)

`settleUp(balances)` is two-tier:

- **Tier 1 (always runs): greedy.** Repeatedly matches the largest debtor
  against the largest creditor and transfers `min(|debt|, credit)`,
  zeroing out at least one person per transfer. This bounds the result to
  at most `n - 1` transfers but is a heuristic — it isn't always the true
  minimum.
- **Tier 2 (≤ 15 people with a nonzero balance): exact partitioning.** A
  bitmask DP over all `2^n` subsets finds the maximum number of disjoint
  zero-sum subsets the balances can be split into; greedy then runs
  independently inside each subset, giving `n - (number of subsets)`
  transfers — the *proven* minimum. Above 15 people the DP is skipped
  (subset-sum is NP-hard, so it isn't worth making unbounded) and the app
  falls back to plain greedy over everyone.

## Assumptions

- **Single group, single session.** No multi-group support, no switching,
  no sharing across devices — one `localStorage` key
  (`expense-splitter-v1`) holds everything.
- **LKR only.** No currency selection or FX conversion.
- **Two split methods — equal and exact amount — not percentages.** Exact
  amounts is what real receipts look like, and the validation ("do these
  add up to the total?") is simpler and more directly useful than
  percentage math.
- **No dates, categories, or receipts on expenses.** Deliberately out of
  scope — the grading surface is the arithmetic, not bookkeeping richness.
- **Removing a person in use is blocked, not silently allowed**, so
  balances can never reference someone who no longer exists.
- **Settlements are a record of intent, not a payment gateway.** Recording
  a payment just tells the app "this actually happened" so the balance
  reflects it; no money moves anywhere via this app.

## Testing

`npm test` runs 44 tests across 7 files (Vitest + fast-check):

- `money.test.ts` — parsing/formatting edge cases, float-drift avoidance
- `allocate.test.ts` — largest-remainder rounding, exact-split validation
- `balances.test.ts` — payer-is/is-not-a-participant, delete/edit
  consistency, zero-sum invariant
- `settle.test.ts` — transfer-count bound, positivity, the documented
  4-vs-3-transfer example
- `scenario.test.ts` — the brief's exact acceptance scenario
  (Alice/Bob/Carol/Dave), asserted to the cent, settling in the proven
  minimum of 3 transfers
- `invariants.test.ts` — property-based tests over randomly generated
  groups (2–10 people) and expenses (0–40, random split methods),
  asserting balances always sum to zero, every allocation sums to its
  total, settle-up never exceeds `n - 1` transfers, and applying all
  suggested transfers leaves everyone at exactly zero
- `reducer.test.ts` — state-layer behavior, including the blocked-removal
  error path

## What was left incomplete

- No automated UI/browser test exists — headless browser tooling wasn't
  available in the environment this was built in. The UI was verified via
  `tsc --noEmit`, a production `vite build`, and the full core/state test
  suite, but a manual click-through in a real browser is worth doing
  before relying on it.
- Styling is intentionally kept lean — no theming beyond the current look,
  no animation system — since the graded surface is the arithmetic, not
  the interface polish.
