
-- Disposable fixtures only; everything, including the failure trigger, rolls back.
begin;
insert into auth.users(id,email) values
 ('77777777-7777-4777-8777-777777777771','backup-one@example.invalid'),
 ('77777777-7777-4777-8777-777777777772','backup-two@example.invalid');
insert into public.members(id,display_name) values
 ('77777777-7777-4777-8777-777777777771','Backup one'),
 ('77777777-7777-4777-8777-777777777772','Backup two');
do $fixtures$
declare gid uuid; oid uuid; run uuid; saved jsonb;
begin
 insert into public.games(owner_id,data) values
 ('77777777-7777-4777-8777-777777777771','{"title":"Snapshot fixture","platforms":"PC"}') returning id into gid;
 insert into public.playthroughs(owner_id,game_id,data,source_key,source_snapshot) values
 ('77777777-7777-4777-8777-777777777771',gid,'{"status":"remembered","hours":0,"notes":"PRIVATE_BACKUP","rating":0}','backup-test','{"original":"source"}');
 insert into public.offers(owner_id,game_id,url,store,product,region) values
 ('77777777-7777-4777-8777-777777777771',gid,'https://store.steampowered.com/app/620/','steam','620','AR') returning id into oid;
 insert into public.price_history(owner_id,offer_id,price,currency,discount) values
 ('77777777-7777-4777-8777-777777777771',oid,0,'USD',100);
 run:=private.capture_daily_backup('77777777-7777-4777-8777-777777777771');
 if private.capture_daily_backup('77777777-7777-4777-8777-777777777771')<>run then raise exception 'Duplicate daily snapshot'; end if;
 select payload into saved from private.backup_snapshots where run_id=run;
 if saved->'records'->0->>'notes'<>'PRIVATE_BACKUP' or saved->'records'->0->>'hours'<>'0'
   or jsonb_array_length(saved->'offers')<>1 or jsonb_array_length(saved->'priceHistory')<>1 then
   raise exception 'Incomplete snapshot';
 end if;
 if not exists(select 1 from public.backup_runs r where id=run and status='succeeded'
   and sha256=encode(extensions.digest(saved::text,'sha256'),'hex')
   and byte_count=octet_length(saved::text)) then raise exception 'Unverified snapshot';end if;
 delete from public.games where id=gid;
 if not exists(select 1 from private.backup_snapshots where run_id=run and payload=saved) then raise exception 'Deletion changed backup';end if;
 -- Restore exact raw rows, including UUIDs, relationship, zero scores, original import data and prices.
 insert into public.games select * from jsonb_populate_recordset(null::public.games,saved->'sourceTables'->'games');
 insert into public.playthroughs select * from jsonb_populate_recordset(null::public.playthroughs,saved->'sourceTables'->'playthroughs');
 insert into public.offers select * from jsonb_populate_recordset(null::public.offers,saved->'offers');
 insert into public.price_history select * from jsonb_populate_recordset(null::public.price_history,saved->'priceHistory');
 if not exists(select 1 from public.playthroughs where game_id=gid and data->>'notes'='PRIVATE_BACKUP'
   and source_snapshot->>'original'='source') then raise exception 'Restore lost original data';end if;
 perform private.capture_daily_backup('77777777-7777-4777-8777-777777777772');
end $fixtures$;
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777772',true);
do $isolation$
begin
 if public.read_latest_backup()::text like '%PRIVATE_BACKUP%' then raise exception 'Other owner snapshot leaked';end if;
 if jsonb_array_length(public.read_latest_backup()->'records')<>0 then raise exception 'Empty owner backup incorrect';end if;
 if (select count(*) from public.backup_runs)<>1 then raise exception 'Other owner history leaked';end if;
 if has_table_privilege('authenticated','private.backup_snapshots','select')
   or has_table_privilege('authenticated','public.backup_runs','insert')
   or has_function_privilege('authenticated','private.capture_daily_backup(uuid)','execute')
   or has_function_privilege('service_role','private.run_daily_backups()','execute')
   or has_function_privilege('anon','public.read_latest_backup()','execute') then raise exception 'Unsafe backup grants';end if;
end $isolation$;
reset role;
-- Failure injection is confined to disposable owner one.
create function private.backup_test_failure() returns trigger language plpgsql as $$
begin
 if new.owner_id='77777777-7777-4777-8777-777777777771' and current_setting('test.backup_fail',true)='yes' then
   raise exception 'Injected snapshot failure';
 end if;
 return new;
end $$;
create trigger backup_test_failure before insert on private.backup_snapshots for each row execute function private.backup_test_failure();
update public.backup_runs set backup_day=backup_day-1 where owner_id='77777777-7777-4777-8777-777777777771';
select set_config('test.backup_fail','yes',true);
select private.capture_daily_backup('77777777-7777-4777-8777-777777777771');
do $failure$
begin
 if not exists(select 1 from public.backup_runs where owner_id='77777777-7777-4777-8777-777777777771' and status='failed') then raise exception 'Failure was not recorded';end if;
 if (select count(*) from private.backup_snapshots where owner_id='77777777-7777-4777-8777-777777777771')<>1 then raise exception 'Failure damaged previous snapshot';end if;
end $failure$;
select set_config('test.backup_fail','no',true);
do $retention$
declare i integer; rid uuid; saved jsonb; stamp timestamptz;
begin
 select payload into saved from private.backup_snapshots where owner_id='77777777-7777-4777-8777-777777777771' limit 1;
 for i in 1..31 loop
  stamp:=now()-make_interval(days=>i);
  insert into public.backup_runs(owner_id,backup_day,status,started_at,completed_at,sha256)
    values('77777777-7777-4777-8777-777777777771',stamp::date,'succeeded',stamp,stamp,encode(extensions.digest(saved::text,'sha256'),'hex')) returning id into rid;
  insert into private.backup_snapshots values(rid,'77777777-7777-4777-8777-777777777771',saved);
 end loop;
 perform private.capture_daily_backup('77777777-7777-4777-8777-777777777771');
 if (select count(*) from private.backup_snapshots where owner_id='77777777-7777-4777-8777-777777777771')<>30 then raise exception 'Retention should keep 30 snapshots';end if;
 if not exists(select 1 from public.backup_runs r join private.backup_snapshots s on s.run_id=r.id where r.owner_id='77777777-7777-4777-8777-777777777771' and r.backup_day=(now() at time zone 'America/Argentina/Buenos_Aires')::date) then raise exception 'Newest backup pruned';end if;
end $retention$;
-- Corrupt only a disposable snapshot, verify download refuses it.
update private.backup_snapshots set payload=payload||'{"tampered":true}' where run_id=(
 select id from public.backup_runs where owner_id='77777777-7777-4777-8777-777777777772' order by completed_at desc limit 1);
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777772',true);
do $checksum$
begin
 begin
  perform public.read_latest_backup();
  raise exception 'Corrupt snapshot was downloadable';
 exception when others then
  if sqlerrm<>'Backup checksum mismatch' then raise;end if;
 end;
end $checksum$;
reset role;
select 'PASS: atomic snapshots, raw restore, deduplication, owner isolation, failure preservation, retention and checksum' as result;
rollback;
