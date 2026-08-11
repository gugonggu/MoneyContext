# Asset and Card Views Design

## Scope

Implement Task 28: the asset summary, grouped account list, credit-card detail, and account balance reconciliation flow. This does not add new financial calculations or change transaction semantics.

## Design

A server-only asset read service will query current-user accounts, transactions, card settings, and installment payments, then compose existing domain balance, net-worth, card-outstanding, and installment results into display models. The asset route remains a Server Component; only reconciliation input is a Client Component.

The summary separates liquid assets, liabilities, and net worth. Linked DEBIT accounts are never added as separate assets alongside their BANK account. Credit cards are presented as liability/cashflow information, not assets; their detail shows outstanding amount, available credit, payment date, and upcoming installment payments. Card settlements remain transfers and are not displayed as new expenses.

Each account detail exposes reconciliation. The user enters an actual balance; the system calculates `actual - calculated` and submits one existing `ADJUSTMENT` transaction only when non-zero. ADJUSTMENT alone permits signed `amount` and `base_amount`, so a lower actual balance is represented by a negative adjustment. The adjustment is scoped to the selected owned account and remains excluded from income, expense, and budget statistics under the existing transaction/domain rules.

## Validation and Tests

The read service scopes all data by current user. Reconciliation rejects inactive or unowned accounts and non-integer inputs. Unit/component coverage verifies the summary models, DEBIT de-duplication, card display values, zero-difference no-op, and adjustment-difference behavior. Integration coverage verifies ownership and existing transaction semantics.

## Exclusions

No automatic card settlement, new account schema, account CRUD redesign, or planning/dashboard/statistics UI is included.
