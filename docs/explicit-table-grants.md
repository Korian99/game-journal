# Explicit permissions for older tables

Status: prepared locally; not applied to Supabase. Remote SQL awaits owner review and approval.

Supabase's October 30, 2026 change removes automatic API grants for future public tables. Existing tables keep their grants. Explicit permissions are also needed when replaying our migrations on a fresh project.

Migration: ../supabase/migrations/20261022104409_explicit_legacy_worker_grants.sql
Verification: ../tests/explicit-grants.verify.sql

The migration only adds the worker permissions required by current account-admin, price-worker, and notification-worker code. It does not revoke existing access, change data, change RLS, or grant direct access to private backup snapshots. Existing security-definer RPCs continue to perform their privileged writes as their owner, so workers do not need direct INSERT grants on notifications or price_history.

| Older table | Existing explicit signed-in access | New explicit service_role access |
| --- | --- | --- |
| members | SELECT | SELECT, INSERT |
| games | SELECT, INSERT, UPDATE, DELETE | SELECT |
| playthroughs | SELECT, INSERT, UPDATE, DELETE | SELECT |
| offers | SELECT, INSERT, UPDATE, DELETE | SELECT; UPDATE error, checked_at, lease_until |
| price_history | SELECT | None required; record_quote writes via its owner |
| imports | SELECT, INSERT, UPDATE, DELETE | None required |
| push_subscriptions | SELECT, INSERT, UPDATE, DELETE | SELECT, DELETE |
| notifications | SELECT; UPDATE read_at | SELECT; UPDATE delivered_at |
| refresh_runs | None | SELECT, INSERT; UPDATE finished_at, processed, failed |
| shared_entries | SELECT, INSERT, DELETE | None required |

notification_preferences and notification_deliveries already explicitly grant their worker access. backup_runs explicitly grants user SELECT; scheduled backups run directly as postgres. No sequences are needed because table IDs use UUIDs.

## Apply after approval

1. Apply the exact reviewed SQL through Supabase's migration API, atomically.
2. Match the local migration timestamp to the version returned by Supabase.
3. Run the read-only verification SQL. It checks required grants, RLS, and protected notification/backup access without reading application records.
4. Run the security advisor and investigate any new findings.

Local database execution was unavailable during preparation because Docker Desktop is stopped and no psql binary is available. The verification SQL has not been executed remotely. The existing unit suite does not validate PostgreSQL grants.

For every future public table, include explicit grants together with RLS and policies in its creation migration. Do not restore blanket default grants to work around missing permissions.

Source: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
