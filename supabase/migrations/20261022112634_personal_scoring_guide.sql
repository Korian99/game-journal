-- Personal, informative rating meanings. No game scores are changed.
create table public.scoring_guide (
  owner_id uuid not null references auth.users(id) on delete cascade,
  score_threshold smallint not null check (score_threshold between 0 and 100),
  meaning text not null check (length(btrim(meaning)) between 1 and 2000),
  primary key (owner_id, score_threshold)
);
alter table public.scoring_guide enable row level security;
revoke all on public.scoring_guide from public, anon, authenticated;
grant select, insert, update, delete on public.scoring_guide to authenticated;
grant all on public.scoring_guide to service_role;
create policy scoring_owner on public.scoring_guide for all to authenticated
  using (private.is_member() and owner_id = (select auth.uid()))
  with check (private.is_member() and owner_id = (select auth.uid()));

-- Replace one account's complete guide transactionally; callers cannot supply an owner.
create function public.replace_scoring_guide(entries jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare caller uuid := auth.uid(); result jsonb;
begin
  if caller is null or not private.is_member() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if jsonb_typeof(entries) is distinct from 'array' then
    raise exception 'La guía debe ser una lista.' using errcode='22023';
  end if;
  if jsonb_array_length(entries) not between 1 and 101 then
    raise exception 'Usá entre 1 y 101 puntajes.' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(entries) e
    where jsonb_typeof(e) is distinct from 'object'
      or jsonb_typeof(e->'score_threshold') is distinct from 'number'
      or coalesce(e->>'score_threshold','') !~ '^(100|[1-9]?[0-9])$'
      or jsonb_typeof(e->'meaning') is distinct from 'string'
      or length(btrim(coalesce(e->>'meaning',''))) not between 1 and 2000
      or e - 'score_threshold' - 'meaning' <> '{}'::jsonb
  ) then raise exception 'Puntaje o significado inválido.' using errcode='22023';end if;
  if (select count(distinct (e->>'score_threshold')::smallint) from jsonb_array_elements(entries) e)
      <> jsonb_array_length(entries) then
    raise exception 'Cada puntaje debe aparecer una sola vez.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('game-journal-scoring:'||caller::text,0));
  delete from public.scoring_guide where owner_id=caller;
  insert into public.scoring_guide(owner_id,score_threshold,meaning)
    select caller,(e->>'score_threshold')::smallint,btrim(e->>'meaning')
    from jsonb_array_elements(entries) e;
  select jsonb_agg(jsonb_build_object('score_threshold',s.score_threshold,'meaning',s.meaning)
    order by s.score_threshold desc) into result from public.scoring_guide s where s.owner_id=caller;
  return result;
end $$;
revoke all on function public.replace_scoring_guide(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.replace_scoring_guide(jsonb) to authenticated;

-- Keep the existing schedule, snapshot consistency and retention; include personal meanings.
create or replace function private.capture_daily_backup(member_id uuid) returns uuid
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
      'version',5,'kind','game-journal-daily','ownerId',member_id,'exportedAt',stamp,
      'records',coalesce((select jsonb_agg(g.data||p.data||jsonb_build_object(
        'id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),
        'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at) order by p.id)
        from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id
        where p.owner_id=member_id and p.deleted_at is null),'[]'::jsonb),
      'trash',coalesce((select jsonb_agg(g.data||p.data||jsonb_build_object('id',p.id,'gameId',g.id,'deleted_at',p.deleted_at,'updated_at',p.updated_at,'sourceKey',coalesce(p.source_key,''),'sourceSnapshot',p.source_snapshot)) from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id where p.owner_id=member_id and p.deleted_at is not null),'[]'::jsonb),
      'offers',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.offers o where o.owner_id=member_id),'[]'::jsonb),
      'priceHistory',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from public.price_history h where h.owner_id=member_id),'[]'::jsonb),
      'sourceTables',jsonb_build_object(
        'games',coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from public.games g where g.owner_id=member_id),'[]'::jsonb),
        'playthroughs',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.playthroughs p where p.owner_id=member_id),'[]'::jsonb),
        'imports',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.imports i where i.owner_id=member_id),'[]'::jsonb),
        'shared_entries',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.shared_entries s where s.owner_id=member_id),'[]'::jsonb),
        'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.id) from public.notifications n where n.owner_id=member_id),'[]'::jsonb),
        'scoring_guide',coalesce((select jsonb_agg(to_jsonb(s) order by s.score_threshold desc) from public.scoring_guide s where s.owner_id=member_id),'[]'::jsonb),
        'notification_preferences',(select to_jsonb(pref) from public.notification_preferences pref where pref.owner_id=member_id),
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
