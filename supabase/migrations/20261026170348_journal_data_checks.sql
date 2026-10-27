-- Informative data checks. No existing game or playthrough data is changed.
create table public.data_check_preferences (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 review boolean not null default false,
 console boolean not null default false,
 hours boolean not null default false
);
create table public.data_check_dismissals (
 owner_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid not null references public.playthroughs(id) on delete cascade,
 kind text not null check (kind in ('invalid-start','invalid-finish','date-order','rating-range','hours-range','status-dates','missing-review','missing-console','missing-hours')),
 field_values jsonb not null check (jsonb_typeof(field_values)='array' and jsonb_array_length(field_values)<=3),
 primary key(owner_id,entry_id,kind)
);
alter table public.data_check_preferences enable row level security;
alter table public.data_check_dismissals enable row level security;
revoke all on public.data_check_preferences,public.data_check_dismissals from public,anon,authenticated;
grant select on public.data_check_preferences,public.data_check_dismissals to authenticated;
grant all on public.data_check_preferences,public.data_check_dismissals to service_role;
create policy check_preferences_owner on public.data_check_preferences for select to authenticated
 using(private.is_member() and owner_id=(select auth.uid()));
create policy check_dismissals_owner on public.data_check_dismissals for select to authenticated
 using(private.is_member() and owner_id=(select auth.uid()));

-- Keep this field list aligned with findingFields in lib/journal/data-checks.ts.
create function private.data_check_values(data jsonb,kind text) returns jsonb
language sql immutable set search_path='' as $$
 select case kind
 when 'invalid-start' then jsonb_build_array(coalesce(nullif(data->>'status','backlog'),'wishlist'),coalesce(data->>'started',''))
 when 'invalid-finish' then jsonb_build_array(coalesce(nullif(data->>'status','backlog'),'wishlist'),coalesce(data->>'finished',''))
 when 'date-order' then jsonb_build_array(coalesce(data->>'started',''),coalesce(data->>'finished',''))
 when 'rating-range' then jsonb_build_array(data->'rating')
 when 'hours-range' then jsonb_build_array(data->'hours')
 when 'status-dates' then jsonb_build_array(coalesce(nullif(data->>'status','backlog'),'wishlist'),coalesce(data->>'started',''),coalesce(data->>'finished',''))
 when 'missing-review' then jsonb_build_array(coalesce(nullif(data->>'status','backlog'),'wishlist'),data->'rating')
 when 'missing-console' then jsonb_build_array(coalesce(nullif(data->>'status','backlog'),'wishlist'),coalesce(data->>'device',''))
 when 'missing-hours' then jsonb_build_array(coalesce(nullif(data->>'status','backlog'),'wishlist'),data->'hours')
 else null end
$$;
revoke all on function private.data_check_values(jsonb,text) from public,anon,authenticated;

-- Invalidate once the relevant facts change, even if later edits restore the old value.
create function private.invalidate_data_check_dismissals() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.data_check_dismissals d where d.owner_id=old.owner_id and d.entry_id=old.id
  and private.data_check_values(old.data,d.kind) is distinct from private.data_check_values(new.data,d.kind);
 return new;
end $$;
revoke all on function private.invalidate_data_check_dismissals() from public,anon,authenticated;
create trigger invalidate_check_dismissals after update of data on public.playthroughs
 for each row execute function private.invalidate_data_check_dismissals();

create function public.get_data_check_state() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare caller uuid:=auth.uid();result jsonb;
begin
 if caller is null or not private.is_member() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select jsonb_build_object(
  'preferences',coalesce((select jsonb_build_object('review',p.review,'console',p.console,'hours',p.hours) from public.data_check_preferences p where p.owner_id=caller),'{"review":false,"console":false,"hours":false}'::jsonb),
  'dismissals',coalesce((select jsonb_agg(jsonb_build_object('entry_id',d.entry_id,'kind',d.kind,'values',d.field_values) order by d.entry_id,d.kind) from public.data_check_dismissals d where d.owner_id=caller),'[]'::jsonb)
 ) into result;
 return result;
end $$;
create function public.get_data_check_entry(entry uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select g.data||p.data||jsonb_build_object('id',p.id,'gameId',g.id)
 from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id
 where p.id=entry and p.owner_id=auth.uid() and p.deleted_at is null and private.is_member()
$$;

-- Only this narrow definer can write state; the caller never supplies an owner.
create function public.apply_data_check_command(command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();action text:=command->>'action';key text;enabled boolean;entry uuid;finding_kind text;facts jsonb;
begin
 if caller is null or not private.is_member() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(command) is distinct from 'object' then raise exception 'Invalid check command' using errcode='22023';end if;
 if action='preference' then
  key:=command->>'key';
  if key not in ('review','console','hours') or key is null or jsonb_typeof(command->'enabled') is distinct from 'boolean' or command-'action'-'key'-'enabled'<>'{}'::jsonb then raise exception 'Invalid preference' using errcode='22023';end if;
  enabled:=(command->>'enabled')::boolean;
  insert into public.data_check_preferences as p(owner_id,review,console,hours)
   values(caller,key='review' and enabled,key='console' and enabled,key='hours' and enabled)
   on conflict(owner_id) do update set
    review=case when key='review' then enabled else p.review end,
    console=case when key='console' then enabled else p.console end,
    hours=case when key='hours' then enabled else p.hours end;
 elsif action in ('dismiss','restore') then
  if command-'action'-'entryId'-'kind'-'values'<>'{}'::jsonb or jsonb_typeof(command->'kind') is distinct from 'string' or jsonb_typeof(command->'values') is distinct from 'array' then raise exception 'Invalid finding' using errcode='22023';end if;
  entry:=(command->>'entryId')::uuid;finding_kind:=command->>'kind';
  if finding_kind not in ('invalid-start','invalid-finish','date-order','rating-range','hours-range','status-dates','missing-review','missing-console','missing-hours') or jsonb_array_length(command->'values')>3 then raise exception 'Invalid finding' using errcode='22023';end if;
  select p.data into facts from public.playthroughs p where p.id=entry and p.owner_id=caller and p.deleted_at is null for share;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002';end if;
  if action='dismiss' then
   if private.data_check_values(facts,finding_kind) is distinct from command->'values' then raise exception 'CONFLICT: finding changed' using errcode='40001';end if;
   insert into public.data_check_dismissals(owner_id,entry_id,kind,field_values) values(caller,entry,finding_kind,command->'values')
    on conflict(owner_id,entry_id,kind) do update set field_values=excluded.field_values;
  else
   if exists(select 1 from public.data_check_dismissals d where d.owner_id=caller and d.entry_id=entry and d.kind=finding_kind and d.field_values is distinct from command->'values') then raise exception 'CONFLICT: dismissal changed' using errcode='40001';end if;
   delete from public.data_check_dismissals d where d.owner_id=caller and d.entry_id=entry and d.kind=finding_kind and d.field_values=command->'values';
  end if;
 else raise exception 'Invalid check action' using errcode='22023';end if;
 return public.get_data_check_state();
end $$;
revoke all on function public.get_data_check_state(),public.get_data_check_entry(uuid),public.apply_data_check_command(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.get_data_check_state(),public.get_data_check_entry(uuid),public.apply_data_check_command(jsonb) to authenticated;

-- Snapshot format 6 includes user check settings. Deploy the compatible reader first.
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
      'version',6,'kind','game-journal-daily','ownerId',member_id,'exportedAt',stamp,
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
