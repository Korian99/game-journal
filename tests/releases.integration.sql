-- Run against a disposable/test database after flexible_release_dates.
begin;
insert into auth.users(id,email) values
 ('66666666-6666-4666-8666-666666666661','release-one@example.invalid'),
 ('66666666-6666-4666-8666-666666666662','release-two@example.invalid');
insert into public.members(id,display_name) values
 ('66666666-6666-4666-8666-666666666661','Release test one'),
 ('66666666-6666-4666-8666-666666666662','Release test two');
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666661',true);
do $checks$
declare saved jsonb; entry jsonb; payload jsonb; other jsonb; stale text; blocked boolean; val text;
begin
 foreach val in array array['2028-02-29','2027-summer','2027',''] loop
   saved=public.save_record(jsonb_build_object('title','Release test','year',2026,'release',val,'status','upcoming','notes','KEEP_NOTES'));
   select value into entry from jsonb_array_elements(public.list_records()) where value->>'id'=saved->>'id';
   if entry->>'release' is distinct from val then raise exception 'Release did not round trip: %',val; end if;
   if entry->>'year' is distinct from (case when val='' then null else substring(val,1,4) end) then raise exception 'Legacy year inconsistent'; end if;
   if exists(select 1 from public.playthroughs where id=(saved->>'id')::uuid and data ? 'release') then raise exception 'Release leaked into playthrough'; end if;
 end loop;
 saved=public.save_record('{"title":"Edit test","year":2027,"release":"2027-spring","status":"upcoming","notes":"KEEP_NOTES"}');
 select value into entry from jsonb_array_elements(public.list_records()) where value->>'id'=saved->>'id';
 stale=entry->>'updated_at';
 payload=entry-'release';
 perform public.save_record(payload,(saved->>'id')::uuid,entry->>'updated_at');
 select value into entry from jsonb_array_elements(public.list_records()) where value->>'id'=saved->>'id';
 if entry->>'release'<>'2027-spring' or entry->>'notes'<>'KEEP_NOTES' then raise exception 'Legacy edit erased release or notes'; end if;
 blocked=false;
 begin perform public.save_record(payload,(saved->>'id')::uuid,stale); exception when others then blocked=true; end;
 if not blocked then raise exception 'Stale edit accepted'; end if;
 perform public.save_record(entry||'{"release":"","year":2027}'::jsonb,(saved->>'id')::uuid,entry->>'updated_at');
 select value into entry from jsonb_array_elements(public.list_records()) where value->>'id'=saved->>'id';
 if entry->>'release'<>'' or entry->>'year' is not null then raise exception 'Clearing release failed'; end if;
 perform set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666662',true);
 blocked=false;
 begin perform public.save_record(entry||'{"release":"2028-winter"}'::jsonb,(saved->>'id')::uuid,entry->>'updated_at'); exception when others then blocked=true; end;
 if not blocked then raise exception 'Other owner edit accepted'; end if;
 perform set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666661',true);
 foreach val in array array['2027-02-29','2027-13-01','tomorrow','2201','1949','2027-monsoon'] loop
   blocked=false;
   begin perform public.save_record(jsonb_build_object('title','Invalid release','release',val)); exception when others then blocked=true; end;
   if not blocked then raise exception 'Invalid release accepted: %',val; end if;
 end loop;
 if has_function_privilege('anon','public.save_record(jsonb,uuid,text,jsonb)','execute') then raise exception 'Anonymous save exposed'; end if;
end $checks$;
select 'PASS: release round trips, game metadata, derived year, clearing, legacy edits, stale edits, owner isolation, invalid values, role permissions' as result;
rollback;
