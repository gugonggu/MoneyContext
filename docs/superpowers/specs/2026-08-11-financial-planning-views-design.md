# Financial Planning Views Design

## Scope

Implement Task 29 in the existing `plans` route. The route provides three independent sections: monthly and category budget management, savings-goal progress and management, and a future-cashflow/free-spendable summary. It uses the existing planning persistence services and budget, savings, and forecast domain functions.

## Architecture

The route is a Server Component that reads only the current user's accounts, confirmed transactions, planned transactions, recurring rules, card schedules, budgets, savings goals, and contributions through server-only repositories. A dedicated planning read service maps these records into display models; it delegates every financial calculation to existing domain functions. Interactive create, update, deactivate, and contribution forms are focused Client Components that submit Server Actions. Server Actions authenticate the current profile, validate integer form input, and call the existing planning services.

## User Experience

The page begins with a free-spendable summary and the future cashflow items that determine it. The budget section shows the selected month, total budget usage, category usage, forecast usage including planned expenses, and rollover values. The savings section shows each active goal's contribution total, remaining amount, required monthly contribution, and completion/overdue state. Users can manage monthly budgets, category budgets, goals, and contributions in their respective sections without leaving the route.

## Constraints and Error Handling

All reads and mutations are scoped to the current user. Confirmed EXPENSE records alone count toward actual budget use; transfers, adjustments, pending/cancelled transactions, and card settlements remain excluded. Planned transactions affect forecast only. Credit-card outstanding and matching settlement schedules use provenance identifiers to avoid duplicate forecast deductions. Forms keep user-entered values and display server validation errors. No new tables, migrations, financial semantics, or automatic transfers are introduced.

## Tests

Unit tests cover the planning read service's budget, savings, forecast, and user-isolation models. Component tests cover summary rendering and recoverable form errors. Integration tests cover the current-user service calls already provided by Task 23 and any new read queries. The full unit/integration suite, lint, typecheck, and production build must pass.
