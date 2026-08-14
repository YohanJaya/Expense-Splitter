# Claude Code Session History

A chronological record of how this repository was built in Claude Code, kept
alongside [README.md](README.md) (which documents the app itself, not how it
came to exist).

## Summary

The app was built from an empty repository against `PROJECT_PLAN.md` — a
working spec for a React + TypeScript expense splitter with an integer-cent
money model, a deterministic rounding rule, and a two-tier (greedy +
exact-optimum) settle-up algorithm. Claude Code scaffolded the project,
implemented the pure calculation core first with a full test suite, then the
state layer and UI, and verified everything with `tsc --noEmit`, `vitest`,
and a production build. Several feature and polish passes followed —
payments/settlements, an activity log, avatars, and a visual redesign — some
driven from the Claude Code chat, some applied directly in the IDE between
turns.

## Timeline

### 1. Scaffold (`b0a3303`)

No `create-vite` CLI available non-interactively, so the project was
scaffolded by hand: `package.json`, `tsconfig.json` (`strict: true`),
`vite.config.ts`, and the `src/` directory structure from `PROJECT_PLAN.md`
§4.

### 2. Core engine — Phase 1 of the plan (`e0651a6`, `e6a8da7`)

Implemented `src/core/`, kept deliberately free of React/DOM/`localStorage`
imports per the plan's hard rule:

- `types.ts` — `Person`, `Expense`, `SplitMethod`, `AppState`, `Transfer`,
  `SplitMismatchError`
- `money.ts` — `toCents` / `formatLKR` / `formatSigned`, parsing by string
  manipulation to avoid float drift (`parseFloat("19.99") * 100` is
  `1998.9999999999998`; the app never does that)
- `allocate.ts` — equal split via largest-remainder distribution, seeded by
  a deterministic hash of the expense id so rounding is reproducible but
  rotates fairly across expenses; exact split via validation, raising
  `SplitMismatchError` with a signed delta
- `balances.ts` — net balance computation, asserting the zero-sum invariant
  at runtime
- `settle.ts` — greedy settle-up (Tier 1, always runs) plus a bitmask-DP
  exact zero-sum partition (Tier 2, for ≤ 15 people) that recovers the
  proven-minimum transfer count

### 3. Test suite — Phase 2 of the plan (`1a4b07b`)

Vitest + fast-check, covering:

- `money.test.ts`, `allocate.test.ts`, `balances.test.ts`, `settle.test.ts`
  — unit tests for each core module
- `scenario.test.ts` — the plan's exact acceptance scenario
  (Alice/Bob/Carol/Dave), asserted to the cent, settling in the proven
  minimum of 3 transfers
- `invariants.test.ts` — property-based tests over randomly generated
  groups and expenses, asserting balances sum to zero, allocations sum to
  their totals, and settle-up transfers zero every balance out without
  exceeding `n - 1` transfers
- `reducer.test.ts` — the state layer (below)

All 44 tests passed before moving on; `tsc --noEmit` was run clean under
`strict` at every phase boundary.

### 4. State layer — Phase 3 of the plan

`state/reducer.ts` (pure reducer: `ADD_PERSON`, `REMOVE_PERSON` — blocked
via `PersonInUseError` if the person is referenced by an expense —
`ADD_EXPENSE`, `UPDATE_EXPENSE`, `DELETE_EXPENSE`, `RESET`) and
`state/persist.ts` (versioned `localStorage` load/save with a `try/catch`
fallback to an empty session on corrupt or version-mismatched data).

### 5. UI — Phase 4 of the plan

Tab-based UI wired to the reducer via `useReducer` + `useMemo`-derived
balances and transfers: `PeoplePanel`, `ExpenseForm` (with a live per-person
share preview and exact-split delta validation), `ExpenseList`,
`BalancesPanel`, `SettleUpPanel`. Verified with `tsc --noEmit` and a
production `vite build`; no headless-browser tooling was available in the
session's environment, so the UI was not clicked through in an actual
browser as part of this pass — see [README.md](README.md#what-was-left-incomplete)
for that caveat.

### 6. README — Phase 5 of the plan

First pass covering run steps, assumptions, the rounding strategy, and the
settle-up honesty (greedy heuristic vs. proven-minimum DP, and why 15 was
chosen as the cutoff).

### 7. Payments / settlements (`6f40c34`, `aa8df21`, `69697ad`)

Added a `Settlement` ledger (`from`, `to`, `amount`) separate from
`Expense`, plus `PaymentsPanel` to record a real payment against a
suggested transfer (defaulting to the suggested amount, editable) and undo
it later. `computeBalances` nets settlements against expense-derived
balances so a part-paid debt shows the correct remainder. A "New session"
action was added to clear everything after a confirmation prompt.
`BalancesPanel` and `PaymentsPanel` were subsequently simplified to remove
logic that had become unused.

### 8. Input hardening (`dbcab92`, `2925679`)

`toCents` gained a `MAX_CENTS` ceiling with a friendly error message
surfaced live in `ExpenseForm`. Split-preview error handling was improved to
report `SplitMismatchError`'s signed delta directly instead of a generic
message.

### 9. Visual redesign (`8853a81`, `3774d88`)

A full CSS pass: a proper color/typography system (Geist + JetBrains Mono,
CSS custom properties for a consistent palette), redesigned buttons
(`btn-success` / `btn-secondary` / `link-button` variants, including
`danger`/`warn`), and per-person avatar chips (`ui/avatar.ts` — deterministic
initials and a stable color class derived from the person's id, so a given
person's color never changes across a session). `BalancesPanel` gained a
"to receive" / "to pay" split view and a settlement-progress bar.

### 10. Activity log (`c47e220`)

`AppState` gained a `log: LogEntry[]` field. The reducer now appends a
human-readable, timestamped entry on every action (person joined/removed,
expense added/updated/deleted, payment recorded/undone), newest first. This
is presentational only — `log` plays no role in balance or settlement
arithmetic. Surfaced in `SettleUpPanel` (renamed "Summary" in the tab bar)
alongside the transfer list.

### 11. Final polish (`0703cc3`)

`.gitignore` extended to exclude `.env` / `.env.*`, and the README
restructured with a table of contents and clearer section breaks.

### 12. README rewrite (this session, post-redesign)

Because steps 7–11 substantially changed the app's shape — a settlements
ledger, an activity log, avatars, a 5-tab flow instead of 4 — the README was
rewritten from scratch to describe the app as it actually stands, rather
than the Phase-4 version originally documented. It now covers the full
feature set, the user flow, the domain model including `Settlement` and
`LogEntry`, and the core algorithms in more depth.

## Verification performed throughout

- `tsc --noEmit` (strict mode) after every phase and every subsequent
  feature pass
- `vitest run` — full suite, kept green throughout (44 tests as of the last
  check)
- `vite build` — production bundle built successfully
- No automated browser/UI test — flagged as an open gap in the README
  rather than silently skipped

## Notes on how this history was assembled

This file was generated from two sources: the turn-by-turn record of the
Claude Code conversation, and `git log` for commits applied directly in the
IDE between conversation turns (visible above by hash). Where a commit's
content wasn't discussed in the conversation, its description here is
derived from the diff and commit message rather than a first-hand account of
the reasoning behind it.
