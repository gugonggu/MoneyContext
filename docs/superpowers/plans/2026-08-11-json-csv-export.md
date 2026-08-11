# JSON and CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download authenticated-user analysis JSON v1 and transaction CSV for an allowed period.

**Architecture:** Pure formatters transform the existing user-scoped export read model. Server route handlers authenticate, validate period input, call the export facade, and return attachment responses; UI reuses Export controls.

**Tech Stack:** Next.js 16, TypeScript, Supabase Cloud, Vitest.

## Global Constraints

- Current authenticated user data only; no client user ID, secrets, or OAuth data.
- JSON metadata uses schema `money-context-analysis`, version `1`, timezone `Asia/Seoul`.
- CSV has documented columns, UTF-8 BOM, escaped cells, and content-disposition attachment.
- Preserve original and stored base amounts; apply existing period filtering.

---

### Task 1: Analysis JSON and CSV formatters

**Files:** Create `src/domain/export/{analysis-json,csv}.ts`; tests `tests/unit/export-json.test.ts`, `tests/unit/export-csv.test.ts`.

- [ ] Write failing tests for schema metadata/top-level keys, absence of secrets, stored base amounts, CSV header/order/BOM, quote/comma/newline escaping, and Seoul dates.
- [ ] Run focused Vitest; expect missing module failure.
- [ ] Implement `generateAnalysisJson(readModel)` and `generateTransactionCsv(readModel)` as pure functions.
- [ ] Re-run focused tests and commit `feat: add analysis export formatters`.

### Task 2: Authenticated download endpoints

**Files:** Create `src/app/api/export/{json,csv}/route.ts`; modify `src/server/export/*`; tests `tests/integration/export-download.test.ts`.

- [ ] Write failing tests for attachment disposition, content type/BOM, invalid period rejection, and user A/B isolation.
- [ ] Implement authenticated routes using `requireCurrentProfile` and existing period validation; return `Response` attachments only.
- [ ] Run focused tests/typecheck and commit `feat: add export downloads`.

### Task 3: Export download controls

**Files:** Modify `src/components/export/MarkdownExport.tsx`, `docs/IMPLEMENTATION_PLAN.md`; test `tests/unit/export-download-controls.test.tsx`.

- [ ] Write failing tests for JSON/CSV download controls that retain selected period and accessible labels.
- [ ] Implement links/actions to endpoints; mark Task 34 checklist complete.
- [ ] Run full test/typecheck/lint/build and commit `feat: add json and csv exports`.
