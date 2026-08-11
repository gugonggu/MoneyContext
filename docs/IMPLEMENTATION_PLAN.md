# Money Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Money Context의 전체 명세를 하나의 완성형 제품으로 구현하되, 독립적으로 테스트 가능한 작은 Task 단위로 순차 개발한다.

**Architecture:** Next.js App Router와 Supabase를 사용하며, 재정 계산은 UI/DB에서 분리된 domain 계층에 둔다. PostgreSQL transaction과 RLS를 이용해 정합성과 사용자 격리를 보장한다.

**Tech Stack:** Next.js, React, TypeScript, Supabase PostgreSQL/Auth/RLS, Google OAuth, Vercel, Vitest, Testing Library, Playwright.

## Global Constraints

- Timezone: `Asia/Seoul`
- Base currency: `KRW`
- Login: Google
- Signup: shared invite code required
- AI: no OpenAI API; Export only
- Deployment: Vercel + Supabase
- Every user-owned table must use RLS.
- Transfer, card settlement, adjustment, installment semantics must follow `BUSINESS_RULES.md`.
- Each Task must end with tests passing and an independently reviewable result.

---

# Stage A — Foundation

### Task 1: Project scaffold and quality gates

**Files:**
- Create project root Next.js files
- Create: `src/`
- Create: `tests/`
- Create: `.env.example`
- Create/Modify: `package.json`

**Produces:** local app, lint, typecheck, unit test, build commands.

- [x] Create Next.js App Router TypeScript project.
- [x] Configure chosen package manager and commit lockfile.
- [x] Configure lint, typecheck, unit tests, Testing Library, Playwright skeleton.
- [x] Add `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e` scripts.
- [x] Add `.env.example` from `SETUP_AND_ENV.md`.
- [x] Run lint/typecheck/test/build and verify all pass.
- [x] Commit: `feat: initialize money context application`.

### Task 2: Supabase clients and auth-safe server boundary

**Files:**
- Create: `src/server/supabase/server.ts`
- Create: `src/server/supabase/admin.ts`
- Create: `src/lib/supabase/client.ts`
- Test: module boundary tests where practical

**Produces:** browser anon client, server session client, server-only admin client.

- [x] Add Supabase dependencies.
- [x] Implement browser client with public URL/anon key only.
- [x] Implement server client using request cookies.
- [x] Implement service-role admin client in server-only module.
- [x] Add guard so admin module cannot be imported by client code.
- [x] Run typecheck/build.
- [x] Commit: `feat: initialize money context application`.

# Stage B — Database and Security

### Task 3: Core schema migration

**Files:**
- Create: `supabase/migrations/<timestamp>_core_schema.sql`
- Create: `supabase/seed.sql`

**Produces:** enums, profiles, app_settings, accounts, card settings, categories, tags.

- [x] Implement enums defined in `DATABASE_SCHEMA.md`.
- [x] Implement profiles/app_settings/accounts/card settings/categories/tags.
- [x] Add FK/check/unique/index constraints.
- [x] Add updated_at trigger helper.
- [x] Apply migrations to the linked Supabase Cloud project with `supabase db push --linked` and verify.
- [x] Commit: `feat: initialize money context application`.

### Task 4: Transaction and planning schema

**Files:**
- Modify/Create migration for transaction entities.

**Produces:** transactions, transaction_tags, recurring, planned, installment.

- [x] Add tables and ownership columns.
- [x] Add transaction-type consistency constraints or validation triggers.
- [x] Add recurring occurrence unique key.
- [x] Add installment relationship constraints.
- [x] Apply migrations to the linked Supabase Cloud project and inspect constraints.
- [x] Commit: `feat: initialize money context application`.

### Task 5: Budget, savings and notification schema

**Produces:** monthly/category budgets, savings goals/contributions, notifications.

- [x] Add tables from `DATABASE_SCHEMA.md`.
- [x] Add period/category unique constraints.
- [x] Add ownership/indexes.
- [x] Apply migrations to the linked Supabase Cloud project and verify.
- [x] Commit: `feat: initialize money context application`.

### Task 6: RLS and cross-user ownership protection

**Files:**
- Create migration with RLS policies/triggers.
- Create integration tests for Supabase policies.

**Produces:** DB-level tenant isolation.

