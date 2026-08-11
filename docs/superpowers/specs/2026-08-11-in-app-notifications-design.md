# In-app notifications design

## Scope

Implement Implementation Plan Task 32. The product provides an in-app notification center only; it must not send email, push, or use a scheduled external job.

## Architecture

Opening the notification center calls a server-only refresh service. It obtains the authenticated profile, reads only that user's recurring transactions, planned transactions, card settings, budgets, savings goals, and confirmed expenses, then evaluates pure notification rules for the Seoul calendar date. The service persists only newly detected notifications and returns the user's notifications newest first.

The repository scopes every read and mutation by `user_id`; the client never supplies a user id. Read-state mutations additionally scope by notification id and `user_id`. Existing notifications table RLS remains the final cross-user safeguard.

## Rules and idempotency

- Recurring confirmation: a pending transaction generated from a recurring rule is awaiting confirmation.
- Planned due: a planned transaction is due today or overdue.
- Card payment due: a configured card payment date is within three days.
- Budget threshold: current confirmed-month expense reaches 80%, 90%, or 100% of a monthly budget.
- Savings risk: an active savings goal has an overdue or at-risk projection.

Each candidate carries a stable type, related entity id, and date/threshold key. Refresh first checks for the same user/type/entity/title/message created on that day, so repeated page opens do not create duplicates. Budget thresholds are independently deduplicated, allowing 80%, 90%, and 100% notices.

## UI and errors

The notification center shows unread/read state, title, message, timestamp, and a Mark as read action. It presents an empty state when no rules match. A failed refresh does not expose another user's data and does not mark existing notifications as read.

## Tests

Unit tests cover each rule, threshold boundaries, Seoul-date handling, and duplicate suppression. Service tests cover ownership-scoped read-state changes. Repository/integration coverage verifies cross-user notification reads and mutations are denied.

## Out of scope

Cron scheduling, email, browser push, and notification preferences are excluded.
