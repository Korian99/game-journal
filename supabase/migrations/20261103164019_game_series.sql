create table public.game_series (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 80),
 updated_at timestamptz not null default clock_timestamp(),
 unique(id,owner_id)
);
create table public.game_series_members (
 owner_id uuid not null, series_id uuid not null, game_id uuid not null, position integer not null check(position>=0),
 primary key(series_id,game_id), unique(series_id,position),
 foreign key(series_id,owner_id) references public.game_series(id,owner_id) on delete cascade,
 foreign key(game_id,owner_id) references public.games(id,owner_id) on delete cascade
);
alter table public.game_series enable row level security;
alter table public.game_series_members enable row level security;
revoke all on public.game_series,public.game_series_members from public,anon,authenticated;
grant select on public.game_series,public.game_series_members to authenticated;
grant all on public.game_series,public.game_series_members to service_role;
create policy game_series_owner_read on public.game_series for select to authenticated using(private.is_member() and owner_id=(select auth.uid()));
create policy game_series_member_owner_read on public.game_series_members for select to authenticated using(private.is_member() and owner_id=(select auth.uid()));
create function public.get_game_series() returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'updatedAt',s.updated_at,'gameIds',coalesce((select jsonb_agg(m.game_id order by m.position) from public.game_series_members m where m.series_id=s.id and m.owner_id=auth.uid()),'[]'::jsonb)) order by s.name,s.id),'[]'::jsonb) from public.game_series s where s.owner_id=auth.uid() and private.is_member()
$$;
revoke all on function public.get_game_series() from public,anon,authenticated,service_role;
grant execute on function public.get_game_series() to authenticated;
create function private.save_game_series_impl(p_series_id uuid,p_series_name text,p_game_ids uuid[],p_expected_updated_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();stamp timestamptz;result jsonb;
begin
 if caller is null or not private.is_member() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_series_name is null or char_length(btrim(p_series_name)) not between 1 and 80 or p_game_ids is null or cardinality(p_game_ids)>500 or cardinality(p_game_ids)<>(select count(distinct x) from unnest(p_game_ids) x) or exists(select 1 from unnest(p_game_ids) x where x is null) then raise exception 'Invalid series' using errcode='22023';end if;
 if exists(select 1 from unnest(p_game_ids) x left join public.games g on g.id=x and g.owner_id=caller where g.id is null) then raise exception 'NOT_FOUND: game' using errcode='P0002';end if;
 if p_series_id is null then insert into public.game_series(owner_id,name) values(caller,btrim(p_series_name)) returning id,updated_at into p_series_id,stamp;
 else
  update public.game_series set name=btrim(p_series_name),updated_at=clock_timestamp() where id=p_series_id and owner_id=caller and updated_at=p_expected_updated_at returning updated_at into stamp;
  if not found then if exists(select 1 from public.game_series where id=p_series_id and owner_id=caller) then raise exception 'CONFLICT: series changed' using errcode='40001';else raise exception 'NOT_FOUND' using errcode='P0002';end if;end if;
  delete from public.game_series_members where owner_id=caller and series_id=p_series_id;
 end if;
 insert into public.game_series_members(owner_id,series_id,game_id,position) select caller,p_series_id,x.game_id,x.ordinality-1 from unnest(p_game_ids) with ordinality x(game_id,ordinality);
 select jsonb_build_object('id',s.id,'owner_id',s.owner_id,'name',s.name,'updated_at',s.updated_at,'game_ids',coalesce((select jsonb_agg(m.game_id order by m.position) from public.game_series_members m where m.series_id=s.id),'[]'::jsonb)) into result from public.game_series s where s.id=p_series_id and s.owner_id=caller;
 return result;
end $$;
create function private.delete_game_series_impl(p_series_id uuid,p_expected_updated_at timestamptz) returns boolean language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();
begin
 if caller is null or not private.is_member() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 delete from public.game_series where id=p_series_id and owner_id=caller and updated_at=p_expected_updated_at;
 if found then return true;end if;
 if exists(select 1 from public.game_series where id=p_series_id and owner_id=caller) then raise exception 'CONFLICT: series changed' using errcode='40001';end if;
 raise exception 'NOT_FOUND' using errcode='P0002';
end $$;
revoke all on function private.save_game_series_impl(uuid,text,uuid[],timestamptz),private.delete_game_series_impl(uuid,timestamptz) from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.save_game_series_impl(uuid,text,uuid[],timestamptz),private.delete_game_series_impl(uuid,timestamptz) to authenticated;
create function public.save_game_series(series_id uuid,series_name text,game_ids uuid[],expected_updated_at timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$ select private.save_game_series_impl(series_id,series_name,game_ids,expected_updated_at) $$;
create function public.delete_game_series(series_id uuid,expected_updated_at timestamptz) returns boolean language sql security invoker set search_path='' as $$ select private.delete_game_series_impl(series_id,expected_updated_at) $$;
revoke all on function public.save_game_series(uuid,text,uuid[],timestamptz),public.delete_game_series(uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.save_game_series(uuid,text,uuid[],timestamptz),public.delete_game_series(uuid,timestamptz) to authenticated;

-- Snapshot format 7 preserves manually ordered game-level series.
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
      'version',7,'kind','game-journal-daily','ownerId',member_id,'exportedAt',stamp,
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
        'game_series',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.game_series s where s.owner_id=member_id),'[]'::jsonb),
        'game_series_members',coalesce((select jsonb_agg(to_jsonb(sm) order by sm.series_id,sm.position) from public.game_series_members sm where sm.owner_id=member_id),'[]'::jsonb),
        'playthroughs',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.playthroughs p where p.owner_id=member_id),'[]'::jsonb),
        'imports',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.imports i where i.owner_id=member_id),'[]'::jsonb),
        'shared_entries',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.shared_entries s where s.owner_id=member_id),'[]'::jsonb),
        'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.id) from public.notifications n where n.owner_id=member_id),'[]'::jsonb),
        'scoring_guide',coalesce((select jsonb_agg(to_jsonb(s) order by s.score_threshold desc) from public.scoring_guide s where s.owner_id=member_id),'[]'::jsonb),
        'data_check_preferences',coalesce((select jsonb_agg(to_jsonb(c)) from public.data_check_preferences c where c.owner_id=member_id),'[]'::jsonb),
        'data_check_dismissals',coalesce((select jsonb_agg(to_jsonb(d) order by d.entry_id,d.kind) from public.data_check_dismissals d where d.owner_id=member_id),'[]'::jsonb),
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
