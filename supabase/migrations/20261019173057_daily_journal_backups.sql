
-- Personal application-data snapshots. These are NOT off-project disaster recovery.
create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  backup_day date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  status text not null check (status in ('running','succeeded','failed')),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  record_count integer,
  offer_count integer,
  history_count integer,
  byte_count bigint,
  sha256 text,
  error_code text,
  unique (id, owner_id)
);
create index backup_runs_owner_completed on public.backup_runs(owner_id, completed_at desc);
alter table public.backup_runs enable row level security;
revoke all on public.backup_runs from public, anon, authenticated;
grant select on public.backup_runs to authenticated;
create policy own_backup_history on public.backup_runs for select to authenticated
  using ((select private.is_member()) and owner_id=(select auth.uid()));

create table private.backup_snapshots (
  run_id uuid primary key,
  owner_id uuid not null,
  payload jsonb not null,
  foreign key (run_id,owner_id) references public.backup_runs(id,owner_id) on delete cascade
);
create index backup_snapshots_owner on private.backup_snapshots(owner_id);
alter table private.backup_snapshots enable row level security;
revoke all on private.backup_snapshots from public, anon, authenticated, service_role;

-- Invoker-only: scheduled by postgres; never callable by a browser or service API.
create function private.capture_daily_backup(member_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare run uuid; snapshot jsonb; stamp timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtextextended('game-journal-backup:' || member_id::text, 0));
  select r.id into run from public.backup_runs r
    join private.backup_snapshots s on s.run_id=r.id
    where r.owner_id=member_id and r.status='succeeded'
      and r.backup_day=(stamp at time zone 'America/Argentina/Buenos_Aires')::date
    order by r.completed_at desc limit 1;
  if run is not null then return run; end if;
  insert into public.backup_runs(owner_id,status) values(member_id,'running') returning id into run;
  begin
    -- One SQL statement gives all source tables the same MVCC snapshot.
    select jsonb_build_object(
      'version',3,'kind','game-journal-daily','ownerId',member_id,'exportedAt',stamp,
      'records',coalesce((select jsonb_agg(g.data||p.data||jsonb_build_object(
        'id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),
        'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at) order by p.id)
        from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id
        where p.owner_id=member_id),'[]'::jsonb),
      'offers',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.offers o where o.owner_id=member_id),'[]'::jsonb),
      'priceHistory',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from public.price_history h where h.owner_id=member_id),'[]'::jsonb),
      'sourceTables',jsonb_build_object(
        'games',coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from public.games g where g.owner_id=member_id),'[]'::jsonb),
        'playthroughs',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.playthroughs p where p.owner_id=member_id),'[]'::jsonb),
        'imports',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.imports i where i.owner_id=member_id),'[]'::jsonb),
        'shared_entries',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.shared_entries s where s.owner_id=member_id),'[]'::jsonb),
        'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.id) from public.notifications n where n.owner_id=member_id),'[]'::jsonb),
        'member',(select to_jsonb(m) from public.members m where m.id=member_id)
      )
    ) into snapshot;
    insert into private.backup_snapshots(run_id,owner_id,payload) values(run,member_id,snapshot);
    update public.backup_runs set status='succeeded',completed_at=clock_timestamp(),
      record_count=jsonb_array_length(snapshot->'records'),
      offer_count=jsonb_array_length(snapshot->'offers'),
      history_count=jsonb_array_length(snapshot->'priceHistory'),
      byte_count=octet_length(snapshot::text),
      sha256=encode(extensions.digest(snapshot::text,'sha256'),'hex')
    where id=run;
    -- Keep the latest 30 successful snapshots, never prune after a failed capture.
    delete from private.backup_snapshots s where s.owner_id=member_id and s.run_id in (
      select r.id from public.backup_runs r join private.backup_snapshots b on b.run_id=r.id
      where r.owner_id=member_id and r.status='succeeded'
      order by r.completed_at desc,r.id desc offset 30
    );
    delete from public.backup_runs r where r.owner_id=member_id
      and r.started_at < stamp-interval '90 days'
      and not exists(select 1 from private.backup_snapshots s where s.run_id=r.id);
  exception when others then
    -- The subtransaction rolls back a partial snapshot. No payloads/errors in public logs.
    update public.backup_runs set status='failed',completed_at=clock_timestamp(),error_code=sqlstate
      where id=run;
  end;
  return run;
end $$;
revoke all on function private.capture_daily_backup(uuid) from public,anon,authenticated,service_role;

create function private.run_daily_backups() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare member_id uuid; results jsonb := '[]'::jsonb; run uuid;
begin
  for member_id in select id from public.members where active order by id loop
    run := private.capture_daily_backup(member_id);
    results := results || jsonb_build_array(jsonb_build_object('runId',run));
  end loop;
  return results;
end $$;
revoke all on function private.run_daily_backups() from public,anon,authenticated,service_role;

create function private.backup_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'checkedAt',now(),
    'latest',(select to_jsonb(r) from public.backup_runs r
       where r.owner_id=(select auth.uid()) and private.is_member()
       order by r.started_at desc,r.id desc limit 1),
    'lastSuccess',(select to_jsonb(r) from public.backup_runs r
       join private.backup_snapshots s on s.run_id=r.id
       where r.owner_id=(select auth.uid()) and private.is_member() and r.status='succeeded'
       order by r.completed_at desc,r.id desc limit 1)
  ) where private.is_member();
$$;
revoke all on function private.backup_status() from public,anon,authenticated,service_role;
grant execute on function private.backup_status() to authenticated;

create function public.backup_status() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.backup_status(); $$;
revoke all on function public.backup_status() from public,anon,service_role;
grant execute on function public.backup_status() to authenticated;

create function private.read_latest_backup() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb; expected text;
begin
  if not private.is_member() then raise exception 'No autorizado'; end if;
  select s.payload,r.sha256 into snapshot,expected from private.backup_snapshots s
    join public.backup_runs r on r.id=s.run_id and r.owner_id=s.owner_id
    where s.owner_id=(select auth.uid()) and r.status='succeeded'
    order by r.completed_at desc,r.id desc limit 1;
  if snapshot is not null and encode(extensions.digest(snapshot::text,'sha256'),'hex')<>expected then
    raise exception 'Backup checksum mismatch';
  end if;
  return snapshot;
end $$;
revoke all on function private.read_latest_backup() from public,anon,authenticated,service_role;
grant execute on function private.read_latest_backup() to authenticated;

create function public.read_latest_backup() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.read_latest_backup(); $$;
revoke all on function public.read_latest_backup() from public,anon,service_role;
grant execute on function public.read_latest_backup() to authenticated;

-- 06:00 UTC = 03:00 Argentina. No secrets or outbound HTTP requests required.
select cron.schedule('game-journal-daily-backup','0 6 * * *','select private.run_daily_backups();');
