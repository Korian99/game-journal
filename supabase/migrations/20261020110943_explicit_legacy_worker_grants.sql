-- Make legacy worker permissions reproducible without Supabase's default grants.
-- Additive only: existing grants, RLS policies, data, and private backups are preserved.

grant usage on schema public to service_role;

-- Account invitations and membership checks.
grant select, insert on table public.members to service_role;

-- Release candidates, notification delivery, and price-job bookkeeping.
grant select on table
  public.games,
  public.playthroughs,
  public.offers,
  public.push_subscriptions,
  public.notifications,
  public.refresh_runs
to service_role;

-- Price-worker failure handling and job results.
grant update (error, checked_at, lease_until)
  on table public.offers to service_role;
grant insert on table public.refresh_runs to service_role;
grant update (finished_at, processed, failed)
  on table public.refresh_runs to service_role;

-- Acknowledge notifications and remove expired push subscriptions.
grant update (delivered_at) on table public.notifications to service_role;
grant delete on table public.push_subscriptions to service_role;
