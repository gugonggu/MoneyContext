# Full backup and restore design

## Scope

Implement Task 35. A user downloads a complete restore-capable JSON backup and can restore it by replacing their current financial data. The backup is distinct from analysis exports and contains no OAuth tokens, service secrets, invite data, or another user's records.

## Architecture

A server-only backup service reads every user-owned financial table into the `money-context-backup` schema v1. Metadata includes schema version, Seoul export time, base currency, and timezone. A download handler returns an attachment without persisting a backup file.

Restore accepts JSON only through an authenticated server boundary. It validates schema/version and all fields before any write, ignores every backup `user_id`, creates fresh UUID mappings for every entity, rejects references outside the backup graph, and writes the current authenticated id to every restored row.

After preflight succeeds, a single Supabase Cloud RPC transaction deletes the current user's restorable data in dependency order and inserts the remapped graph in restore order. Any error rolls the entire transaction back. The browser never receives a service-role key or a trusted target user id.

## UI and tests

Settings provides backup download, restore file selection, an explicit replacement warning, and confirmation before mutation. Tests cover schema validation, complete round trip, ID remapping, cross-user/reference rejection, and a forced write failure that leaves original data intact.