- [x] Enable RLS for every user-owned table.
- [x] Add SELECT/INSERT/UPDATE/DELETE policies.
- [x] Add profiles self-only policies.
- [x] Add cross-user reference validation for account/category/tag relationships.
- [x] Write User A/User B policy tests from `TEST_CASES.md`.
- [x] Run policy tests.
- [x] Commit: `feat: initialize money context application`.

# Stage C — Authentication and Onboarding

### Task 7: Invite gate and OAuth

**Files:**
- Create public invite page
- Create auth callback route
- Create server invite validation service

**Produces:** shared invite code → Google login.

- [ ] Implement hashed invite code validation server-side.
- [ ] Add signup_enabled check.
- [ ] Configure Google provider.
- [ ] Implement callback and profile bootstrap.
- [ ] Test invalid invite, disabled signup, valid OAuth callback.
- [ ] Commit: `feat: add invite-gated social authentication`.

### Task 8: Protected app shell and roles

**Produces:** authenticated route group, USER/ADMIN server authorization.

- [ ] Add authenticated layout.
- [ ] Redirect unauthenticated users.
- [ ] Add server helper to require current profile.
- [ ] Add server helper to require ADMIN.
- [ ] Ensure ADMIN cannot access other users' finance data through admin features.
- [ ] Commit: `feat: add protected application shell`.

### Task 9: Onboarding

**Produces:** profile, salary cycle, initial accounts/cards/liabilities setup.

- [ ] Build onboarding form and validation.
- [ ] Create initial BANK/CASH/LIABILITY accounts.
- [ ] Support initial CREDIT_CARD configuration.
- [ ] Seed default categories for new user.
- [ ] Mark onboarding complete transactionally.
- [ ] Add E2E onboarding test.
- [ ] Commit: `feat: add financial onboarding flow`.

# Stage D — Domain Engine

### Task 10: Money and date primitives

**Files:**
- Create: `src/domain/money/*`
- Create: `src/lib/dates/*`

**Produces:** integer-safe money operations, KRW formatting input helpers, Seoul period helpers.

- [x] Write failing tests for addition/subtraction/format boundaries.
- [x] Implement money primitive without floating-point arithmetic.
- [x] Write salary cycle tests including month-end behavior.
- [x] Implement Asia/Seoul cycle helpers.
- [x] Run tests.
- [x] Commit: `feat: initialize money context application`.

### Task 11: Balance and net-worth engine

**Produces:** account balances, liquid assets, liabilities, net worth.

- [x] Add Golden Tests TC-BAL, TC-TRF, TC-DEBIT.
- [x] Implement balance calculation.
- [x] Implement DEBIT linked-bank semantics.
- [x] Implement general liability calculation.
- [x] Implement net worth calculation interface.
- [x] Run tests.
- [x] Commit: `feat: initialize money context application`.

### Task 12: Credit-card engine

**Produces:** outstanding, billing period, upcoming settlement, remaining limit.

- [x] Add TC-CC tests.
- [x] Implement card purchase outstanding logic.
- [x] Implement billing cycle period parser.
- [x] Implement card settlement transfer semantics.
- [x] Verify no double-counted expense.
- [x] Commit: `feat: initialize money context application`.

### Task 13: Installment engine

**Produces:** installment schedule generation and fee semantics.

- [x] Add TC-INS tests.
- [x] Implement principal split with deterministic remainder allocation.
- [x] Implement scheduled dates aligned with card billing.
- [x] Implement interest fee handling.
- [x] Verify original purchase expense remains one-time.
- [x] Commit: `feat: add installment payment schedule domain`.

### Task 14: Budget engine

**Produces:** actual usage, planned forecast usage, rollover.

- [x] Add TC-BUD and TC-PLAN budget tests.
- [x] Implement monthly budget usage.
- [x] Implement category budget usage.
- [x] Implement positive/negative rollover.
- [x] Implement planned-inclusive forecast usage.
- [x] Commit: `feat: initialize money context application`.

### Task 15: Savings projection engine

**Produces:** contribution total, required monthly amount, status/estimated completion.

- [x] Add TC-SAV tests.
- [x] Implement current contribution total.
- [x] Implement remaining contribution count.
- [x] Implement projection status.
- [x] Commit: `feat: add savings projection status`.

### Task 16: Forecast spendable engine

**Produces:** current cycle forecast, free spendable amount, daily amount.

- [x] Add TC-SPEND tests including duplicate card settlement case.
- [x] Define forecast item provenance/type.
- [x] Implement required future cashflow aggregation.
- [x] Deduplicate card outstanding vs matching settlement schedule.
- [x] Implement free spendable amount.
- [x] Implement daily spendable using today-inclusive remaining days.
- [x] Commit: `feat: initialize money context application`.

