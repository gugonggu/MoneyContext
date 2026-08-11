# GPT Markdown export design

## Scope

Implement Task 33 only. Generate GPT analysis Markdown for the authenticated user's financial data. The default period is the most recent one calendar month; users may choose a calendar month, recent 1/3/6 months, or a direct date range. No OpenAI API call, persisted export history, JSON/CSV export, or cross-user data access is included.

## Architecture

The server facade derives the user from `requireCurrentProfile`, validates a preset and date range, and reads only that user's transactions, accounts, budgets, savings goals, and relevant planning values. A pure formatter converts a normalized read model to Markdown using `EXPORT_FORMATS.md`; it records fixed financial-rule notes, including that transfers, card settlements, and adjustments are excluded from consumption, planned transactions are not actuals, and foreign-history analysis uses stored `base_amount`.

The page renders server-provided initial controls and a client-only form for changing range/preset, previewing returned Markdown, and copying text through `navigator.clipboard`. The client submits only allowed preset/date values; it never supplies a user id.

## Presets and output

Presets are `SPENDING_REVIEW`, `BUDGET_REVIEW`, and `FINANCIAL_HEALTH`. Each has a stable purpose prompt and selects the corresponding sections from the shared read model. Every export includes the exact period, currency, totals, category breakdown, and financial-rule notes. Empty periods render zero totals and an explicit no-transaction note.

## Security and tests

All repository queries apply `user_id`; integration tests prove user B cannot export user A data. Unit tests cover period resolution, preset validation, Markdown sections, stored base amounts, and excluded transaction types. Component tests cover default one-month selection, preview, and clipboard copy.
