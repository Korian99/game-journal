-- Disposable accounts only; all changes roll back.
begin;
insert into auth.users(id,email) values
 ('98989898-9898-4898-8898-989898989891','checks-one@example.invalid'),
 ('98989898-9898-4898-8898-989898989892','checks-two@example.invalid');
insert into public.members(id,display_name) values
 ('98989898-9898-4898-8898-989898989891','Checks one'),('98989898-9898-4898-8898-989898989892','Checks two');
insert into public.games(id,owner_id,data) values ('98989898-1111-4111-8111-111111111111','98989898-9898-4898-8898-989898989891','{"title":"Check fixture"}');
insert into public.playthroughs(id,owner_id,game_id,data) values ('98989898-2222-4222-8222-222222222222','98989898-9898-4898-8898-989898989891','98989898-1111-4111-8111-111111111111','{"status":"completed","rating":null}');
set local role authenticated;
select set_config('request.jwt.claim.sub','98989898-9898-4898-8898-989898989891',true);
do $$begin
 if (public.get_data_check_state()->'preferences'->>'review')::boolean then raise exception 'Reminders not opt-in';end if;
 perform public.apply_data_check_command('{"action":"preference","key":"review","enabled":true}');
 perform public.apply_data_check_command('{"action":"preference","key":"hours","enabled":true}');
 if public.get_data_check_state()->'preferences' <> '{"review":true,"console":false,"hours":true}' then raise exception 'Switch overwrite';end if;
 perform public.apply_data_check_command('{"action":"dismiss","entryId":"98989898-2222-4222-8222-222222222222","kind":"missing-review","values":["completed",null]}');
 if jsonb_array_length(public.get_data_check_state()->'dismissals')<>1 then raise exception 'Dismissal missing';end if;
 begin
  perform public.apply_data_check_command('{"action":"dismiss","entryId":"98989898-2222-4222-8222-222222222222","kind":"missing-review","values":["playing",null]}');
  raise exception 'Stale facts accepted';
 exception when serialization_failure then null; end;
 begin
  insert into public.data_check_dismissals(owner_id,entry_id,kind,field_values) values('98989898-9898-4898-8898-989898989891','98989898-2222-4222-8222-222222222222','missing-review','[]');
  raise exception 'Direct write bypass';
 exception when insufficient_privilege then null;end;
end $$;
do $$begin
 update public.playthroughs set data=data||'{"notes":"Unrelated"}'::jsonb where id='98989898-2222-4222-8222-222222222222';
 if jsonb_array_length(public.get_data_check_state()->'dismissals')<>1 then raise exception 'Unrelated edit revived finding';end if;
 update public.playthroughs set data=data||'{"rating":0}'::jsonb where id='98989898-2222-4222-8222-222222222222';
 update public.playthroughs set data=data||'{"rating":null}'::jsonb where id='98989898-2222-4222-8222-222222222222';
 if jsonb_array_length(public.get_data_check_state()->'dismissals')<>0 then raise exception 'Changed facts stayed dismissed';end if;
 perform public.apply_data_check_command('{"action":"dismiss","entryId":"98989898-2222-4222-8222-222222222222","kind":"missing-review","values":["completed",null]}');
end $$;
select set_config('request.jwt.claim.sub','98989898-9898-4898-8898-989898989892',true);
do $$begin
 if jsonb_array_length(public.get_data_check_state()->'dismissals')<>0 then raise exception 'Cross-owner read';end if;
 if public.get_data_check_entry('98989898-2222-4222-8222-222222222222') is not null then raise exception 'Cross-owner entry';end if;
 begin
  perform public.apply_data_check_command('{"action":"dismiss","entryId":"98989898-2222-4222-8222-222222222222","kind":"missing-review","values":["completed",null]}');
  raise exception 'Cross-owner mutation';
 exception when no_data_found then null;end;
end $$;
reset role;
do $$declare run uuid;snapshot jsonb;begin
 run:=private.capture_daily_backup('98989898-9898-4898-8898-989898989891');
 select payload into snapshot from private.backup_snapshots where run_id=run;
 if snapshot->>'version'<>'6' or jsonb_array_length(snapshot->'sourceTables'->'data_check_dismissals')<>1 then raise exception 'Check state missing in snapshot';end if;
 if has_table_privilege('anon','public.data_check_preferences','select') or has_function_privilege('anon','public.apply_data_check_command(jsonb)','execute') then raise exception 'Anonymous access';end if;
end $$;
update public.playthroughs set deleted_at=clock_timestamp() where id='98989898-2222-4222-8222-222222222222';
set local role authenticated;
select set_config('request.jwt.claim.sub','98989898-9898-4898-8898-989898989891',true);
do $$begin
 begin perform public.apply_data_check_command('{"action":"dismiss","entryId":"98989898-2222-4222-8222-222222222222","kind":"missing-review","values":["completed",null]}');raise exception 'Trash dismissal accepted';exception when no_data_found then null;end;
end $$;
reset role;
update public.members set active=false where id='98989898-9898-4898-8898-989898989891';
set local role authenticated;
do $$begin
 begin perform public.get_data_check_state();raise exception 'Inactive state access';exception when insufficient_privilege then null;end;
 begin perform public.apply_data_check_command('{"action":"preference","key":"hours","enabled":true}');raise exception 'Inactive mutation';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
