-- Run against a disposable/test database after scope_price_refreshes.
-- This exercises queue selection only: it never calls Steam or Nintendo.
begin;
insert into auth.users(id,email) values
 ('55555555-5555-4555-8555-555555555551','queue-one@example.invalid'),
 ('55555555-5555-4555-8555-555555555552','queue-two@example.invalid'),
 ('55555555-5555-4555-8555-555555555553','queue-inactive@example.invalid');
insert into public.members(id,display_name,active) values
 ('55555555-5555-4555-8555-555555555551','Queue test one',true),
 ('55555555-5555-4555-8555-555555555552','Queue test two',true),
 ('55555555-5555-4555-8555-555555555553','Queue test inactive',false);
do $fixtures$
declare gid uuid; state text; owner uuid; product_id text; index int=0;
begin
 foreach state in array array['backlog','playing','completed','paused','abandoned','remembered','wishlist','upcoming','unknown',''] loop
   index=index+1; product_id=(9500000+index)::text;
   insert into public.games(owner_id,data) values('55555555-5555-4555-8555-555555555551',jsonb_build_object('title','Queue fixture '||state)) returning id into gid;
   insert into public.playthroughs(owner_id,game_id,data,source_key) values('55555555-5555-4555-8555-555555555551',gid,jsonb_build_object('status',state),'queue-fixture:'||state);
   insert into public.offers(owner_id,game_id,url,store,product,region,watched) values('55555555-5555-4555-8555-555555555551',gid,'https://store.steampowered.com/app/'||product_id||'/','steam',product_id,'AR',true);
   if state='wishlist' then
     perform set_config('test.queue_wishlist',gid::text,true);
     insert into public.playthroughs(owner_id,game_id,data,source_key) values
       ('55555555-5555-4555-8555-555555555551',gid,'{"status":"completed"}','queue-fixture:mixed'),
       ('55555555-5555-4555-8555-555555555551',gid,'{"status":"wishlist"}','queue-fixture:duplicate');
   elsif state='upcoming' then
     perform set_config('test.queue_upcoming',gid::text,true);
     update public.offers set store='nintendo',product='queue-fixture-switch',url='https://www.nintendo.com/es-ar/store/products/queue-fixture-switch/' where game_id=gid;
   end if;
 end loop;
 -- A link without any playthrough must not initiate store requests.
 insert into public.games(owner_id,data) values('55555555-5555-4555-8555-555555555551','{"title":"Orphan link"}') returning id into gid;
 insert into public.offers(owner_id,game_id,url,store,product,region) values('55555555-5555-4555-8555-555555555551',gid,'https://store.steampowered.com/app/9599999/','steam','9599999','AR');
 foreach owner in array array['55555555-5555-4555-8555-555555555552'::uuid,'55555555-5555-4555-8555-555555555553'::uuid] loop
   insert into public.games(owner_id,data) values(owner,'{"title":"Other member wishlist"}') returning id into gid;
   insert into public.playthroughs(owner_id,game_id,data) values(owner,gid,'{"status":"wishlist"}');
   insert into public.offers(owner_id,game_id,url,store,product,region) values(owner,gid,'https://store.steampowered.com/app/9599998/','steam','9599998','AR');
 end loop;
