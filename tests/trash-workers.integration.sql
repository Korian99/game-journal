begin;
insert into auth.users(id,email) values('99999999-9999-4999-8999-999999999991','trash-worker@example.invalid');
insert into public.members(id,display_name) values('99999999-9999-4999-8999-999999999991','Worker fixture');
insert into public.games(id,owner_id,data) values('99999999-9999-4999-8999-999999999992','99999999-9999-4999-8999-999999999991','{"title":"Trash worker"}');
insert into public.playthroughs(id,owner_id,game_id,data) values('99999999-9999-4999-8999-999999999993','99999999-9999-4999-8999-999999999991','99999999-9999-4999-8999-999999999992','{"status":"upcoming","release":"2099-01-01"}');
insert into public.offers(id,owner_id,game_id,url,store,product,region) values('99999999-9999-4999-8999-999999999994','99999999-9999-4999-8999-999999999991','99999999-9999-4999-8999-999999999992','https://store.steampowered.com/app/620/','steam','620','AR');
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999991',true);
select public.trash_record('99999999-9999-4999-8999-999999999993',null);
do $$ declare run uuid; payload jsonb;
begin
 if exists(select 1 from public.claim_offers('99999999-9999-4999-8999-999999999991')) then raise exception 'Claimed a trashed game';end if;
 if jsonb_array_length(public.notification_release_candidates('99999999-9999-4999-8999-999999999991'))<>0 then raise exception 'Trashed release candidate';end if;
 if private.enqueue_release('99999999-9999-4999-8999-999999999992') is not null then raise exception 'Enqueued trashed release';end if;
 run:=private.capture_daily_backup('99999999-9999-4999-8999-999999999991');
 select s.payload into payload from private.backup_snapshots s where s.run_id=run;
 if (payload->>'version')::int<>4 or jsonb_array_length(payload->'records')<>0 or jsonb_array_length(payload->'trash')<>1
  or payload->'sourceTables'->'playthroughs'->0->>'deleted_at' is null then raise exception 'Backup did not preserve trash separately';end if;
end $$;
select public.restore_record('99999999-9999-4999-8999-999999999993',null);
do $$ begin
 if not exists(select 1 from public.claim_offers('99999999-9999-4999-8999-999999999991')) then raise exception 'Restored upcoming game not eligible';end if;
end $$;
rollback;
