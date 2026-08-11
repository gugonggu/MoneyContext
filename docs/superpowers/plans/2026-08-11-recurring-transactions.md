# Recurring Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create user-owned recurring income and expense rules that generate one idempotent transaction per due occurrence.

**Architecture:** A pure date module calculates recurrence dates with deterministic month-end clamping. A server-only service validates rules and ownership through a repository. A security-definer PostgreSQL function creates due transactions and advances rules atomically; the existing occurrence unique index is the final idempotency guard.

**Tech Stack:** TypeScript, Next.js server-only modules, Supabase PostgreSQL/RLS, Vitest.

## Global Constraints

- Timezone: `Asia/Seoul`; recurrence dates are `YYYY-MM-DD` calendar dates.
- Only `INCOME` and `EXPENSE` rules are valid.
- Recurring rules accept only `KRW`; generated transaction `base_amount` equals `amount`.
- Amounts are safe non-negative integers; do not use floating-point money calculations.
- `AUTO_CONFIRM` creates `CONFIRMED`; `REQUIRE_CONFIRMATION` creates `PENDING`.
- A rule update must never alter an already generated transaction.
- Every query scopes by current `user_id`; DB RLS and ownership triggers remain the final tenant-isolation boundary.

---

## File structure

- `src/domain/recurring/schedule.ts`: pure date parsing, due-date calculation, and next-run advancement.
- `src/server/recurring/service.ts`: rule types, input validation, and repository-facing use cases.
- `src/server/recurring/repository.ts`: Supabase mapping, user-scoped CRUD, and RPC invocation.
- `src/server/recurring/index.ts`: current-profile-bound server entry points.
- `supabase/migrations/20260811*_recurring_transaction_generation.sql`: atomic generator function and execution grant.
- `tests/unit/recurring-schedule.test.ts`: calendar-boundary cases.
- `tests/unit/recurring-service.test.ts`: ownership, input, and execution behavior.
- `tests/integration/recurring.test.ts`: TC-REC status and duplicate-generation coverage when Supabase integration credentials are available.

### Task 1: Deterministic recurrence calendar

**Files:**
- Create: `src/domain/recurring/schedule.ts`
- Test: `tests/unit/recurring-schedule.test.ts`

**Interfaces:**
- Produces `nextOccurrenceDate(input: { frequency: "DAILY" | "WEEKLY" | "MONTHLY"; intervalCount: number; dayOfMonth?: number; occurrenceDate: string }): string`.
- Produces `isDueOnOrBefore(nextRunDate: string, today: string): boolean`.

- [ ] **Step 1: Write failing calendar tests**

```ts
expect(nextOccurrenceDate({ frequency: "MONTHLY", intervalCount: 1, dayOfMonth: 31, occurrenceDate: "2026-01-31" })).toBe("2026-02-28");
expect(nextOccurrenceDate({ frequency: "WEEKLY", intervalCount: 2, occurrenceDate: "2026-08-11" })).toBe("2026-08-25");
expect(isDueOnOrBefore("2026-08-15", "2026-08-15")).toBe(true);
```

- [ ] **Step 2: Run the failing test**

Run: `npm test -- tests/unit/recurring-schedule.test.ts`

Expected: FAIL because `@/domain/recurring/schedule` does not exist.

- [ ] **Step 3: Implement the pure date module**

```ts
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function nextOccurrenceDate(input: RecurrenceDateInput): string {
  assertIsoDate(input.occurrenceDate);
  assertPositiveInteger(input.intervalCount, "intervalCount");
  if (input.frequency === "DAILY") return addUtcDays(input.occurrenceDate, input.intervalCount);
  if (input.frequency === "WEEKLY") return addUtcDays(input.occurrenceDate, input.intervalCount * 7);
  assertDayOfMonth(input.dayOfMonth);
  return monthDateWithClamp(input.occurrenceDate, input.intervalCount, input.dayOfMonth);
}
export const isDueOnOrBefore = (nextRunDate: string, today: string) => nextRunDate <= today;
```

