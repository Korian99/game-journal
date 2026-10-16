select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'game_journal_cron') where not exists(select 1 from vault.secrets where name='game_journal_cron');
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'game_journal_setup') where not exists(select 1 from vault.secrets where name='game_journal_setup');
create table private.price_cache(key text primary key,data jsonb not null,checked_at timestamptz not null default now());
create function public.worker_config() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(name,decrypted_secret),'{}') from vault.decrypted_secrets where name in ('game_journal_cron','game_journal_setup','game_journal_vapid_public','game_journal_vapid_private');
$$;
revoke all on function public.worker_config() from public,anon,authenticated;
grant execute on function public.worker_config() to service_role;
