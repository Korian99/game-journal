alter function public.read_shared() set schema private;
create function public.read_shared() returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_shared(); $$;
revoke all on function public.read_shared() from public,anon;
grant execute on function public.read_shared() to authenticated;
create policy deny_job_access on public.refresh_runs as restrictive for all to authenticated using(false) with check(false);
