# JSON and CSV analysis export design

## Scope

Implement Task 34. The existing authenticated Export read model and period rules are reused to provide Analysis JSON schema v1 and transaction-analysis CSV downloads. Full backup/restore is excluded.

## Architecture

Server route handlers derive the current profile, validate only the established period/preset values, and query solely through the user-scoped export repository. Pure formatters build a JSON object with `metadata`, `period`, `financial_position`, `period_summary`, `budgets`, `credit_cards`, `savings_goals`, `planned_cashflows`, `statistics`, and `transactions`, or a CSV with the documented transaction columns. No user id is accepted from the client.

CSV uses UTF-8 with BOM, RFC-style escaping for commas/quotes/newlines, Seoul transaction dates, and `Content-Disposition: attachment` filenames. Original and stored base amounts are both preserved. JSON excludes OAuth, provider data, secrets, invite codes, and unrelated users.

## Tests

Unit tests verify JSON schema/version, CSV escaping/BOM/header/order, stored base amount, and date/period filtering. Route/integration tests verify content-disposition and that spoofed user IDs cannot return another user's data.
