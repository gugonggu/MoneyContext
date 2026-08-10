# Transaction CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated server-side CRUD for INCOME, EXPENSE, TRANSFER, and ADJUSTMENT transactions.

**Architecture:** A transaction service validates discriminated inputs and current-user account ownership through an injected repository port. A Supabase repository scopes every row mutation by `user_id`; existing RLS policies and ownership triggers remain the database-level protection.

**Tech Stack:** TypeScript, Next.js server modules, Supabase, Vitest.

## Global Constraints

- Amount and base amount are safe integer KRW units; no floating-point arithmetic.
- All timestamps use Asia/Seoul inputs.
- INCOME/EXPENSE/ADJUSTMENT require `accountId`; TRANSFER requires distinct `fromAccountId` and `toAccountId`.
- TRANSFER, including a BANK-to-CREDIT_CARD settlement, is not income, expense, or budget use.
- Foreign transactions store their immutable historical `baseAmount`.
- Every operation is scoped to the authenticated user and protected by RLS.

---

### Task 1: Transaction input contract and service validation

**Files:**
- Create: `src/server/transactions/service.ts`
- Test: `tests/unit/transaction-service.test.ts`

**Interfaces:**
- Produces `createTransactionService(repository)` with `create`, `update`, `list`, and `remove` methods.
- Consumes a `TransactionRepository` port that finds active accounts and persists user-scoped transaction records.

- [ ] **Step 1: Write a failing transfer-shape test**

```ts
await expect(service.create(userId, {
  type: "TRANSFER", amount: 10_000, baseAmount: 10_000,
  currency: "KRW", transactionAt: "2026-08-10T10:00:00+09:00",
  fromAccountId: "bank-a", toAccountId: "bank-a",
})).rejects.toThrow("distinct")
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `cmd /c npm test -- tests/unit/transaction-service.test.ts`
Expected: FAIL because the service does not yet exist.

- [ ] **Step 3: Implement the smallest validation service**

```ts
if (input.type === "TRANSFER") {
  requireDistinctActiveAccounts(userId, input.fromAccountId, input.toAccountId, repository);
} else {
  requireActiveAccount(userId, input.accountId, repository);
}
```

- [ ] **Step 4: Add and pass currency validation tests**

Run: `cmd /c npm test -- tests/unit/transaction-service.test.ts`
Expected: KRW requires equal amount/baseAmount; foreign currency requires a positive decimal exchange rate.

### Task 2: Supabase repository and authenticated transaction facade

**Files:**
- Create: `src/server/transactions/repository.ts`
- Create: `src/server/transactions/index.ts`
- Modify: `tests/unit/transaction-service.test.ts`

**Interfaces:**
- `listTransactionsForCurrentUser`, `createTransactionForCurrentUser`, `updateTransactionForCurrentUser`, and `removeTransactionForCurrentUser` resolve `requireCurrentProfile()` internally.
- Repository queries use `.eq("user_id", userId)` for every transaction read, update, and delete.

- [ ] **Step 1: Add a failing delete ownership test through the service port**

```ts
await expect(service.remove("user-a", "transaction-b")).rejects.toThrow("transaction not found")
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `cmd /c npm test -- tests/unit/transaction-service.test.ts`
Expected: FAIL until missing-row deletion is translated to the service error.

- [ ] **Step 3: Implement repository mapping and facade**

```ts
const { data, error } = await supabase.from("transactions")
  .delete().eq("user_id", userId).eq("id", transactionId).select("id").maybeSingle();
```

- [ ] **Step 4: Run focused tests and TypeScript validation**

Run: `cmd /c npm test -- tests/unit/transaction-service.test.ts` then `cmd /c npm run typecheck`
Expected: PASS.

### Task 3: RLS integration coverage and verification

**Files:**
- Modify: `tests/integration/rls.test.ts`
- Modify: `docs/IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Add User A/User B transaction update and delete assertions**

```ts
expect(data).toEqual([]);
```

- [ ] **Step 2: Run the integration test**

Run: `cmd /c npm test -- tests/integration/rls.test.ts`
Expected: User A cannot update or delete User B's transaction.

- [ ] **Step 3: Run complete verification**

Run: `cmd /c npm test`, `cmd /c npm run lint`, `cmd /c npm run typecheck`, `cmd /c npm run build`
Expected: all commands exit 0.

- [ ] **Step 4: Mark completed Task 18 items and commit**

```text
feat: add transaction services
```
