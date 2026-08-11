# GPT Markdown Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate copyable GPT-analysis Markdown for only the authenticated user's selected financial period.

**Architecture:** A pure domain formatter consumes a normalized user-scoped read model. A server facade validates the fixed preset/range values, reads Supabase Cloud data through `user_id`, and returns Markdown; a client UI previews and copies it.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Cloud, Vitest.

## Global Constraints

- Default period is recent one calendar month; allow month, recent 1/3/6 months, and direct date range.
- Export contains only the authenticated user's data and no secret/token.
- Use stored `base_amount`; exclude transfers, card settlements, adjustments, and unconfirmed planned rows from actual spending.
- Include required financial-rule notes from `EXPORT_FORMATS.md`.

---

### Task 1: Export period, presets, and Markdown formatter

**Files:** Create `src/domain/export/{period,presets,markdown}.ts`; tests `tests/unit/export-period.test.ts` and `tests/unit/export-markdown.test.ts`.

- [ ] Write failing tests for one-month default, allowed recent/month/custom ranges, invalid ranges, every preset, stored base amounts, excluded transaction types, empty periods, and required rule notes.
- [ ] Run `npm.cmd test -- --run tests/unit/export-period.test.ts tests/unit/export-markdown.test.ts`; expect module-not-found failure.
- [ ] Implement `resolveExportPeriod`, `ExportPreset`, and `generateExportMarkdown(readModel)` with header, position, period summary, relevant preset sections, and notes.
- [ ] Re-run focused tests and commit `feat: add markdown export formatter`.

### Task 2: Authenticated export read model

**Files:** Create `src/server/export/{repository,service,index}.ts`; tests `tests/unit/export-service.test.ts`, `tests/integration/export.test.ts`.

- [ ] Write failing tests proving user A data only, invalid user range rejection, and category/account/tag read-model mapping.
- [ ] Run focused tests; expect missing service failure.
- [ ] Implement user-scoped repository queries and facade using `requireCurrentProfile`; validate inputs before invoking formatter.
- [ ] Re-run focused tests and commit `feat: add markdown export service`.

### Task 3: Preview and clipboard UI

**Files:** Create `src/components/export/MarkdownExport.tsx`; modify `src/app/(app)/(shell)/export/page.tsx`, `docs/IMPLEMENTATION_PLAN.md`; test `tests/unit/markdown-export.test.tsx`.

- [ ] Write failing UI tests for recent-one-month default, preset/range selection, rendered preview, and clipboard copy.
- [ ] Run focused test; expect missing component failure.
- [ ] Implement client controls and copy feedback while retaining server-only data generation; mark Task 33 checklist complete.
- [ ] Run `npm.cmd test`, typecheck, lint, and build; commit `feat: add gpt markdown export`.
