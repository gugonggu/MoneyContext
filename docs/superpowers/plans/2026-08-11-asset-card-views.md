# Asset and Card Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Task 28 asset summary, account groups, credit-card detail, and balance reconciliation.

**Architecture:** A server-only asset read service composes current-user database rows into existing domain engines. Server components render the resulting models; a focused client reconciliation form submits an ADJUSTMENT through the existing transaction service.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Vitest, Testing Library.

## Global Constraints

- All data is scoped to the current user.
- Money uses safe integer KRW units; UI contains no financial calculations.
- DEBIT is not separately included in liquid assets with its linked BANK account.
- Credit-card settlements are transfers, never new expenses.
- Reconciliation creates no transaction for zero difference; non-zero difference creates ADJUSTMENT only. ADJUSTMENT may use signed KRW amounts; every other transaction type remains non-negative.

---

### Task 1: Asset read models

**Files:** Create `src/server/assets/service.ts`, `src/server/assets/repository.ts`, `tests/unit/asset-read-service.test.ts`.

- [ ] Write failing tests for grouped bank/cash/debit/liability records, DEBIT-safe liquid assets, net worth, card outstanding/available limit, and installment schedule mapping.
- [ ] Run `npx.cmd vitest run tests/unit/asset-read-service.test.ts` and confirm missing-module failure.
- [ ] Implement user-scoped repository queries and `createAssetReadService(repository).getOverview(userId)` returning `{ liquidAssets, liabilities, netWorth, accounts, cards }`, using existing domain functions.
- [ ] Run the unit test, typecheck, and lint; all pass.
- [ ] Commit: `feat: add asset and card read models`.

### Task 2: Reconciliation service and tests

**Files:** Create `src/server/assets/reconciliation.ts`, `tests/unit/reconciliation.test.ts`.

- [ ] Write failing tests for owned active account requirement, integer actual balance, `actual - calculated` difference, zero-difference no-op, and ADJUSTMENT transaction input.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement `reconcileAccount(userId, { accountId, actualBalance, transactionAt })`; query calculated balance, return `{ created: false, difference: 0 }` when equal, otherwise call existing transaction service with `type: "ADJUSTMENT"` and signed difference represented according to its established input contract.
- [ ] Run unit tests, typecheck, lint; all pass.
- [ ] Commit: `feat: add account balance reconciliation service`.

### Task 3: Asset UI and component coverage

**Files:** Modify `src/app/(app)/(shell)/assets/page.tsx`; create `src/components/assets/AssetOverview.tsx`, `src/components/assets/ReconciliationForm.tsx`, `tests/unit/asset-overview.test.tsx`.

- [ ] Write failing component tests for account groups, card values/schedule, and zero/non-zero reconciliation submission states.
- [ ] Run the component test and confirm missing component failure.
- [ ] Render overview in the server page using current profile and asset read service; keep only reconciliation interaction in a Client Component; display errors without discarding entered balance.
- [ ] Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run build`; record any unavailable Supabase integration environment without skipping assertions.
- [ ] Mark Task 28 complete in `docs/IMPLEMENTATION_PLAN.md` and commit: `feat: add asset and card views`.

## Self-Review

- Read models, reconciliation, and UI each have a testable boundary.
- The plan covers the approved scope without adding automatic settlements or account CRUD changes.
- Method names and result fields are consistent across all tasks.
