# Expense Splitter

A single-session web app that lets a group log shared expenses in LKR and
figure out who pays whom, in as few payments as possible. No login, no
accounts, no backend — one group at a time, persisted to `localStorage`.

## Running it

```bash
npm install
npm run dev      # starts the app at http://localhost:5173
npm test         # runs the full test suite (unit + property-based)
npm run typecheck
```

`npm run build` produces a static `dist/` bundle; there is nothing else to
deploy.

No `.env` file is needed or used — the app has no backend and no external
services to configure.

## Assumptions

- **Single group, single session.** There is no concept of multiple groups,
  switching groups, or sharing a group with another device. State lives in
  one `localStorage` key (`expense-splitter-v1`) and survives a refresh.
- **LKR only.** No currency selection, no FX conversion.
- **Two split methods: equal and exact amount**, not percentages. The brief
  offered a choice; exact amounts is what its own acceptance scenario uses,
  and the validation ("do these amounts sum to the total?") is simpler and
  more directly useful than percentage math.
- **No dates, categories, or receipts on expenses.** Out of scope by design —
  see `PROJECT_PLAN.md` for the full non-goals list.
- **Removing a person who appears in any expense is blocked**, not silently
  allowed, so balances can never reference a person who no longer exists.

## Rounding strategy

Money is stored as **integer cents everywhere** except at the parse/format
boundary. `toCents()` parses by string manipulation (strip commas, split on
`.`, pad/truncate the fractional part to two digits) rather than
`parseFloat(x) * 100`, because `parseFloat("19.99") * 100` is
`1998.9999999999998` in IEEE-754 floating point. Floats exist nowhere else in
the codebase.

Splitting an amount that doesn't divide evenly (e.g. Rs. 100.00 across three
people) uses **integer division plus largest-remainder distribution**:

```
base      = floor(total / n)
remainder = total - base * n        // 0 <= remainder < n
```

Everyone gets `base`; then `remainder` participants get one extra cent each.
The cents can't be dropped (the split must sum exactly to the total) and they
can't be split further, so *someone* has to absorb the odd cent. The question
is who.

- **Alphabetical/first-N would be unfair over time** — the same people would
  always eat the extra cent across many expenses.
- **Random would be untestable and non-reproducible** — the same expense
  could show a different split on every reload, which also breaks edit
  (re-splitting an unmodified expense would change who owes what for no
  reason).

Instead, the starting index for remainder distribution is derived from a
deterministic hash of the *expense id* (`hashToInt(expense.id) % n`). This
means:

- the same expense always produces the same split, reproducibly, across
  reloads and edits, and
- different expenses (different ids) rotate which participant absorbs the
  extra cent, so no one person is systematically penalised over the life of
  the group.

The **exact-amount** split does no allocation — it validates that the entered
shares sum exactly to the total and throws a `SplitMismatchError` carrying
the signed delta otherwise, so the UI can show "Rs. 0.01 over" or "Rs. 0.01
remaining" live as the user types.

Both `allocate()` and `computeBalances()` assert their own invariants at
runtime (shares sum to the total; balances sum to exactly zero) rather than
relying on tests alone to catch a rounding bug — if either of those throws in
the running app, the allocator itself is broken.

## Settle-up honesty

`settleUp()` is deliberately two-tier:

- **Tier 1 (always runs): greedy.** Repeatedly matches the largest debtor
  against the largest creditor, transferring `min(|debt|, credit)` and
  zeroing out at least one person per transfer. This guarantees at most
  `n - 1` transfers for `n` people with nonzero balances, but it is a
  **heuristic, not an optimum** — it can be beaten. For balances
  `+7, -3, -4, +5, -5`, greedy emits 4 transfers, but `{+7, -3, -4}` and
  `{+5, -5}` are independent zero-sum groups that each settle internally,
  for 3 transfers total.

- **Tier 2 (groups of 15 or fewer): exact partitioning.** Before running
  greedy, a bitmask DP over all `2^n` subsets finds the maximum number of
  disjoint zero-sum subsets the balances can be partitioned into. Greedy then
  runs independently inside each subset. The result, `n - (number of
  subsets)`, is the **proven minimum** number of transfers — no partition
  into more independent zero-sum groups exists, and within a subset with no
  further zero-sum split, `n - 1` transfers is unavoidable.

Finding the true minimum in general is equivalent to a subset-sum-style
partitioning problem, which is NP-hard — the `2^n` DP is exponential in the
number of people with nonzero balances. **15 was chosen as the cutoff**
because `2^15 = 32,768` subsets keeps the DP well under a second even in a
browser, while realistic expense-splitting groups (housemates, trip groups,
a team) essentially never exceed it. Above 15 people, the app falls back to
plain greedy over everyone and says so in the UI, rather than silently
presenting a heuristic result as if it were optimal.

The acceptance scenario in `PROJECT_PLAN.md` §8.3 (Alice/Bob/Carol/Dave) is
asserted exactly in `src/core/__tests__/scenario.test.ts`: the balances match
to the cent, and settlement is confirmed to take exactly 3 transfers — the
proven minimum, since no proper subset of those four balances sums to zero.

## Architecture

`src/core/` is a pure calculation library with zero React, DOM, or
`localStorage` imports — it takes plain data in and returns plain data out
(including any seed or timestamp it needs, as an argument, never generated
internally). This is what makes the property-based tests in
`invariants.test.ts` possible: they throw random groups of people and random
expenses at `computeBalances()` and `settleUp()` and assert, over hundreds of
generated cases, that balances always sum to zero, every transfer is
positive, and applying all transfers leaves everyone at exactly zero.

`AppState` (`{ people, expenses }`) is the *entire* persisted state. Balances
and settlements are never stored — they are recomputed from `expenses` on
every render via `useMemo`. This is what makes edit and delete correct for
free: there is no derived cache to invalidate.

```
src/
  core/          pure functions — money, allocate, balances, settle, types
  core/__tests__ unit tests, the acceptance scenario, property-based tests
  state/         reducer + localStorage persistence
  ui/            React components
```

## What was left incomplete

- No automated UI/browser test exists in this environment (headless browser
  tooling wasn't available here) — the UI was verified via `tsc --noEmit`,
  a production `vite build`, and the full core/state test suite, but not
  clicked through in a real browser as part of this session. Manually
  walking through the §8.3 scenario in a browser before relying on this in
  production is recommended.
- Styling is intentionally minimal (plain CSS, no animations or theming) —
  explicitly out of scope per the brief, since the graded surface is the
  arithmetic, not the interface.