- [ ] **Step 4: Run the calendar test**

Run: `npm test -- tests/unit/recurring-schedule.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the calendar unit**

```powershell
git add tests/unit/recurring-schedule.test.ts src/domain/recurring/schedule.ts
git commit -m "feat: add recurring schedule primitive"
```

### Task 2: Rule CRUD and server boundary

**Files:**
- Create: `src/server/recurring/service.ts`
- Create: `src/server/recurring/repository.ts`
- Create: `src/server/recurring/index.ts`
- Test: `tests/unit/recurring-service.test.ts`

**Interfaces:**
- Consumes `nextOccurrenceDate` from Task 1.
- Produces `createRecurringTransactionService(repository)` with `create`, `list`, `update`, `deactivate`, and `generateDue`.
- Repository methods: `findAccount`, `findCategory`, `createRule`, `listRules`, `updateRule`, `deactivateRule`, `generateDue`.

- [ ] **Step 1: Write failing service tests**

```ts
await expect(service.create("user-a", { type: "EXPENSE", amount: 14900, currency: "KRW", accountId: "other-user-account", frequency: "MONTHLY", intervalCount: 1, dayOfMonth: 15, startDate: "2026-08-15", confirmationMode: "AUTO_CONFIRM" })).rejects.toThrow("active account owned");
await expect(service.generateDue("user-a", "2026-08-15")).resolves.toEqual([{ ruleId: "rule-1", occurrenceDate: "2026-08-15", status: "CONFIRMED" }]);
```

- [ ] **Step 2: Run the failing service test**

Run: `npm test -- tests/unit/recurring-service.test.ts`

Expected: FAIL because the recurring service module does not exist.

- [ ] **Step 3: Implement types, validation, repository, and current-user wrappers**

```ts
export type RecurringInput = Readonly<{ type: "INCOME" | "EXPENSE"; amount: number; currency: string; accountId: string; categoryId?: string; memo?: string; frequency: "DAILY" | "WEEKLY" | "MONTHLY"; intervalCount: number; dayOfMonth?: number; startDate: string; endDate?: string; confirmationMode: "AUTO_CONFIRM" | "REQUIRE_CONFIRMATION" }>;
type OwnedActiveAccount = Readonly<{ id: string; userId: string; isActive: boolean }>;
type OwnedActiveCategory = Readonly<{ id: string; userId: string; isActive: boolean }>;
type ValidRecurringInput = RecurringInput & Readonly<{ nextRunDate: string }>;
type RecurringRule = ValidRecurringInput & Readonly<{ id: string; userId: string; isActive: boolean }>;
type GeneratedOccurrence = Readonly<{ ruleId: string; occurrenceDate: string; status: "CONFIRMED" | "PENDING" }>;
export interface RecurringRepository {
  findAccount(userId: string, id: string): Promise<OwnedActiveAccount | null>;
  findCategory(userId: string, id: string): Promise<OwnedActiveCategory | null>;
  createRule(userId: string, input: ValidRecurringInput): Promise<RecurringRule>;
  generateDue(userId: string, today: string): Promise<GeneratedOccurrence[]>;
}
```

`create` rejects an amount that is not a safe non-negative integer, a currency other than `KRW`, invalid ISO dates, `endDate < startDate`, nonpositive `intervalCount`, a monthly missing/out-of-range `dayOfMonth`, inactive/missing account, and inactive/missing category. It saves `nextRunDate: startDate`. `index.ts` obtains `requireCurrentProfile()` and `createSupabaseServerClient()` exactly as the transaction entry point does.

- [ ] **Step 4: Run unit validation and project checks**

Run: `npm test -- tests/unit/recurring-service.test.ts; npm run lint; npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the server boundary**

```powershell
git add src/server/recurring tests/unit/recurring-service.test.ts
git commit -m "feat: add recurring transaction rules"
```