end $fixtures$;
set local role service_role;
do $checks$
declare claimed public.offers; ids uuid[]; total int; gid uuid; index int;
begin
 -- Manual refresh: exact owner, both stores, eligible statuses only, no duplicate work.
 select array_agg(id),count(*) into ids,total from public.claim_offers('55555555-5555-4555-8555-555555555551');
 if total<>2 then raise exception 'Expected two eligible offers, got %',total; end if;
 if (select count(distinct game_id) from public.offers where id=any(ids))<>2 then raise exception 'Duplicate game work'; end if;
 if exists(select 1 from public.offers where owner_id='55555555-5555-4555-8555-555555555551' and not(id=any(ids)) and lease_until is not null) then raise exception 'Excluded offers were leased'; end if;
 if exists(select 1 from public.claim_offers('55555555-5555-4555-8555-555555555551')) then raise exception 'Active leases reclaimed'; end if;
 update public.offers set lease_until=now()-interval '1 minute' where id=any(ids);
 if (select count(*) from public.claim_offers('55555555-5555-4555-8555-555555555551'))<>2 then raise exception 'Expired leases not reclaimed'; end if;
 update public.offers set lease_until=null where owner_id='55555555-5555-4555-8555-555555555551';
 if (select count(*) from public.claim_offers('55555555-5555-4555-8555-555555555552'))<>1 then raise exception 'Manual member scope changed'; end if;
 if exists(select 1 from public.claim_offers('55555555-5555-4555-8555-555555555553')) then raise exception 'Inactive member refreshed'; end if;
 -- Cron uses the same eligibility rule, across active members only.
 for claimed in select * from public.claim_offers() loop
   if not exists(select 1 from public.playthroughs p where p.game_id=claimed.game_id and p.owner_id=claimed.owner_id and p.data->>'status' in ('wishlist','upcoming')) then raise exception 'Cron claimed an excluded status'; end if;
   if claimed.owner_id='55555555-5555-4555-8555-555555555553' then raise exception 'Cron claimed inactive member'; end if;
 end loop;
 -- Preserve the manual 5-minute and scheduled 170-minute cooldowns.
 update public.offers set lease_until=null,checked_at=now()-interval '4 minutes' where owner_id='55555555-5555-4555-8555-555555555551';
 if exists(select 1 from public.claim_offers('55555555-5555-4555-8555-555555555551')) then raise exception 'Manual cooldown bypassed'; end if;
 update public.offers set checked_at=now()-interval '6 minutes' where owner_id='55555555-5555-4555-8555-555555555551';
 for claimed in select * from public.claim_offers() loop
   if claimed.owner_id='55555555-5555-4555-8555-555555555551' then raise exception 'Cron cooldown bypassed'; end if;
 end loop;
 if (select count(*) from public.claim_offers('55555555-5555-4555-8555-555555555551'))<>2 then raise exception 'Manual cooldown too restrictive'; end if;
 update public.offers set lease_until=null,checked_at=null where owner_id='55555555-5555-4555-8555-555555555551';
 -- Stop when the last eligible playthrough leaves either list; resume on return.
 update public.playthroughs set data='{"status":"completed"}' where source_key='queue-fixture:wishlist' and owner_id='55555555-5555-4555-8555-555555555551';
 if (select count(*) from public.claim_offers('55555555-5555-4555-8555-555555555551'))<>2 then raise exception 'Sibling wishlist ignored'; end if;
 update public.offers set lease_until=null where owner_id='55555555-5555-4555-8555-555555555551';
 update public.playthroughs set data='{"status":"paused"}' where source_key='queue-fixture:duplicate' and owner_id='55555555-5555-4555-8555-555555555551';
 if (select count(*) from public.claim_offers('55555555-5555-4555-8555-555555555551'))<>1 then raise exception 'Game leaving wishlist still refreshed'; end if;
 update public.offers set lease_until=null where owner_id='55555555-5555-4555-8555-555555555551';
 update public.playthroughs set data='{"status":"completed"}' where source_key='queue-fixture:upcoming' and owner_id='55555555-5555-4555-8555-555555555551';
 if exists(select 1 from public.claim_offers('55555555-5555-4555-8555-555555555551')) then raise exception 'Game leaving upcoming still refreshed'; end if;
 update public.playthroughs set data='{"status":"wishlist"}' where source_key='queue-fixture:wishlist' and owner_id='55555555-5555-4555-8555-555555555551';
 if (select count(*) from public.claim_offers('55555555-5555-4555-8555-555555555551'))<>1 then raise exception 'Returned wishlist not refreshed'; end if;
 -- Queue batches stay capped at eight eligible offers.
 update public.offers set lease_until=null where owner_id='55555555-5555-4555-8555-555555555551';
 for index in 1..9 loop
   insert into public.games(owner_id,data) values('55555555-5555-4555-8555-555555555551','{"title":"Batch fixture"}') returning id into gid;
   insert into public.playthroughs(owner_id,game_id,data) values('55555555-5555-4555-8555-555555555551',gid,'{"status":"wishlist"}');
   insert into public.offers(owner_id,game_id,url,store,product,region) values('55555555-5555-4555-8555-555555555551',gid,'https://store.steampowered.com/app/'||(9600000+index)::text||'/','steam',(9600000+index)::text,'AR');
 end loop;
 if (select count(*) from public.claim_offers('55555555-5555-4555-8555-555555555551'))<>8 then raise exception 'Batch limit changed'; end if;
 if has_function_privilege('anon','public.claim_offers(uuid)','execute') or has_function_privilege('authenticated','public.claim_offers(uuid)','execute') then raise exception 'Untrusted role can claim offers'; end if;
end $checks$;
select 'PASS: both stores, wishlist/upcoming only, manual/cron, active members, owner isolation, sibling entries, cooldowns, leases, transitions, batch limit, role restrictions' as result;
rollback;
