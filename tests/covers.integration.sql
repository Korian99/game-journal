begin;
insert into auth.users(id,email) values
 ('77777777-7777-4777-8777-777777777771','cover-owner@example.invalid'),
 ('77777777-7777-4777-8777-777777777772','cover-recipient@example.invalid');
insert into public.members(id,display_name) values
 ('77777777-7777-4777-8777-777777777771','Cover owner'),
 ('77777777-7777-4777-8777-777777777772','Cover recipient');
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);
do $checks$
declare
  saved jsonb;
  entry jsonb;
  owner_game jsonb;
  shared jsonb;
  record_id uuid;
  game_id uuid;
  revision text;
  stale_revision text;
  rejected boolean;
  cover_url text := 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg';
  override_url text := 'https://assets.nintendo.com/image/upload/manual.jpg';
begin
  saved := public.save_record_result(jsonb_build_object(
    'title','Cover fixture','status','playing','cover',
    jsonb_build_object('provider','steam','providerUrl',cover_url),'pages','[]'::jsonb
  ));
  record_id := (saved->>'id')::uuid;
  game_id := (saved->>'gameId')::uuid;
  revision := saved->>'revision';
  if saved->'record'->'cover'->>'providerUrl' is distinct from cover_url then
    raise exception 'New game cover missing from canonical record';
  end if;
  if exists(select 1 from public.playthroughs where id=record_id and data ? 'cover') then
    raise exception 'Game cover leaked into playthrough data';
  end if;

  stale_revision := revision;
  saved := public.save_record_result((saved->'record') - 'cover',record_id,revision);
  if saved->'record'->'cover'->>'providerUrl' is distinct from cover_url then
    raise exception 'Legacy edit without cover erased saved cover';
  end if;
  rejected := false;
  begin
    perform public.save_record_result(saved->'record',record_id,stale_revision);
  exception when others then
    rejected := true;
    if sqlerrm not like 'CONFLICT:%' then raise;end if;
  end;
  if not rejected then raise exception 'Stale cover revision accepted';end if;

  saved := public.save_record_result(jsonb_build_object(
    'title','Replay draft title','gameId',game_id,'status','playing',
    'cover',jsonb_build_object('provider','nintendo','providerUrl',override_url)
  ));
  select data into owner_game from public.games where id=game_id;
  if owner_game->>'title' is distinct from 'Cover fixture'
     or owner_game->'cover'->>'providerUrl' is distinct from cover_url then
    raise exception 'Replay draft overwrote shared game metadata';
  end if;
  if exists(select 1 from public.playthroughs where id=(saved->>'id')::uuid and data ? 'cover') then
    raise exception 'Replay cover leaked into playthrough data';
  end if;

  select value into entry from jsonb_array_elements(public.list_records()) where value->>'id'=record_id::text;
  saved := public.save_record_result(
    entry || jsonb_build_object('cover',jsonb_build_object('overrideUrl',override_url)),
    record_id,entry->>'updated_at'
  );
  insert into public.shared_entries(entry_id,owner_id,recipient_id)
  values(record_id,'77777777-7777-4777-8777-777777777771','77777777-7777-4777-8777-777777777772');
  perform set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777772',true);
  shared := public.read_shared()->0;
  if shared->>'coverUrl' is distinct from override_url then
    raise exception 'Shared projection did not return effective override';
  end if;
  if shared ? 'providerUrl' or shared ? 'overrideUrl' or shared ? 'provider' then
    raise exception 'Private cover source metadata leaked to shared user';
  end if;
  rejected := false;
  begin
    perform public.save_record(jsonb_build_object('title','Other owner','gameId',game_id,'status','playing'));
  exception when others then
    rejected := true;
    if sqlerrm<>'Juego no encontrado' then raise;end if;
  end;
  if not rejected then raise exception 'Other owner changed game cover';end if;

  perform set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);
  update public.games set data=data||jsonb_build_object('cover',jsonb_build_object(
    'overrideUrl','https://untrusted.example/private.jpg','providerUrl','https://untrusted.example/private.jpg'
  )) where id=game_id;
  perform set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777772',true);
  shared := public.read_shared()->0;
  if shared->'coverUrl' is distinct from 'null'::jsonb then
    raise exception 'Unsupported legacy image host leaked into shared projection';
  end if;
  perform set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);
  delete from public.shared_entries where entry_id=record_id;
  perform set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777772',true);
  if jsonb_array_length(public.read_shared())<>0 then raise exception 'Revoked cover share remained visible';end if;

  perform set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);
  rejected := false;
  begin
    perform public.save_record(jsonb_build_object('title','Invalid cover','status','playing',
      'cover',jsonb_build_object('providerUrl','https://untrusted.example/image.jpg')));
  exception when others then
    rejected := true;
    if sqlerrm<>'Portada inválida' then raise;end if;
  end;
  if not rejected then raise exception 'Unsupported cover host accepted';end if;
  select value into entry from jsonb_array_elements(public.list_records()) where value->>'id'=record_id::text;
  perform public.save_record_result(entry||jsonb_build_object('cover','{}'::jsonb),record_id,entry->>'updated_at');
  select data into owner_game from public.games where id=game_id;
  if owner_game->'cover' is distinct from '{}'::jsonb then raise exception 'Explicit empty cover did not clear game cover';end if;
end;
$checks$;
select 'PASS: shared game cover, legacy edit, replay isolation, validation, sharing projection and revocation' as result;
rollback;
