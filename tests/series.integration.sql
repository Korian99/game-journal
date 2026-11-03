-- Disposable accounts only; all changes roll back.
begin;
insert into auth.users(id,email) values ('98989898-9898-4898-8898-989898989891','series-one@example.invalid'),('98989898-9898-4898-8898-989898989892','series-two@example.invalid');
insert into public.members(id,display_name) values ('98989898-9898-4898-8898-989898989891','Series one'),('98989898-9898-4898-8898-989898989892','Series two');
insert into public.games(id,owner_id,data) values
('98989898-1111-4111-8111-111111111111','98989898-9898-4898-8898-989898989891','{"title":"One"}'),
('98989898-1111-4111-8111-111111111112','98989898-9898-4898-8898-989898989891','{"title":"Two"}'),
('98989898-1111-4111-8111-111111111113','98989898-9898-4898-8898-989898989892','{"title":"Foreign"}');
insert into public.playthroughs(id,owner_id,game_id,data) values ('98989898-2222-4222-8222-222222222221','98989898-9898-4898-8898-989898989891','98989898-1111-4111-8111-111111111111','{"status":"completed"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','98989898-9898-4898-8898-989898989891',true);
do $$declare one jsonb;two jsonb;list jsonb;begin
 one:=public.save_game_series(null,'Saga',array['98989898-1111-4111-8111-111111111111'::uuid,'98989898-1111-4111-8111-111111111112'::uuid]);
 if one->>'name'<>'Saga' or jsonb_array_length(one->'game_ids')<>2 then raise exception 'Create/order readback failed';end if;
 two:=public.save_game_series(null,'Second',array['98989898-1111-4111-8111-111111111111'::uuid]);
 if jsonb_array_length(public.get_game_series())<>2 then raise exception 'A game must belong to multiple series';end if;
 begin perform public.save_game_series(null,'Bad',array['98989898-1111-4111-8111-111111111113'::uuid]);raise exception 'Foreign game accepted';exception when no_data_found then null;end;
 begin perform public.save_game_series(null,'Duplicate',array['98989898-1111-4111-8111-111111111111'::uuid,'98989898-1111-4111-8111-111111111111'::uuid]);raise exception 'Duplicate accepted';exception when invalid_parameter_value then null;end;
 perform public.save_game_series((one->>'id')::uuid,'Saga renamed',array['98989898-1111-4111-8111-111111111112'::uuid,'98989898-1111-4111-8111-111111111111'::uuid],(one->>'updated_at')::timestamptz);
 if (select value->'gameIds' from jsonb_array_elements(public.get_game_series()) value where value->>'name'='Saga renamed')<>jsonb_build_array('98989898-1111-4111-8111-111111111112','98989898-1111-4111-8111-111111111111') then raise exception 'Ordered readback wrong';end if;
 begin perform public.delete_game_series((one->>'id')::uuid,(one->>'updated_at')::timestamptz);raise exception 'Stale delete accepted';exception when serialization_failure then null;end;
 begin perform public.save_game_series((one->>'id')::uuid,'Stale',array[]::uuid[],(one->>'updated_at')::timestamptz);raise exception 'Stale update accepted';exception when serialization_failure then null;end;
 perform public.trash_record('98989898-2222-4222-8222-222222222221',null);
 if (select count(*) from public.game_series_members where game_id='98989898-1111-4111-8111-111111111111')<>2 then raise exception 'Trash removed membership';end if;
 perform public.restore_record('98989898-2222-4222-8222-222222222221',null);
 if (select count(*) from public.game_series_members where game_id='98989898-1111-4111-8111-111111111111')<>2 then raise exception 'Restore removed membership';end if;
 begin insert into public.game_series(owner_id,name) values(auth.uid(),'Bypass');raise exception 'Direct write allowed';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.save_game_series(uuid,text,uuid[],timestamp with time zone)','execute') then raise exception 'Anonymous RPC allowed';end if;
 list:=public.get_game_series();
 if jsonb_array_length(list)<>2 then raise exception 'Owner list leaked';end if;
 if not public.delete_game_series((two->>'id')::uuid,(two->>'updated_at')::timestamptz) then raise exception 'Delete failed';end if;
 if not exists(select 1 from public.games where id='98989898-1111-4111-8111-111111111111') or not exists(select 1 from public.playthroughs where id='98989898-2222-4222-8222-222222222221') then raise exception 'Deleting series removed game/play';end if;
end $$;
select set_config('request.jwt.claim.sub','98989898-9898-4898-8898-989898989892',true);
do $$begin if jsonb_array_length(public.get_game_series())<>0 then raise exception 'Cross owner list';end if;end $$;
reset role;
delete from public.games where id='98989898-1111-4111-8111-111111111112';
do $test$ begin if (select count(*) from public.game_series_members where game_id='98989898-1111-4111-8111-111111111112')<>0 then raise exception 'Game delete did not cascade membership';end if;if (select count(*) from public.game_series where owner_id='98989898-9898-4898-8898-989898989891')<>1 then raise exception 'Game delete removed series';end if;end $test$;
select set_config('request.jwt.claim.sub','98989898-9898-4898-8898-989898989891',true);
do $$declare run uuid;snap jsonb;begin run:=private.capture_daily_backup('98989898-9898-4898-8898-989898989891');select payload into snap from private.backup_snapshots where run_id=run;if snap->>'version'<>'7' or jsonb_array_length(snap->'sourceTables'->'game_series')<>1 then raise exception 'V7 series backup missing';end if;end $$;
reset role;
update public.members set active=false where id='98989898-9898-4898-8898-989898989891';
set local role authenticated;
select set_config('request.jwt.claim.sub','98989898-9898-4898-8898-989898989891',true);
do $test$ begin if jsonb_array_length(public.get_game_series())<>0 then raise exception 'Inactive read leaked data';end if;begin perform public.save_game_series(null,'Inactive',array[]::uuid[],null);raise exception 'Inactive mutation allowed';exception when insufficient_privilege then null;end;end $test$;
rollback;