# Stage E — Persistence Use Cases

### Task 17: Account CRUD

**Produces:** BANK/CASH/DEBIT/CREDIT_CARD/LIABILITY management.

- [x] Implement repositories with current-user scope.
- [x] Implement create/update/deactivate services.
- [x] Validate DEBIT linked BANK ownership.
- [x] Validate card payment account ownership.
- [x] Add integration tests.
- [x] Commit: `feat: initialize money context application`.

### Task 18: Transaction CRUD

**Produces:** INCOME/EXPENSE/TRANSFER/ADJUSTMENT create/edit/delete.

- [x] Implement input schemas.
- [x] Implement transaction services.
- [x] Enforce type-specific required fields.
- [x] Add integration tests for balances/statistics semantics.
- [x] Commit: `feat: add transaction services`.

### Task 19: Category and tag management

- [x] Implement default seed and user custom categories.
- [x] Implement deactivate behavior.
- [x] Implement tags and transaction tag assignment.
- [x] Add ownership tests.
- [x] Commit: `feat: add categories and tags`.

### Task 20: Planned transactions

- [x] Implement CRUD.
- [x] Implement PLANNED → CONFIRMED transaction conversion atomically.
- [x] Prevent double conversion.
- [x] Add TC-PLAN integration tests.
- [x] Commit: `feat: add planned transaction workflow`.

### Task 21: Recurring transactions

- [x] Implement rule CRUD.
- [x] Implement occurrence generator.
- [x] Implement AUTO_CONFIRM and REQUIRE_CONFIRMATION.
- [x] Enforce idempotency via occurrence unique key.
- [x] Add TC-REC tests.
- [x] Commit: `feat: add recurring transaction generation`.

### Task 22: Installment persistence

- [x] Create installment plan together with card expense in one transaction.
- [x] Persist generated payment schedule.
- [x] Implement settlement linkage.
- [x] Add integration tests.
- [x] Commit: `feat: persist installment purchases and settlements`.

### Task 23: Budget and savings persistence

- [x] Implement monthly/category budget CRUD.
- [x] Implement savings goals/contributions CRUD.
- [x] Link contribution to actual transaction when requested.
- [x] Add integration tests.
- [x] Commit: `feat: add budget and savings services`.

# Stage F — Product UI

### Task 24: Responsive navigation and layouts

- [x] Implement mobile Bottom Navigation.
- [x] Implement desktop Sidebar.
- [x] Add responsive route shell.
- [x] Verify keyboard/focus behavior.
- [x] Commit: `feat: add responsive application navigation`.

### Task 25: Quick transaction entry

