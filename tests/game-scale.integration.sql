begin;
insert into auth.users(id,email) values
 ('78787878-7878-4878-8878-787878787871','scale-owner@example.invalid'),
 ('78787878-7878-4878-8878-787878787872','scale-other@example.invalid');
insert into public.members(id,display_name) values
 ('78787878-7878-4878-8878-787878787871','Scale owner'),
 ('78787878-7878-4878-8878-787878787872','Scale other');
set local role authenticated;
select set_config('request.jwt.claim.sub','78787878-7878-4878-8878-787878787871',true);
do $checks$
declare saved jsonb; entry jsonb; game_id uuid; record_id uuid; replay_id uuid; revision text; rejected boolean;
begin
  saved := public.save_record_result(jsonb_build_object('title','Scale fixture','status','playing','scale','aa'));
  game_id := (saved->>'gameId')::uuid; record_id := (saved->>'id')::uuid; revision := saved->>'revision';
  if saved->'record'->>'scale' is distinct from 'aa' then raise exception 'Canonical save did not return game scale'; end if;
  if exists(select 1 from public.playthroughs where id=record_id and data ? 'scale') then raise exception 'Game scale leaked into playthrough data'; end if;
  saved := public.save_record_result(saved->'record' - 'scale',record_id,revision);
  if saved->'record'->>'scale' is distinct from 'aa' then raise exception 'Legacy edit without scale erased shared scale'; end if;
  revision := saved->>'revision';
  saved := public.save_record_result(saved->'record'||jsonb_build_object('scale',null),record_id,revision);
  if saved->'record'->'scale' is distinct from 'null'::jsonb then raise exception 'Explicit scale clear was not canonical null'; end if;
  select data into entry from public.games where id=game_id;
  if entry->'scale' is distinct from 'null'::jsonb then raise exception 'Cleared scale was not preserved as explicit null'; end if;
  saved := public.save_record_result(jsonb_build_object('title','Replay draft','gameId',game_id,'status','playing','scale','aaa'));
  replay_id := (saved->>'id')::uuid;
  if saved->'record'->'scale' is distinct from 'null'::jsonb then raise exception 'Replay overwrote canonical game scale'; end if;
  if exists(select 1 from public.playthroughs where id=replay_id and data ? 'scale') then raise exception 'Replay scale leaked into playthrough data'; end if;
  rejected := false;
  begin perform public.save_record(jsonb_build_object('title','Invalid scale','status','playing','scale','long'));
  exception when others then rejected := true; if sqlerrm<>'Escala inválida' then raise; end if; end;
  if not rejected then raise exception 'Unsupported scale accepted'; end if;
  rejected := false;
  perform set_config('request.jwt.claim.sub','78787878-7878-4878-8878-787878787872',true);
  begin perform public.save_record_result(jsonb_build_object('title','Other owner','gameId',game_id,'status','playing','scale','aaa'));
  exception when others then rejected := true; if sqlerrm<>'Juego no encontrado' then raise; end if; end;
  if not rejected then raise exception 'Other owner changed game scale'; end if;
end;
$checks$;
select 'PASS: scale validation, canonical game metadata, legacy preservation, clear, replay isolation and owner boundary' as result;
rollback;
