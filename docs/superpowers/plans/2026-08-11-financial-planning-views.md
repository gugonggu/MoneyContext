# Financial Planning Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Task 29's budget, savings, and future-cashflow views.

**Architecture:** A server-only read service composes existing domain functions and current-user repository rows. The plans route renders that model; focused Client Components submit existing planning-service mutations.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Vitest, Testing Library.

## Global Constraints

- Scope every read and mutation to the current user.
- Keep financial calculations in domain/server code and amounts as integer KRW.
- Actual budget use includes confirmed EXPENSE only; planned transactions affect forecast only.
- Deduplicate card outstanding and settlement deductions with provenance.

---

### Task 1: Planning read model

**Files:**
- Create: `src/server/planning/read-service.ts`, `src/server/planning/read-repository.ts`
- Modify: `src/server/planning/index.ts`
- Test: `tests/unit/planning-read-service.test.ts`

- [ ] Write a failing test that expects actual usage, planned-inclusive forecast usage, savings remaining amount, and provenance-deduplicated free spendable from literal current-user fixtures.
- [ ] Run `npx vitest run tests/unit/planning-read-service.test.ts` and confirm the missing-module failure.
- [ ] Implement `createPlanningReadService(repository).getOverview(userId, period)` using only existing domain functions.
- [ ] Run the focused test, `npm run typecheck`, and `npm run lint`.
- [ ] Commit with `feat: add financial planning read models`.

### Task 2: Plans route and forms

**Files:**
- Modify: `src/app/(app)/(shell)/plans/page.tsx`
- Create: `src/components/planning/PlanningOverview.tsx`, `src/components/planning/PlanningForms.tsx`
- Test: `tests/unit/planning-overview.test.tsx`

- [ ] Write failing component tests for the summary, budget and goal sections, cashflow list, and recoverable form error state.
- [ ] Run `npx vitest run tests/unit/planning-overview.test.tsx` and confirm the missing-component failure.
- [ ] Implement Server Actions that validate form fields and call the existing current-user planning service wrappers; render the overview from Task 1.
- [ ] Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- [ ] Mark Task 29 complete in `docs/IMPLEMENTATION_PLAN.md` and commit with `feat: add financial planning views`.

## Self-Review

The plan contains no schema change, does not alter financial semantics, and keeps UI interaction separate from calculations.
