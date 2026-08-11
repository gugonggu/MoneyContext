# Budget and Savings Persistence Design

## Scope

Implement Implementation Plan Task 23 only: server-side CRUD for monthly and category budgets, savings goals, and savings contributions. A contribution may be a standalone record or reference one already-confirmed transfer. This task does not create transfers automatically and does not add planning UI.

## Architecture

Add a server-only `src/server/planning` module with a public composition entry point, a service layer, and a Supabase repository. The service owns input and ownership validation; the repository scopes every query by `user_id` and maps database rows to application records. All monetary inputs are non-negative or positive safe integers in KRW minimum units. Dates use ISO calendar-date strings.

The module exposes separate CRUD operations for:

- monthly budgets, keyed by `(userId, year, month)`;
- category budgets, keyed by `(userId, year, month, categoryId)`;
- savings goals, including active/inactive state; and
- savings contributions, including their optional transfer link.

Category-budget writes require an active category owned by the current user. Contribution writes require a goal owned by the current user. If a `transferId` is given, it must identify a current-user transaction whose type is `TRANSFER` and status is `CONFIRMED`.

## Data Integrity

A new migration will make the persisted transfer-link semantics explicit:

- preserve `transfer_id` as the supported link for this feature;
- reject a contribution that has both `transaction_id` and `transfer_id`;
- reject a link to any transaction other than a confirmed transfer; and
- ensure a transfer can be linked to no more than one contribution, even across different goals.

Existing RLS policies and owned-reference triggers continue to constrain all rows to the authenticated user. The additional trigger is a defense-in-depth invariant for direct database writes and future callers. Transaction deletions retain their existing foreign-key behavior; a linked transaction cannot silently orphan a contribution.

## Error Handling

The service rejects invalid periods, dates, unsafe monetary amounts, missing records, inactive categories, and invalid transfer links with clear errors. Repository errors are surfaced rather than converted into empty results. Update and delete operations return not-found errors when the target is outside the caller's ownership scope.

## Test Plan

Add unit tests for validation and service behavior. Add Supabase integration tests covering:

- create, list, update, and remove flows for each entity;
- period/category uniqueness behavior;
- cross-user reads and mutations denied by RLS and service lookup;
- standalone and transfer-linked contributions;
- rejected non-transfer, pending, cross-user, and duplicate transfer links; and
- contribution deletion and transfer-link cleanup behavior.

No UI, automatic transfer creation, budget usage calculation changes, or dashboard work is included.
