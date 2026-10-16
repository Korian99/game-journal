begin;
insert into auth.users(id,email)values('55555555-5555-4555-8555-555555555555','journal-replay-fixture@example.invalid');
insert into public.members(id,display_name)values('55555555-5555-4555-8555-555555555555','Replay fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $test$
declare first jsonb;second jsonb;stale jsonb;
begin
 first=public.save_record('{"title":"Original","status":"playing"}');
 second=public.save_record(jsonb_build_object('title','Original','gameId',first->'gameId','status','playing'));
 select value into stale from jsonb_array_elements(public.list_records()) where value->>'id'=second->>'id';
 select value into first from jsonb_array_elements(public.list_records()) where value->>'id'=first->>'id';
 perform public.save_record(first||'{"title":"Changed metadata"}',(first->>'id')::uuid,first->>'updated_at');
 begin
 perform public.save_record(stale,(stale->>'id')::uuid,stale->>'updated_at');
 raise exception 'Sibling stale metadata accepted';
 exception when raise_exception then if SQLERRM not like 'CONFLICT:%' then raise;end if;end;
end $test$;
select 'PASS: sibling playthrough metadata concurrency' as result;
rollback;
