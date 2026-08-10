# Account CRUD Design

## Scope

Implement Task 17 only: server-side account creation, update, listing, and
deactivation. This does not add account UI, transaction CRUD, or schema
changes.

## Design

`src/server/accounts/repository.ts` owns current-user-scoped database reads and
writes. `src/server/accounts/service.ts` owns input validation and account
relationship rules. Callers obtain the authenticated profile through the
existing `requireCurrentProfile` helper, then pass its ID to the service.

All amounts are non-negative integer KRW values represented as decimal strings
at the database boundary. Account names are trimmed and required. A DEBIT
account requires an active BANK account owned by the same user. A credit-card
setting requires its account to be CREDIT_CARD and its payment account to be an
active BANK account owned by the same user. Deactivation updates `is_active`
rather than deleting data.

## Verification

Unit tests exercise input and ownership validation through injected repository
ports. Supabase RLS integration tests remain the database-level protection for
cross-user references. No migration is needed because the existing RLS trigger
already enforces cross-user and account-type reference integrity.