- [x] Build transaction type switcher.
- [x] Build amount-first input.
- [x] Add category/account quick selectors.
- [x] Add collapsed date/memo/tag/FX/installment options.
- [x] Preserve form state on recoverable error.
- [ ] Add component/E2E tests. (component tests added; formal Playwright E2E deferred to Task 39's E2E infra — manually verified against a real browser + cloud DB instead)
- [x] Commit: `feat: add quick transaction entry`.

### Task 26: Recent pattern recommendations

- [x] Define scoring using recency + frequency.
- [x] Query recent user transactions only.
- [x] Rank category/account combinations.
- [x] Show recommendations without AI.
- [x] Add deterministic scoring tests.
- [x] Commit: `feat: add transaction pattern suggestions`.

### Task 27: Transaction history

- [x] Build mobile date-grouped list.
- [x] Build desktop table.
- [x] Add period/type/account/category/tag/status filters.
- [x] Add memo search and amount range.
- [x] Add edit/delete workflow.
- [x] Commit: `feat: add transaction history`.

### Task 28: Asset and card screens

- [x] Build asset summary.
- [x] Build account groups.
- [x] Build credit-card detail with outstanding/payment schedule.
- [x] Add balance reconciliation flow.
- [x] Commit: `feat: add asset and card views`.

### Task 29: Budget, savings and forecast screens

- [x] Build monthly/category budget UI.
- [x] Add rollover settings.
- [x] Build savings goal progress/projection.
- [x] Build future cashflow list and free-spendable summary.
- [x] Commit: `feat: add financial planning views`.

### Task 30: Dashboard

- [ ] Create dashboard read service.
- [ ] Render free spendable and daily amount first.
- [ ] Render income/expense/budget/savings summary.
- [ ] Render asset/card summary.
- [ ] Render budget risks, upcoming events, savings goals.
- [ ] Add snapshot/component tests.
- [ ] Commit: `feat: add financial dashboard`.

### Task 31: Statistics

- [ ] Implement statistics query/read models.
- [ ] Implement monthly/3m/6m trends.
- [ ] Implement category/tag/payment method.
- [ ] Implement fixed/variable, weekday/week-of-month, MoM.
- [ ] Implement savings rate and net-worth trend.
- [ ] Build desktop-rich/mobile-summary visualization.
- [ ] Commit: `feat: add finance statistics`.

### Task 32: Notifications

- [ ] Build notification generation rules.
- [ ] Add budget thresholds 80/90/100.
- [ ] Add recurring confirmation, planned due, card due, savings risk.
- [ ] Build in-app notification center/read state.
- [ ] Commit: `feat: add in-app finance notifications`.

# Stage G — Export, Backup, Administration

### Task 33: GPT Markdown export

- [ ] Implement analysis preset enum/config.
- [ ] Implement period selector.
- [ ] Build export read model.
- [ ] Generate Markdown following `EXPORT_FORMATS.md`.
- [ ] Add preview and clipboard copy.
- [ ] Verify Business Rule notes are included.
- [ ] Commit: `feat: add gpt markdown export`.

### Task 34: JSON and CSV analysis export

- [ ] Implement Analysis JSON schema v1.
- [ ] Implement transaction CSV.
- [ ] Add encoding/content-disposition tests.
- [ ] Verify exports contain only current user data.
- [ ] Commit: `feat: add json and csv exports`.

### Task 35: Full backup and restore

- [ ] Implement Backup JSON schema v1.
- [ ] Implement full backup export.
- [ ] Implement preflight schema validation.
- [ ] Implement UUID/user ownership remapping.
- [ ] Implement transactional restore.
- [ ] Add TC-BACKUP tests.
- [ ] Commit: `feat: add full backup and restore`.

### Task 36: Admin invite settings

- [ ] Build ADMIN-only signup settings.
- [ ] Implement invite code rotation using hash.
- [ ] Implement signup enabled toggle.
- [ ] Verify ADMIN cannot browse finance data of other users.
- [ ] Commit: `feat: add invite administration`.

### Task 37: Account deletion

- [ ] Build deletion warning and backup shortcut.
- [ ] Add explicit confirmation.
- [ ] Delete user-owned data and auth account server-side.
- [ ] Add failure-path integration tests.
- [ ] Commit: `feat: add account deletion flow`.

# Stage H — Hardening and Release

### Task 38: Security regression suite

- [ ] Run all RLS/IDOR tests.
- [ ] Test modified UUID requests.
- [ ] Inspect client bundle/env usage for service key leaks.
- [ ] Test export/restore ownership.
- [ ] Fix discovered security defects.
- [ ] Commit: `test: harden user finance data isolation`.

### Task 39: Full E2E suite

- [ ] Implement E2E-001 onboarding.
- [ ] Implement E2E-002 card lifecycle.
- [ ] Implement E2E-003 export.
- [ ] Add recurring/planned/budget/savings critical paths.
- [ ] Run E2E in clean DB.
- [ ] Commit: `test: add money context critical e2e flows`.

### Task 40: Production deployment

- [ ] Configure production Supabase.
- [ ] Apply migrations from clean state.
- [ ] Configure Google production redirects.
- [ ] Configure Vercel production env.
- [ ] Set initial ADMIN and invite configuration.
- [ ] Run production smoke tests.
- [ ] Verify RLS with two production-safe test accounts before real data entry.
- [ ] Commit final deployment documentation updates.

# Completion Gate

다음을 모두 만족해야 프로젝트 완료로 본다.

- [ ] `MONEY_CONTEXT_SPEC.md` Definition of Done 충족
- [ ] 모든 Golden Test 통과
- [ ] RLS/IDOR 테스트 통과
- [ ] lint/typecheck/unit/integration/E2E/build 통과
- [ ] card payment가 expense를 중복 생성하지 않음
- [ ] installment 구매가 구매월에 한 번만 소비로 집계됨
- [ ] transfer가 수입/지출에서 제외됨
- [ ] backup → restore round trip 성공
- [ ] GPT Markdown/JSON/CSV Export가 현재 사용자 데이터만 포함
- [ ] 모바일/PC 핵심 사용 흐름 검증
