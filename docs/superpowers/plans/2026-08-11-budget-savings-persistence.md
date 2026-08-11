# Budget and Savings Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver server-side, ownership-safe CRUD for budgets, savings goals, and savings contributions, with optional links to confirmed transfer transactions.

**Architecture:** Add a focused server-only planning module: its service validates all domain inputs and ownership preconditions, while its repository maps and persists rows through the caller's Supabase client. A defensive database migration enforces that only a confirmed transfer can back a contribution and that no transfer funds more than one contribution.

**Tech Stack:** TypeScript, Next.js server-only modules, Supabase PostgreSQL/RLS, Vitest, Supabase JS.

## Global Constraints

- Preserve Task 23 scope: no planning UI and no automatic transfer creation.
- Amounts are safe integer KRW minimum units; do not introduce floating-point calculations.
- Validate calendar dates and periods explicitly; dates are interpreted as `Asia/Seoul` calendar dates.
- All user-owned reads and writes must remain scoped by `user_id`; never use the admin client in application repositories.
- A linked contribution is only valid for one current-user, `CONFIRMED`, `TRANSFER` transaction.
- Transfer, expense, and income statistics remain unchanged: linking a contribution is metadata, not a second financial transaction.

---

## File Structure

- `supabase/migrations/20260811120000_enforce_savings_contribution_transfer.sql`: database invariant trigger and global unique transfer link.
- `src/server/planning/service.ts`: planning input/record types, repository interface, validation, and CRUD service factory.
- `src/server/planning/repository.ts`: Supabase adapter with row mapping and user-scoped queries.
- `src/server/planning/index.ts`: re-exports the planning service and repository factory.
- `tests/unit/planning-service.test.ts`: deterministic validation and service-contract coverage using an in-memory repository fake.
- `tests/integration/planning.test.ts`: authenticated Supabase CRUD, RLS, and transfer-link invariant coverage.

### Task 1: Enforce contribution-to-transfer integrity in PostgreSQL

**Files:**
- Create: `supabase/migrations/20260811120000_enforce_savings_contribution_transfer.sql`
- Create: `tests/integration/planning.test.ts`

**Interfaces:**
- Consumes: existing `savings_contributions(goal_id, transaction_id, transfer_id)` and `transactions(user_id, type, status)` tables.
- Produces: the database invariant that `transfer_id`, when non-null, refers to a confirmed `TRANSFER` owned by the contribution user; `transaction_id` is null for Task 23 writes; and one `transfer_id` occurs at most once across all contributions.

- [ ] **Step 1: Write the failing integration assertions for persistence invariants**

  Add an authenticated user fixture modelled on `tests/integration/planned.test.ts`. Insert a profile, two BANK accounts, one savings goal, then create one confirmed transfer through the authenticated client. Assert that a standalone contribution inserts, that the transfer-linked contribution inserts, and that direct inserts with `transaction_id`, a non-transfer transaction, a pending transfer, a different user's transfer, or a reused transfer reject.

  ```ts
  await expect(client.from("savings_contributions").insert({
    user_id: userA.id, goal_id: goalId, amount: 50_000,
    contribution_date: "2026-08-11", transfer_id: transferId,
  })).resolves.toMatchObject({ error: null });

  const duplicate = await client.from("savings_contributions").insert({
    user_id: userA.id, goal_id: secondGoalId, amount: 50_000,
    contribution_date: "2026-08-11", transfer_id: transferId,
  });
  expect(duplicate.error).not.toBeNull();
  ```

- [ ] **Step 2: Run the integration test before the migration**

  Run: `npx vitest run tests/integration/planning.test.ts`

  Expected: FAIL because `transaction_id` and invalid/reused `transfer_id` values are not all rejected by the current schema.

