-- Synthetic accounts in an isolated disposable database only.
begin;
insert into auth.users(id,email) values
 ('91919191-9191-4191-8191-919191919191','score-one@example.invalid'),
 ('92929292-9292-4292-8292-929292929292','score-two@example.invalid');
insert into public.members(id,display_name) values
 ('91919191-9191-4191-8191-919191919191','Score one'),
 ('92929292-9292-4292-8292-929292929292','Score two');
set local role authenticated;
select set_config('request.jwt.claim.sub','91919191-9191-4191-8191-919191919191',true);
select public.replace_scoring_guide('[{"score_threshold":95,"meaning":"Personal meaning"},{"score_threshold":0,"meaning":"No"}]');
do $$ begin
 if (select count(*) from public.scoring_guide)<>2 then raise exception 'Guide not saved';end if;
 begin
  perform public.replace_scoring_guide('[{"score_threshold":50,"meaning":"a"},{"score_threshold":50,"meaning":"b"}]');
  raise exception 'Duplicate accepted';
 exception when invalid_parameter_value then null;end;
 if (select count(*) from public.scoring_guide)<>2 then raise exception 'Partial guide replacement';end if;
 begin
  insert into public.scoring_guide(owner_id,score_threshold,meaning) values('92929292-9292-4292-8292-929292929292',90,'Not mine');
  raise exception 'Cross-owner insert allowed';
 exception when insufficient_privilege then null;end;
 begin
  update public.scoring_guide set owner_id='92929292-9292-4292-8292-929292929292' where score_threshold=95;
  raise exception 'Owner reassignment allowed';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','92929292-9292-4292-8292-929292929292',true);
do $$ begin
 if exists(select 1 from public.scoring_guide) then raise exception 'Guide leaked';end if;
 update public.scoring_guide set meaning='Changed';
 delete from public.scoring_guide;
end $$;
select public.replace_scoring_guide('[{"score_threshold":80,"meaning":"Second owner"}]');
reset role;
do $$ declare run uuid; payload jsonb; begin
 if (select meaning from public.scoring_guide where owner_id='91919191-9191-4191-8191-919191919191' and score_threshold=95)<>'Personal meaning' then raise exception 'Cross-owner change';end if;
 if has_table_privilege('anon','public.scoring_guide','select') or has_function_privilege('anon','public.replace_scoring_guide(jsonb)','execute') then raise exception 'Anonymous access';end if;
 run := private.capture_daily_backup('91919191-9191-4191-8191-919191919191');
 select s.payload into payload from private.backup_snapshots s where s.run_id=run;
 if payload->>'version'<>'5' or jsonb_array_length(payload->'sourceTables'->'scoring_guide')<>2 then raise exception 'Guide missing from daily snapshot';end if;
end $$;
update public.members set active=false where id='92929292-9292-4292-8292-929292929292';
set local role authenticated;
do $$ begin
 if exists(select 1 from public.scoring_guide) then raise exception 'Inactive access';end if;
 begin perform public.replace_scoring_guide('[{"score_threshold":80,"meaning":"Inactive"}]'); raise exception 'Inactive save';exception when insufficient_privilege then null;end;
end $$;
rollback;
