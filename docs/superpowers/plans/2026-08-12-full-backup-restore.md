# Full Backup and Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download and transactionally restore a complete user-owned financial backup with safe ID remapping.

**Architecture:** Pure schema validation and remapping run before mutation. Server-only read/write services derive the authenticated user, while a Cloud Supabase RPC performs the delete-and-reinsert graph atomically. Settings UI requires explicit confirmation.

**Tech Stack:** Next.js 16, TypeScript, Supabase Cloud/Postgres RPC, Vitest.

> **Status reconciliation (2026-08-12):** Tasks 1, 2, and 3 are complete and committed. Task 4 remains the scope of the active Task 35 work.

## Global Constraints

- Backup schema is `money-context-backup` version `1`; include Seoul metadata.
- Include only current user financial data; never export tokens, secrets, invite data, or app settings.
- Restore ignores payload user IDs, maps every entity to new UUIDs/current user, rejects dangling/cross-user references.
- Preflight before write; one database transaction; no partial restore on failure.

---

### Task 1: Backup schema validation and remapping

**Files:** Create `src/domain/backup/{schema,validate,remap}.ts`; tests `tests/unit/backup-schema.test.ts`, `tests/unit/backup-remap.test.ts`.

- [x] Write failing tests for v1 metadata, required collections, invalid enum/amount/date rejection, deterministic fresh-ID maps, payload user-id replacement, and dangling reference rejection.
- [x] Run focused tests; expect missing module failure.
- [x] Implement pure parse/validate/remap functions.
- [x] Re-run focused tests and commit `feat: add backup schema validation`.

### Task 2: User-scoped backup export

**Files:** Create `src/server/backup/{repository,service,index}.ts`, `src/app/api/backup/route.ts`; tests `tests/unit/backup-service.test.ts`, `tests/integration/backup-export.test.ts`.

- [x] Write failing tests for all collections, absent sensitive fields, attachment headers, and A/B user isolation.
- [x] Implement user-scoped reads and schema-v1 JSON attachment.
- [x] Re-run tests/typecheck and commit `feat: add full backup export`.

### Task 3: Atomic restore RPC and service

**Files:** Create Cloud migration `supabase/migrations/*_backup_restore.sql`; modify `src/server/backup/*`; tests `tests/integration/backup-restore.test.ts`.

- [x] Write failing round-trip, cross-user payload, forced-failure rollback, profile restore, and direct-RPC denial tests.
- [x] Implement authenticated preflight then service-role-only RPC-based transactional replacement, safe profile-field restore, and remapped inserts.
- [x] Apply migrations to linked Supabase Cloud, verify remote migrations, run integration tests, and commit transactional restore changes.

### Task 4: Settings backup/restore UI

**Files:** Create `src/components/settings/BackupRestore.tsx`; modify settings page and plan; test `tests/unit/backup-restore.test.tsx`.

- [ ] Write failing tests for download, JSON file selection, replacement warning, confirmation, and error state.
- [ ] Implement accessible controls; no user id in client mutation.
- [ ] Run full test/typecheck/lint/build, mark Task 35 complete, commit `feat: add full backup and restore`.
