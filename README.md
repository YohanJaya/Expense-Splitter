# Expense Splitter

A single-session web app that lets a group log shared expenses in LKR, see
who owes whom, record real-world payments against those debts, and settle
up in as few transfers as possible. No login, no accounts, no backend — one
group at a time, persisted to `localStorage` on the device you're using.

## Contents

- [How to run it](#how-to-run-it)
- [How to use it](#how-to-use-it)
- [Features](#features)
- [Architecture](#architecture)
- [Domain model](#domain-model)
- [Core algorithms](#core-algorithms)
- [Assumptions made, and why](#assumptions-made-and-why)
- [What I'd do differently, or build next](#what-id-do-differently-or-build-next)
- [What was left incomplete, and why](#what-was-left-incomplete-and-why)
- [Testing](#testing)

## How to run it

```bash
npm install
npm run dev        # starts the app at http://localhost:5173
npm test           # runs the full test suite (unit + property-based)
npm run typecheck  # tsc --noEmit, strict mode
npm run build      # production build to dist/
```

No `.env` file is needed or used — the app has no backend and no external
services to configure, so there's nothing to keep secret. Fonts load from
Google Fonts over HTTPS; that's the app's only network dependency.

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
  see [Core algorithms](#core-algorithms)) and **exact amount** per
  participant, with live delta validation ("Rs. 0.01 remaining") before
  you can submit a mismatched split
- Edit or delete any expense; balances always reflect a fresh computation,
  never a stale cache
- Live per-person share preview on the expense form, so the rounding
  behavior is visible before you commit
- Net balance table with amounts owed vs. amounts owing, and a settlement
  progress bar
- Minimal settle-up suggestions (greedy, with an exact-optimum fallback —
  see [Core algorithms](#core-algorithms))
- Record and undo real payments against suggested transfers, kept as a
  separate `settlements` ledger from the expenses themselves
- A running, timestamped activity log of everything that's happened in the
  session
- Per-person color-coded avatar chips (deterministic from the person's id,
  so a given person's color never changes across a session)
- State survives a page refresh via `localStorage`; a corrupted or
  version-mismatched stored value falls back to an empty session instead of
  crashing the app

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
possible: they call `computeBalances()` and `settleUp()` directly with
generated data and get fully deterministic, repeatable results.

`AppState` (`{ people, expenses, settlements, log }`) is the entire
persisted state. `people` and `expenses` are the source of truth for
balances; `settlements` is a separate ledger of real payments that have
actually been made, netted against the computed balances so a part-paid
debt still shows the correct remainder; `log` is a derived, append-only
history the reducer builds alongside every state change purely for the
user's benefit — it plays no role in the arithmetic.

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

## Core algorithms

**Money (`money.ts`).** `toCents(input)` parses a rupee string into
integer cents by string manipulation — strip commas, split on `.`, pad or
truncate the fractional part to exactly two digits, then combine as
integers — rather than `parseFloat(x) * 100`, which drifts
(`parseFloat("19.99") * 100 === 1998.9999999999998`). Negative,
non-numeric, and over-the-limit input are rejected at this boundary.
Floats exist nowhere else in the codebase.

**Allocation (`allocate.ts`).** `allocate(total, participants, split, seed)`
returns each participant's share and asserts at runtime that the shares
sum to exactly `total`, throwing if not.

- *Equal split* uses integer division plus largest-remainder distribution:
  everyone gets `floor(total / n)`, then the leftover `remainder` cents
  (0 ≤ remainder < n) go one-each to `remainder` participants, starting at
  `seed % n` and wrapping. The seed is a deterministic hash of the
  expense's id, so the same expense always splits the same way on every
  reload or edit, while different expenses rotate who absorbs the odd
  cent — nobody is systematically penalized the way a fixed
  alphabetical rule would.
- *Exact split* does no allocation — it validates that the entered shares
  cover every participant exactly once and sum to the total, throwing a
  `SplitMismatchError` carrying the signed delta otherwise (this powers
  the live "Rs. 0.01 remaining" feedback in the form).

**Balances (`balances.ts`).** `computeBalances(state)` starts every person
at 0, adds the full amount to whoever paid each expense, subtracts each
participant's allocated share, then nets out every recorded `Settlement`.
It asserts at runtime that the resulting balances sum to exactly zero — if
that throws, the allocator itself is broken and nothing downstream can be
trusted.

**Settle up (`settle.ts`).** Two-tier:

- *Tier 1 (always runs): greedy.* Repeatedly matches the largest debtor
  against the largest creditor and transfers `min(|debt|, credit)`,
  zeroing out at least one person per transfer. Bounds the result to at
  most `n - 1` transfers, but is a heuristic — not always the true
  minimum.
- *Tier 2 (≤ 15 people with a nonzero balance): exact partitioning.* A
  bitmask DP over all `2^n` subsets finds the maximum number of disjoint
  zero-sum subsets the balances can be split into; greedy then runs
  independently inside each subset, giving `n - (number of subsets)`
  transfers — the proven minimum. Above 15 people the DP is skipped
  (subset-sum is NP-hard, so it isn't worth making unbounded) and the app
  falls back to plain greedy over everyone.

## Assumptions made, and why

- **Single group, single session, `localStorage` persistence.** The brief
  explicitly frames this as a single-session tool, not a multi-user app,
  and lists persistence as a judgment call with the guidance to spend time
  on the split/settle-up logic rather than infrastructure. A database or
  backend would add a server, schema, and sync logic to store what is
  really just two small arrays; `localStorage` gives refresh-survival for
  free at near-zero cost, with a version-checked key
  (`expense-splitter-v1`) so a future schema change can't crash on stale
  data.
- **LKR only, no currency selection or FX.** Stated directly in the brief.
- **Two split methods: equal and exact amount, not percentages.** The
  brief allows either; exact amounts is what the brief's own acceptance
  scenario uses, and its validation ("do these add up to the total?") is
  simpler and more directly checkable than percentage math.
- **Removing a person in use is blocked, not silently allowed.** Silently
  deleting a person who's referenced by an expense would leave a dangling
  reference and an unexplained gap in the balances — worse than a small
  UX friction of telling the user why they can't do it yet.
- **Settlements are a record of intent, not a payment gateway.** Recording
  a payment tells the app "this actually happened" so balances reflect
  reality; no money moves anywhere via this app. This came from wanting
  balances to mean something after partial repayment, not just after
  logging expenses — a group rarely settles every debt in one shot.
- **No dates, categories, or receipts on expenses.** Deliberately out of
  scope. None of these affect the correctness of a split or a settle-up,
  and the brief is explicit that split/settle-up correctness is the
  graded surface, not bookkeeping richness.

## What I'd do differently, or build next

- **Multi-currency support**, converting at time of expense entry with a
  locked-in rate per expense (so historical balances don't drift if rates
  change later). Skipped because the brief fixes the currency to LKR and
  FX correctness is its own can of worms — it deserves its own design
  pass, not a bolt-on.
- **Multi-device sync**, so a group could genuinely share one session from
  different phones instead of one person's device being the source of
  truth. This is the natural next step once persistence needs to survive
  more than a refresh, but it requires a real backend and auth story,
  which is exactly the infrastructure the brief steers away from for this
  exercise.
- **A shareable read-only settle-up link** — export or a URL-encoded
  snapshot someone could send to the group without everyone needing the
  app open. Cheap to build, high value, cut only for time.
- **Smarter penny-fairness across the whole history**, not just within a
  single expense. Right now the rotation is per-expense and deterministic,
  which is fair and testable, but a group with very lopsided expense
  counts (one person logs 40 expenses, another logs 2) could in principle
  accumulate more odd cents than a perfectly even long-run distribution
  would. I'd want real usage data before "fixing" this, since Splitwise's
  own history shows this kind of tweak is easy to get wrong.
- **Undo/redo across the whole session**, not just undoing a recorded
  payment. Would use the existing `log` as the event source rather than
  storing separate snapshots.
- **Replacing the bitmask DP's `n ≤ 15` cutoff with a smarter exact
  solver** (e.g. meet-in-the-middle) to raise the ceiling before falling
  back to greedy, since `2^n` becomes impractical exactly where larger,
  more realistic group trips would want it most.

## What was left incomplete, and why

- **No automated UI/browser test.** Headless browser tooling wasn't
  available in the environment this was built in. Given limited time, I
  prioritized the core calculation engine and its property-based tests
  over UI automation — a wrong split calculation is a silent, invisible
  bug that erodes trust in every screen, while a UI regression is
  visible the moment you look at the app. The UI was verified via
  `tsc --noEmit`, a production `vite build`, and a manual click-through,
  but an automated browser suite is the next thing I'd add.
- **No percentage-based split.** The brief asks for one of exact-amount or
  percentage; I picked exact-amount (see [Assumptions](#assumptions-made-and-why))
  and didn't build the other, since building both would have taken time
  away from the rounding and settle-up correctness that's the actual
  point of the exercise.
- **Styling is intentionally lean** — no theming, no animation system,
  no responsive polish beyond basic usability. The brief states directly
  that a correct, plain-looking app beats a beautiful one with wrong
  balances, so time went to the arithmetic and its tests first, and
  styling only as far as "usable and makes the flow clear."
- **No handling for percentages ≠ 100% or exact amounts ≠ total beyond
  basic delta validation** in the sense of offering auto-fix suggestions
  (e.g. "scale everyone up proportionally to hit 100%"). The brief marks
  this as a bonus; I implemented detection and blocking (the live
  "Rs. 0.01 remaining" indicator) but not auto-correction, since
  auto-correction changes what the user actually asked to split and felt
  riskier to get subtly wrong than it was worth in the time available.

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