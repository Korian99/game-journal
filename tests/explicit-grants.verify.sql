-- Read-only verification. No application rows, secrets, or permissions are changed.
with required_tables(role_name, table_name, privilege) as (
  values
    ('service_role','members','SELECT'),
    ('service_role','members','INSERT'),
    ('service_role','games','SELECT'),
    ('service_role','playthroughs','SELECT'),
    ('service_role','offers','SELECT'),
    ('service_role','push_subscriptions','SELECT'),
    ('service_role','push_subscriptions','DELETE'),
    ('service_role','notifications','SELECT'),
    ('service_role','refresh_runs','SELECT'),
    ('service_role','refresh_runs','INSERT'),
    ('service_role','notification_preferences','SELECT'),
    ('service_role','notification_deliveries','SELECT'),
    ('service_role','notification_deliveries','INSERT'),
    ('service_role','notification_deliveries','UPDATE'),
    ('authenticated','members','SELECT'),
    ('authenticated','games','SELECT'),
    ('authenticated','games','INSERT'),
    ('authenticated','games','UPDATE'),
    ('authenticated','games','DELETE'),
    ('authenticated','playthroughs','SELECT'),
    ('authenticated','playthroughs','INSERT'),
    ('authenticated','playthroughs','UPDATE'),
    ('authenticated','playthroughs','DELETE'),
    ('authenticated','offers','SELECT'),
    ('authenticated','offers','INSERT'),
    ('authenticated','offers','UPDATE'),
    ('authenticated','offers','DELETE'),
    ('authenticated','imports','SELECT'),
    ('authenticated','imports','INSERT'),
    ('authenticated','imports','UPDATE'),
    ('authenticated','imports','DELETE'),
    ('authenticated','price_history','SELECT'),
    ('authenticated','push_subscriptions','SELECT'),
    ('authenticated','push_subscriptions','INSERT'),
    ('authenticated','push_subscriptions','UPDATE'),
    ('authenticated','push_subscriptions','DELETE'),
    ('authenticated','shared_entries','SELECT'),
    ('authenticated','shared_entries','INSERT'),
    ('authenticated','shared_entries','DELETE'),
    ('authenticated','notifications','SELECT'),
    ('authenticated','notification_preferences','SELECT'),
    ('authenticated','backup_runs','SELECT')
), required_columns(role_name, table_name, column_name) as (
  values
    ('service_role','offers','error'),
    ('service_role','offers','checked_at'),
    ('service_role','offers','lease_until'),
    ('service_role','refresh_runs','finished_at'),
    ('service_role','refresh_runs','processed'),
    ('service_role','refresh_runs','failed'),
    ('service_role','notifications','delivered_at'),
    ('authenticated','notifications','read_at'),
    ('authenticated','notification_preferences','discounts'),
    ('authenticated','notification_preferences','targets'),
    ('authenticated','notification_preferences','releases')
), rls_tables(table_name) as (
  values ('members'),('games'),('playthroughs'),('offers'),('price_history'),
    ('imports'),('push_subscriptions'),('notifications'),('refresh_runs'),
    ('shared_entries'),('notification_preferences'),('notification_deliveries'),('backup_runs')
), failures(problem) as (
  select format('Missing %s: %s on public.%s', role_name, privilege, table_name)
  from required_tables
  where not has_table_privilege(role_name, 'public.' || table_name, privilege)
  union all
  select format('Missing %s: UPDATE on public.%s.%s', role_name, table_name, column_name)
  from required_columns
  where not has_column_privilege(role_name, 'public.' || table_name, column_name, 'UPDATE')
  union all
  select 'Missing RLS: public.' || table_name from rls_tables
  where not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=table_name and c.relrowsecurity)
  union all
  select 'Missing service_role schema usage'
  where not has_schema_privilege('service_role','public','USAGE')
  union all
  select 'Notification body is editable by authenticated users'
  where has_column_privilege('authenticated','public.notifications','body','UPDATE')
  union all
  select 'Anonymous clients can read notifications'
  where has_table_privilege('anon','public.notifications','SELECT')
  union all
  select 'Browser clients can access the internal notification queue'
  where has_table_privilege('authenticated','public.notification_deliveries','SELECT')
  union all
  select 'Private backup snapshots are directly readable by API roles'
  where exists(select 1 from (values ('anon'),('authenticated'),('service_role')) r(role_name)
    where has_table_privilege(role_name,'private.backup_snapshots','SELECT'))
)
select case when count(*)=0 then 'PASS' else 'FAIL' end as status,
  coalesce(jsonb_agg(problem), '[]'::jsonb) as failures
from failures;
