create table public.member_appearance (
  member_id uuid primary key references public.members(id) on delete cascade,
  mode text not null default 'dark' check (mode in ('dark', 'light')),
  palette jsonb check (palette is null or (jsonb_typeof(palette) = 'object' and pg_column_size(palette) < 1024)),
  playthrough_id uuid,
  accent text check (accent is null or accent ~ '^#[0-9a-fA-F]{6}$'),
  check ((playthrough_id is null) = (accent is null))
);

alter table public.playthroughs add constraint playthrough_appearance_owner unique (owner_id, id);
alter table public.member_appearance add constraint member_appearance_owned_playthrough
  foreign key (member_id, playthrough_id) references public.playthroughs(owner_id, id)
  on delete set null (playthrough_id);

alter table public.member_appearance enable row level security;
revoke all on public.member_appearance from public, anon, authenticated, service_role;
grant select on public.member_appearance to authenticated;

create policy member_appearance_read on public.member_appearance for select to authenticated
  using ((select private.is_member()) and member_id = (select auth.uid()));

create function private.clear_appearance_playthrough() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.member_appearance set playthrough_id = null, accent = null
    where member_id = old.owner_id and playthrough_id = old.id;
  return old;
end $$;
revoke all on function private.clear_appearance_playthrough() from public, anon, authenticated, service_role;
create trigger clear_appearance_on_trash after update of deleted_at on public.playthroughs
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function private.clear_appearance_playthrough();
create trigger clear_appearance_on_delete before delete on public.playthroughs
  for each row execute function private.clear_appearance_playthrough();

create function public.save_member_appearance(
  patch jsonb,
  initialize_only boolean default false,
  expected_game jsonb default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner uuid := (select auth.uid());
  selected uuid := (patch #>> '{game,entryId}')::uuid;
  selected_accent text := patch #>> '{game,color}';
  saved public.member_appearance;
begin
  if not private.is_member() then raise exception 'FORBIDDEN'; end if;
  -- Serialize a pin with trash and deletion before changing the appearance row.
  if selected is not null then
    perform 1 from public.playthroughs p
      where p.id = selected and p.owner_id = owner and p.deleted_at is null for share;
    if not found then
      if not initialize_only then raise no_data_found using message = 'NOT_FOUND'; end if;
      selected := null;
      selected_accent := null;
    end if;
  end if;

  insert into public.member_appearance as current_appearance(member_id, mode, palette, playthrough_id, accent)
  select owner, coalesce(patch->>'mode', 'dark'), nullif(patch->'palette', 'null'::jsonb), selected, selected_accent
  where expected_game is null or exists (select 1 from public.member_appearance where member_id = owner)
  on conflict (member_id) do update set
    mode = case when patch ? 'mode' then excluded.mode else current_appearance.mode end,
    palette = case when patch ? 'palette' then excluded.palette else current_appearance.palette end,
    playthrough_id = case when patch ? 'game' then excluded.playthrough_id else current_appearance.playthrough_id end,
    accent = case when patch ? 'game' then excluded.accent else current_appearance.accent end
  where not initialize_only and (expected_game is null or (
    current_appearance.playthrough_id = (expected_game->>'entryId')::uuid and current_appearance.accent = expected_game->>'color'
  ))
  returning * into saved;

  if saved.member_id is null then
    select a.* into saved from public.member_appearance a where a.member_id = owner;
    if not found then return null; end if;
  end if;
  return to_jsonb(saved);
end $$;

revoke all on function public.save_member_appearance(jsonb, boolean, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_member_appearance(jsonb, boolean, jsonb) to authenticated;

-- Snapshot format 8 preserves member appearance preferences.
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
      'version',8,'kind','game-journal-daily','ownerId',member_id,'exportedAt',stamp,
      'records',coalesce((select jsonb_agg(g.data||p.data||jsonb_build_object(
        'id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),
        'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at) order by p.id)
        from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id
        where p.owner_id=member_id and p.deleted_at is null),'[]'::jsonb),
      'trash',coalesce((select jsonb_agg(g.data||p.data||jsonb_build_object('id',p.id,'gameId',g.id,'deleted_at',p.deleted_at,'updated_at',p.updated_at,'sourceKey',coalesce(p.source_key,''),'sourceSnapshot',p.source_snapshot)) from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id where p.owner_id=member_id and p.deleted_at is not null),'[]'::jsonb),
      'offers',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.offers o where o.owner_id=member_id),'[]'::jsonb),
      'priceHistory',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from public.price_history h where h.owner_id=member_id),'[]'::jsonb),
      'sourceTables',jsonb_build_object(
        'member_appearance',(select to_jsonb(a) from public.member_appearance a where a.member_id=$1),
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

