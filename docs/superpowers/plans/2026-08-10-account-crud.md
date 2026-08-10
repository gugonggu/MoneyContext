# Account CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-only, current-user-scoped CRUD services for financial accounts and credit-card settings.

**Architecture:** Keep database access behind an injected repository port so validation is unit-testable without Supabase. The service authenticates through the existing server helper at its composition boundary, normalizes user input, and delegates persisted ownership enforcement to the existing RLS policies and triggers.

**Tech Stack:** TypeScript, Next.js server modules, Supabase, Vitest.

## Global Constraints

- Amounts use integer KRW values; never JavaScript floating-point arithmetic.
- Account writes are scoped to the authenticated user.
- DEBIT links must reference a same-user BANK account.
- Credit-card payment accounts must be same-user BANK accounts.
- Account removal is `is_active = false`; no destructive deletion.
- Existing DB RLS and ownership triggers remain the final cross-user defense.

---

### Task 1: Account service contract and validation

**Files:**
- Create: `src/server/accounts/service.ts`
- Test: `tests/unit/account-service.test.ts`

**Interfaces:**
- Produces `createAccount`, `updateAccount`, and `deactivateAccount`.
- Consumes an `AccountRepository` port exposing `findById`, `create`, `update`, and `deactivate`.

- [ ] **Step 1: Write failing tests**

```ts
expect(await service.createAccount(userId, {
  name: "체크카드", type: "DEBIT", initialBalance: 0,
  linkedAccountId: otherUsersBankId,
})).rejects.toThrow("linked BANK account")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- tests/unit/account-service.test.ts`
Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Implement the smallest service**

```ts
export async function createAccount(userId: string, input: CreateAccountInput, repository: AccountRepository) {
  validateNameAndAmount(input);
  await validateLinkedBank(userId, input, repository);
  return repository.create(userId, normalizedInput);
}
```

- [ ] **Step 4: Run focused and full unit tests**

Run: `cmd /c npm test -- tests/unit/account-service.test.ts` then `cmd /c npm test`
Expected: PASS.

### Task 2: Supabase repository and authenticated facade

**Files:**
- Create: `src/server/accounts/repository.ts`
- Create: `src/server/accounts/index.ts`
- Modify: `tests/unit/account-service.test.ts`

**Interfaces:**
- `createAccountForCurrentUser(input)` resolves the profile via `requireCurrentProfile` and uses a server Supabase client.
- Repository reads and mutations add `eq("user_id", userId)` to every account query.

- [ ] **Step 1: Write a failing repository-port test**

```ts
expect(fakeRepository.deactivate).toHaveBeenCalledWith(userId, accountId)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- tests/unit/account-service.test.ts`
Expected: FAIL because the facade does not pass the authenticated user ID.

- [ ] **Step 3: Implement repository and facade**

```ts
export async function deactivateAccountForCurrentUser(accountId: string) {
  const profile = await requireCurrentProfile();
  return deactivateAccount(profile.id, accountId, createAccountRepository(await createSupabaseServerClient()));
}
```

- [ ] **Step 4: Run verification**

Run: `cmd /c npm test && cmd /c npm run typecheck && cmd /c npm run lint && cmd /c npm run build`
Expected: all commands exit 0.

### Task 3: Integration coverage and task bookkeeping

**Files:**
- Modify: `tests/integration/rls.test.ts`
- Modify: `docs/IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Add a focused User A/User B account write test**

```ts
expect(error).not.toBeNull();
```

- [ ] **Step 2: Run the integration test when Supabase credentials are configured**

Run: `cmd /c npm test -- tests/integration/rls.test.ts`
Expected: User A cannot mutate User B account rows or references.

- [ ] **Step 3: Mark only completed Task 17 checklist items**

- [ ] **Step 4: Commit when a Git repository is available**

```text
feat: add financial account management
```
