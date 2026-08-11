# In-app notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an ownership-safe in-app notification center that creates current financial alerts when opened.

**Architecture:** Pure domain rules build candidates from explicitly supplied Seoul-date data. A server-only repository scopes every query and mutation to the authenticated user, while the facade refreshes candidates before returning notifications. The page renders records and exposes read state.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Cloud, Vitest.

## Global Constraints

- In-app notifications only: no Cron, email, push, or service role key.
- Never accept `user_id` from the browser; scope every query and mutation to the authenticated profile.
- Use Asia/Seoul dates and integer base-currency amounts.
- Budget thresholds use confirmed expenses only; transfers and adjustments are not expenses.

---

### Task 1: Notification candidate domain rules

**Files:** Create `src/domain/notifications/rules.ts`; test `tests/unit/notification-rules.test.ts`.

**Interfaces:** Produce `buildNotificationCandidates(input: NotificationRuleInput): readonly NotificationCandidate[]`. A candidate has `type`, `title`, `message`, `relatedEntityType`, `relatedEntityId`, and stable `dedupeKey`.

- [ ] Write tests for pending recurring confirmation, today/overdue planned rows, card due in 0–3 days, 80/90/100% budget boundaries, and at-risk/overdue savings goals. Include an assertion that a second run has identical dedupe keys.
- [ ] Run `npm.cmd test -- --run tests/unit/notification-rules.test.ts`; expect failure because the module is absent.
- [ ] Implement `NotificationRuleInput` and pure candidate generation. Compare YYYY-MM-DD values, use `baseAmount` only, and place the date or threshold in each dedupe key.
- [ ] Re-run the focused test; expect pass.
- [ ] Commit `feat: add notification rules`.

### Task 2: User-scoped refresh and read-state service

**Files:** Create `src/server/notifications/repository.ts`, `src/server/notifications/service.ts`, and `src/server/notifications/index.ts`; test `tests/unit/notification-service.test.ts` and `tests/integration/notifications.test.ts`.

**Interfaces:** Consume Task 1 candidates. Export `refreshNotificationsForCurrentUser()`, `listNotificationsForCurrentUser()`, and `markNotificationReadForCurrentUser(id: string)`.

- [ ] Write a failing fake-repository service test: refreshing user A twice for the same day inserts one candidate; marking user B's id throws `notification not found`. Add RLS integration coverage that B cannot list or mutate A's notification.
- [ ] Run `npm.cmd test -- --run tests/unit/notification-service.test.ts tests/integration/notifications.test.ts`; expect failure because the service is absent.
- [ ] Define repository methods `getRuleInput`, `findExisting`, `insert`, `list`, and `markRead`. Scope `notifications` reads by `user_id`; scope updates by both `user_id` and notification `id`.
- [ ] In the service, build candidates, omit existing dedupe keys, persist new rows, and list newest first. In the facade use `requireCurrentProfile()` and a Seoul-date helper.
- [ ] Re-run the focused tests; expect pass.
- [ ] Commit `feat: add notification refresh service`.

### Task 3: Notification center UI and verification

**Files:** Create `src/components/notifications/NotificationCenter.tsx` and `src/app/(app)/(shell)/notifications/page.tsx`; modify `src/app/(app)/(shell)/more/page.tsx` and `docs/IMPLEMENTATION_PLAN.md`; test `tests/unit/notification-center.test.tsx`.

**Interfaces:** Consume Task 2 list/read functions. Produce a server-rendered `/notifications` page with read-state interaction.

- [ ] Write a failing component test that renders an unread row, invokes a Korean “읽음 처리” action with its id, hides the action for a read row, and renders an empty state.
- [ ] Run `npm.cmd test -- --run tests/unit/notification-center.test.tsx`; expect failure because the component is absent.
- [ ] Implement accessible title, message, Seoul-formatted timestamp, unread/read state, and a read action that calls only the authenticated server action. Page refreshes and lists on the server. Add the More menu link.
- [ ] Mark all Task 32 checklist items complete. Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.
- [ ] Commit `feat: add in-app finance notifications`.

## Plan self-review

Task 1 covers the five required rules and idempotency. Task 2 covers persistence, ownership, and read state. Task 3 covers the UI and complete verification. Types flow from `NotificationCandidate` through the server facade to the UI; no Cron or external-notification work is included.
