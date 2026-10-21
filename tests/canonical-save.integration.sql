begin;
insert into auth.users(id,email) values('99999999-1111-4111-8111-111111111111','save-result@example.invalid');
insert into public.members(id,display_name) values('99999999-1111-4111-8111-111111111111','Save result');
set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-1111-4111-8111-111111111111',true);
do $$declare saved jsonb;begin
 saved:=public.save_record_result('{"title":"Canonical result","status":"playing","notes":"Review","pages":[]}');
 if saved->'record'->>'title'<>'Canonical result' or saved->>'revision' is null or saved->>'id'<>saved->'record'->>'id' then raise exception 'Incomplete canonical save';end if;
 perform public.trash_record((saved->>'id')::uuid,saved->>'revision');
 begin perform public.save_record_result(saved->'record',(saved->>'id')::uuid,saved->>'revision');raise exception 'Trashed record edit accepted';
 exception when raise_exception then if sqlerrm<>'GONE' then raise;end if;end;
end $$;
rollback;
