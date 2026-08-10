# Transaction CRUD Design

## Scope

Implement Task 18 only: server-side create, read, update, and explicit delete
for confirmed, pending, and cancelled INCOME, EXPENSE, TRANSFER, and
ADJUSTMENT rows. Planned, recurring, installment, category/tag management, and
UI remain separate tasks.

## Architecture

`src/server/transactions/service.ts` will validate a discriminated transaction
input before persistence. It uses a repository port for current-user-scoped
account and transaction reads plus mutations; `repository.ts` maps the port to
Supabase queries and `index.ts` obtains the authenticated profile.

The service accepts integer `amount` and `baseAmount` values, uppercase ISO
currency codes, an Asia/Seoul timestamp, and optional memo/category IDs. For
KRW, amount and base amount must be equal. For another currency,
`exchangeRate` is required as a positive decimal string and the persisted
`baseAmount` remains the historical analysis value.

## Financial Semantics

- INCOME, EXPENSE, and ADJUSTMENT require exactly one user-owned active
  `accountId`.
- TRANSFER requires distinct user-owned active `fromAccountId` and
  `toAccountId`; it cannot be classified as income, expense, or budget use.
- BANK to CREDIT_CARD transfers represent card settlement. They remain a
  transfer, so they never create a second expense.
- Delete is an explicit hard delete, permitted only for the current user's row.
  Future installment-linked deletion behavior belongs to Task 22.

## Verification

Unit tests cover type-specific input shapes, active-account ownership checks,
KRW/foreign-currency contracts, and transfer non-duplication semantics.
Integration tests confirm User A cannot read, update, or delete User B's
transactions and that cross-user account references are rejected.