### Task 3: Atomic due-occurrence generation

**Files:**
- Create: `supabase/migrations/20260811*_recurring_transaction_generation.sql`
- Create: `tests/integration/recurring.test.ts`
- Modify: `src/server/recurring/repository.ts`

**Interfaces:**
- Consumes `RecurringRepository.generateDue(userId, today)` from Task 2.
- Produces SQL function `public.generate_due_recurring_transactions(input_today date)` callable by authenticated users.
- Returns generated `rule_id`, `occurrence_date`, and `transaction_status` rows.

- [ ] **Step 1: Write TC-REC integration tests**

```ts
expect(await generateDueAs(userA, "2026-08-15")).toContainEqual({ ruleId, occurrenceDate: "2026-08-15", status: "CONFIRMED" });
expect(await generateDueAs(userA, "2026-08-15")).toEqual([]);
expect(await transactionsFor(userA, ruleId, "2026-08-15")).toHaveLength(1);
expect(await generateDueAs(userB, "2026-08-15")).toEqual([]);
```

Include a `REQUIRE_CONFIRMATION` fixture and assert its generated transaction is `PENDING` and thus excluded from confirmed-income calculations.

- [ ] **Step 2: Run the integration test to establish the failing state**

Run: `npm test -- tests/integration/recurring.test.ts`

Expected: FAIL until the migration is applied and the RPC is implemented; if Supabase test credentials are absent, report the skipped external verification separately and keep unit tests mandatory.

- [ ] **Step 3: Add the transaction-safe migration and repository RPC mapping**

```sql
create function public.generate_due_recurring_transactions(input_today date)
returns table(rule_id uuid, occurrence_date date, transaction_status public.transaction_status)
language plpgsql security definer set search_path = public as $$
  -- Assign `current_user_id := auth.uid()` and raise SQLSTATE 28000 when null.
  -- Select this user's active rules whose `next_run_date <= input_today`, locking each with `FOR UPDATE`.
  -- For each rule, while its occurrence is on/before today and not after `end_date`, insert a row with
  -- `(user_id, type, status, transaction_at, amount, currency, base_amount, account_id, category_id,
  -- memo, recurring_rule_id, recurring_occurrence_date)`, mapping AUTO_CONFIRM to CONFIRMED.
  -- Catch unique_violation around that insert; advance the local occurrence anyway, then update only
  -- the locked rule's next_run_date. Return a row only after an insert succeeds.
$$;
revoke all on function public.generate_due_recurring_transactions(date) from public;
grant execute on function public.generate_due_recurring_transactions(date) to authenticated;
```

The function must create `transaction_at` as the occurrence date in `Asia/Seoul`, copy only rule-owned account/category/memo fields, set `base_amount = amount` for the currently supported KRW rules, and never mutate historical rows.

- [ ] **Step 4: Apply and verify the migration, then run the full relevant suite**

Run: `supabase db push --linked; npm test -- tests/unit/recurring-schedule.test.ts tests/unit/recurring-service.test.ts tests/integration/recurring.test.ts; npm run lint; npm run typecheck; npm run build`

Expected: migration succeeds; TC-REC-001 and TC-REC-002 pass; no duplicate occurrence is stored.

- [ ] **Step 5: Commit the complete Task 21 implementation**

```powershell
git add supabase/migrations src/server/recurring tests/integration/recurring.test.ts
git commit -m "feat: add recurring transaction generation"
```

## Self-review

- Spec coverage: Tasks 1–3 cover rule CRUD, occurrence generation, both confirmation modes, idempotency, TC-REC, ownership, and historical transaction immutability. Cron deployment and UI are intentionally excluded by the approved design.
- Placeholder scan: no unassigned implementation work or undecided behavior remains.
- Type consistency: Task 2 declares the repository `generateDue` contract consumed by Task 3; Task 3's SQL return fields map directly to `GeneratedOccurrence`.
