# Installment Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atomically persist a KRW credit-card installment purchase, its schedule, and a later settlement-transfer link.

**Architecture:** Keep payment scheduling in the existing pure domain module. A server-only service validates accounts and calls authenticated PostgreSQL RPCs; each RPC owns its transaction, uses `auth.uid()`, and retains existing RLS/ownership-trigger defenses.

**Tech Stack:** TypeScript, Next.js server modules, Supabase PostgreSQL/RPC/RLS, Vitest.

## Global Constraints

- Amounts are safe-integer KRW values in TypeScript and `numeric` values in PostgreSQL.
- Dates use `Asia/Seoul` calendar semantics.
- The original purchase is the only `EXPENSE`; installment settlement is a `TRANSFER` and does not affect consumption or budget use.
- All rows and RPC actions are scoped to the authenticated user.

---

### Task 1: Build the pure payment schedule

**Files:**
- Modify: `src/domain/cards/installments.ts`
- Modify: `tests/unit/installment.test.ts`

**Produces:**
`createInstallmentSchedule({ totalAmount, installmentCount, firstPaymentDate, feeAmounts? })`, returning `{ sequence, scheduledDate, principalAmount, feeAmount }[]`.

- [ ] **Step 1: Write failing schedule tests**

```ts
expect(createInstallmentSchedule({ totalAmount: 1_000, installmentCount: 3, firstPaymentDate: "2026-01-31" })).toEqual([
  { sequence: 1, scheduledDate: "2026-01-31", principalAmount: 334, feeAmount: 0 },
  { sequence: 2, scheduledDate: "2026-02-28", principalAmount: 333, feeAmount: 0 },
  { sequence: 3, scheduledDate: "2026-03-31", principalAmount: 333, feeAmount: 0 },
]);
expect(() => createInstallmentSchedule({ totalAmount: 100, installmentCount: 2, firstPaymentDate: "2026-01-01", feeAmounts: [1] })).toThrow("feeAmounts must match installmentCount");
```

- [ ] **Step 2: Verify the new test fails**

Run: `npm test -- tests/unit/installment.test.ts`

Expected: missing `createInstallmentSchedule` export.

- [ ] **Step 3: Add minimal schedule implementation**

Use `splitInstallmentPrincipal`, validate a `YYYY-MM-DD` date and safe non-negative fee amounts, and advance by calendar months with last-day clamping. Return immutable sequence rows.

- [ ] **Step 4: Verify the schedule tests pass**

Run: `npm test -- tests/unit/installment.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/domain/cards/installments.ts tests/unit/installment.test.ts && git commit -m "feat: add installment payment schedule domain"`

### Task 2: Add atomic persistence RPCs and integration coverage

**Files:**
- Create: `supabase/migrations/20260811110000_installment_persistence.sql`
- Create: `tests/integration/installment.test.ts`

**Produces:**
`create_installment_purchase(input_purchase jsonb, payment_schedule jsonb) returns uuid` and `create_installment_settlement(input_payment_id uuid, input_payment_account_id uuid, input_transaction_at timestamptz) returns uuid`.

- [ ] **Step 1: Write failing authenticated integration tests**

```ts
expect(await paymentRows(client, planId)).toHaveLength(3);
expect(await confirmedExpenseRows(client)).toHaveLength(1);
expect(await transaction(transferId)).toMatchObject({ type: "TRANSFER", from_account_id: bankId, to_account_id: cardId });
expect(await payment(paymentId)).toMatchObject({ status: "PAID", settlement_transfer_id: transferId });
```

Also assert invalid schedule creation leaves no transaction or plan, User B cannot read User A payment rows, and a second settlement attempt fails.

- [ ] **Step 2: Verify failure before the migration**

Run: `npm test -- tests/integration/installment.test.ts`

Expected: RPC does not exist.

- [ ] **Step 3: Implement purchase RPC**

Use `security definer`, `set search_path = public`, and derive `current_user_id := auth.uid()`. Require an owned active `CREDIT_CARD`, a confirmed KRW `EXPENSE`, a plan count over one, contiguous schedule sequence, and principal sum equal to purchase amount. Insert transaction, plan, and payments in that order. Revoke `public` and grant `authenticated` execute.

- [ ] **Step 4: Implement settlement RPC**

Lock the owned `SCHEDULED` payment, resolve the plan purchase card, require an owned active `BANK` or `CASH` source, insert one confirmed `TRANSFER` for `principal_amount + fee_amount`, and update the payment to `PAID` with its transfer ID. Reject a previously linked payment. Revoke `public` and grant `authenticated` execute.

- [ ] **Step 5: Run the integration test**

Run: `npm test -- tests/integration/installment.test.ts`

Expected: PASS against the configured Supabase Cloud project; otherwise report the missing environment while retaining the test file.

- [ ] **Step 6: Commit**

Run: `git add supabase/migrations/20260811110000_installment_persistence.sql tests/integration/installment.test.ts && git commit -m "feat: persist installment purchases and settlements"`

### Task 3: Expose a server-only installment service

**Files:**
- Create: `src/server/installments/service.ts`
- Create: `src/server/installments/repository.ts`
- Create: `src/server/installments/index.ts`
- Create: `tests/unit/installment-service.test.ts`

**Produces:**
`createInstallmentService(repository).createPurchase(userId, input)` and `.settlePayment(userId, input)`, plus current-user wrappers.

- [ ] **Step 1: Write failing service tests**

```ts
await expect(service.createPurchase("u", invalidBankCardInput)).rejects.toThrow("CREDIT_CARD");
await expect(service.createPurchase("u", invalidUsdInput)).rejects.toThrow("KRW");
expect(repository.createPurchase).toHaveBeenCalledWith("u", expect.objectContaining({ installmentCount: 3 }));
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/installment-service.test.ts`

Expected: missing service module.

- [ ] **Step 3: Implement minimal repository and service**

Define `InstallmentRepository.findAccount`, `.createPurchase`, and `.settlePayment`. Validate safe integers, KRW, ISO timestamps, active `CREDIT_CARD` purchase account, and active `BANK`/`CASH` settlement account. Derive the schedule through Task 1 and use the two RPCs. In `index.ts`, follow `requireCurrentProfile` and `createSupabaseServerClient` exactly as the planned and transaction modules do.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/unit/installment.test.ts tests/unit/installment-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Run quality gates**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

Expected: all pass. Run `npm run test:e2e` if the Playwright environment is available.

- [ ] **Step 6: Commit**

Run: `git add src/server/installments tests/unit/installment-service.test.ts && git commit -m "feat: add installment persistence service"`

### Task 4: Synchronize the product plan

**Files:**
- Modify: `docs/IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Mark the four Task 22 implementation bullets complete**

Set the purchase atomicity, schedule persistence, settlement linkage, and integration-test checkboxes to `[x]`.

- [ ] **Step 2: Verify scope and commit**

Run: `git diff --check && git add docs/IMPLEMENTATION_PLAN.md && git commit -m "docs: mark installment persistence complete"`

Expected: no whitespace errors and only Task 22 checklist changes.
