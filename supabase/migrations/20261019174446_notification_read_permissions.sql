
-- Supabase's legacy default table grants must be revoked before column-only updates.
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
alter publication supabase_realtime add table public.notifications;