- [ ] **Step 3: Add the minimum migration**

  In `20260811120000_enforce_savings_contribution_transfer.sql`, add:

  ```sql
  create unique index savings_contributions_transfer_id_key
    on public.savings_contributions (transfer_id)
    where transfer_id is not null;

  create function public.validate_savings_contribution_transfer()
  returns trigger language plpgsql as $$
  declare linked_type public.transaction_type; linked_status public.transaction_status; linked_user_id uuid;
  begin
    if new.transaction_id is not null then
      raise exception 'savings contributions must use transfer_id';
    end if;
    if new.transfer_id is not null then
      select type, status, user_id into linked_type, linked_status, linked_user_id from public.transactions where id = new.transfer_id;
      if linked_type is distinct from 'TRANSFER' or linked_status is distinct from 'CONFIRMED' or linked_user_id is distinct from new.user_id then
        raise exception 'transfer_id must reference a current-user confirmed transfer';
      end if;
    end if;
    return new;
  end $$;

  create trigger savings_contributions_validate_transfer
  before insert or update on public.savings_contributions
  for each row execute function public.validate_savings_contribution_transfer();
  ```

- [ ] **Step 4: Reset the local database and re-run invariant coverage**

  Run: `supabase db reset; npx vitest run tests/integration/planning.test.ts`

  Expected: reset succeeds; the standalone and valid transfer cases pass and every invalid-link assertion receives a database error.

- [ ] **Step 5: Commit the independently verifiable schema work**

  ```powershell
  git add supabase/migrations/20260811120000_enforce_savings_contribution_transfer.sql tests/integration/planning.test.ts
  git commit -m "feat: enforce savings contribution transfer links"
  ```

### Task 2: Define and test the planning service contract

**Files:**
- Create: `src/server/planning/service.ts`
- Create: `tests/unit/planning-service.test.ts`

**Interfaces:**
- Consumes: `PlanningRepository` injected by callers.
- Produces: `createPlanningService(repository)` with `list/create/update/removeMonthlyBudget`, `list/create/update/removeCategoryBudget`, `list/create/update/deactivateSavingsGoal`, and `list/create/update/removeSavingsContribution` methods.

- [ ] **Step 1: Write failing service tests with an in-memory repository fake**

  Define a fake that records calls and returns configurable owned category, goal, and transfer records. Cover invalid `year`/`month`, non-integer and negative budget amounts, invalid ISO date, blank goal name, invalid target amount, inactive/cross-user category, missing/cross-user goal, and transfer records whose type/status/user are invalid.

  ```ts
  await expect(service.createCategoryBudget("user-a", {
    year: 2026, month: 8, categoryId: "inactive-category", baseBudget: 100_000,
    rolloverEnabled: false, rolloverAmount: 0,
  })).rejects.toThrow("categoryId must be an active category owned by the current user");

  await expect(service.createSavingsContribution("user-a", {
    goalId: "goal-a", amount: 50_000, contributionDate: "2026-08-11", transferId: "expense-id",
  })).rejects.toThrow("transferId must be a confirmed transfer owned by the current user");
  ```

- [ ] **Step 2: Run the unit tests to establish the red state**

  Run: `npx vitest run tests/unit/planning-service.test.ts`

  Expected: FAIL because `@/server/planning/service` does not exist.

- [ ] **Step 3: Implement service types, validation, and delegation**

  Implement immutable `MonthlyBudgetInput`, `CategoryBudgetInput`, `SavingsGoalInput`, `SavingsContributionInput`, and their record variants. Make the repository expose `findCategory`, `findGoal`, `findTransfer`, CRUD methods, and user-scoped list methods. Validate safe integer amounts, `year` 1–9999, `month` 1–12, valid ISO calendar date, trimmed non-empty goal name, and target/contribution positive amounts. Call `findTransfer` only when `transferId` is present; require `{ userId, type: "TRANSFER", status: "CONFIRMED" }`.

  ```ts
  export type SavingsContributionInput = Readonly<{
    goalId: string; amount: number; contributionDate: string; transferId?: string;
  }>;

  export function createPlanningService(repository: PlanningRepository) {
    return {
      createSavingsContribution: async (userId: string, input: SavingsContributionInput) =>
        repository.createSavingsContribution(userId, await validateContribution(repository, userId, input)),
    };
  }
  ```

