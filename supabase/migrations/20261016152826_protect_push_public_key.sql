alter function public.push_public_key() set schema private;
create function public.push_public_key() returns text language sql stable security invoker set search_path='' as $$ select private.push_public_key(); $$;
revoke all on function public.push_public_key() from public,anon;
grant execute on function public.push_public_key() to authenticated;
