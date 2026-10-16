begin;
insert into auth.users(id,email)values('44444444-4444-4444-8444-444444444444','journal-import-fixture@example.invalid');
insert into public.members(id,display_name)values('44444444-4444-4444-8444-444444444444','Import fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $test$
declare bid uuid;record jsonb;stamp text;total int;
begin
 insert into public.imports(owner_id,source,plan)values(auth.uid(),'[]','[{"kind":"add","incoming":{"title":"Import fixture","sourceKey":"Tablas:wishlist:fixture","notes":"Original","links":["https://store.steampowered.com/app/620/?cc=US"]},"changes":{},"conflicts":[]}]')returning id into bid;
 total=public.apply_import(bid,'{}');if total<>1 then raise exception 'Import failed';end if;
 if (select count(*) from public.offers where region='US' and product='620')<>1 then raise exception 'Store link missing';end if;
 select value into record from jsonb_array_elements(public.list_records())limit 1;stamp=record->>'updated_at';
 perform public.save_record(record||'{"notes":"App edit"}',(record->>'id')::uuid,stamp);
 begin
 perform public.save_record(record,(record->>'id')::uuid,stamp);raise exception 'Stale update accepted';
 exception when raise_exception then if SQLERRM not like 'CONFLICT:%' then raise;end if;end;
 begin perform public.apply_import(bid,'{}');raise exception 'Repeated batch accepted';
 exception when raise_exception then if SQLERRM<>'Importación inválida o ya aplicada' then raise;end if;end;
end $test$;
select 'PASS: atomic import, regional offers, concurrency and repeated-batch guard' as result;
rollback;