- [ ] **Step 4: Run the service tests and complete static checks**

  Run: `npx vitest run tests/unit/planning-service.test.ts; npm run typecheck; npm run lint`

  Expected: all commands exit 0.

- [ ] **Step 5: Commit the service contract**

  ```powershell
  git add src/server/planning/service.ts tests/unit/planning-service.test.ts
  git commit -m "feat: add budget and savings planning service"
  ```

### Task 3: Implement the scoped Supabase repository and end-to-end service coverage

**Files:**
- Create: `src/server/planning/repository.ts`
- Create: `src/server/planning/index.ts`
- Modify: `tests/integration/planning.test.ts`

**Interfaces:**
- Consumes: `PlanningRepository`, `createPlanningService`, and an authenticated `SupabaseClient`.
- Produces: `createPlanningRepository(supabase: SupabaseClient): PlanningRepository`, re-exported from `@/server/planning`.

- [ ] **Step 1: Extend integration coverage through the service API**

  Using two authenticated clients, assert monthly budget create/list/update/remove; category budget create/list/update/remove; goal create/list/update/deactivate; standalone and transfer-linked contribution create/list/update/remove. Assert user B cannot list or mutate user A's records, and an inactive category is rejected through the service.

  ```ts
  const owner = createPlanningService(createPlanningRepository(userAClient));
  const other = createPlanningService(createPlanningRepository(userBClient));
  const goal = await owner.createSavingsGoal(userA.id, {
    name: "Emergency fund", targetAmount: 2_000_000, targetDate: "2027-01-31", monthlyContributionPlan: 200_000,
  });
  await expect(other.updateSavingsGoal(userB.id, goal.id, { ...goal, name: "Other" })).rejects.toThrow("savings goal not found");
  ```

- [ ] **Step 2: Run integration coverage before repository implementation**

  Run: `npx vitest run tests/integration/planning.test.ts`

  Expected: FAIL because `@/server/planning/repository` does not exist.

- [ ] **Step 3: Implement repository row mapping and user-scoped queries**

  Map numeric columns with `Number`, nullable `transfer_id` to optional `transferId`, and snake_case fields to the service records. Scope `find`, `list`, `update`, and `delete` by `.eq("user_id", userId)`. Use `.upsert(..., { onConflict: "user_id,year,month" })` for monthly budgets and `.upsert(..., { onConflict: "user_id,year,month,category_id" })` for category budgets; use explicit `insert`, `update`, and `delete` for goals and contributions. Do not select or write `transaction_id`.

  ```ts
  const { data, error } = await supabase
    .from("savings_contributions")
    .insert({ user_id: userId, goal_id: input.goalId, amount: input.amount,
      contribution_date: input.contributionDate, transfer_id: input.transferId ?? null })
    .select("*").single();
  ```

- [ ] **Step 4: Add the public entry point and run the full verification set**

  Re-export `createPlanningRepository`, `createPlanningService`, and public input/record types from `src/server/planning/index.ts`.

  Run: `npm test; npm run lint; npm run typecheck; npm run build`

  Expected: all commands exit 0. If the integration environment is unavailable, record the exact environment error separately; do not weaken or skip its assertions.

- [ ] **Step 5: Commit Task 23 implementation and update the master plan**

  Mark all Task 23 checklist items complete in `docs/IMPLEMENTATION_PLAN.md`, then:

  ```powershell
  git add src/server/planning tests/integration/planning.test.ts docs/IMPLEMENTATION_PLAN.md
  git commit -m "feat: add budget and savings services"
  ```

## Self-Review

- Spec coverage: Task 1 covers direct-write integrity and RLS-compatible constraints; Task 2 covers safe service validation; Task 3 covers current-user persistence, integration behavior, and the required master-plan update.
- Placeholder scan: no incomplete markers, deferred implementation, or undefined interface references remain.
- Type consistency: `SavingsContributionInput.transferId`, `PlanningRepository.findTransfer`, and `createPlanningService` use the same transfer-link name throughout.
