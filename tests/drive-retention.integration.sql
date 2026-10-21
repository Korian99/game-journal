begin;
insert into auth.users(id,email) values('99999999-2222-4222-8222-222222222222','retention@example.invalid');
insert into public.members(id,display_name) values('99999999-2222-4222-8222-222222222222','Retention');
do $$declare owner uuid:='99999999-2222-4222-8222-222222222222';i integer;day date;items jsonb;begin
 for i in 0..430 loop
  day:=current_date-i;
  insert into public.external_backup_runs(owner_id,source_run_id,backup_day,status,verified_at,file_ids,manifest)
   values(owner,gen_random_uuid(),day,'succeeded',day::timestamptz,'{"json":"fixture_json","excel":"fixture_excel","manifest":"fixture_manifest"}','{}');
 end loop;
 items:=public.drive_backup_admin('retention',owner);
 if jsonb_array_length(items)<380 then raise exception 'Retention failed to prune old runs';end if;
 if exists(select 1 from jsonb_array_elements(items) r where (r->>'backup_day')::date>=current_date-29) then raise exception 'Latest 30 daily bundles were pruned';end if;
 if exists(select 1 from (select distinct on(date_trunc('month',backup_day)) id from public.external_backup_runs where owner_id=owner order by date_trunc('month',backup_day) desc,backup_day,verified_at limit 12) kept join jsonb_array_elements(items) removed on removed->>'id'=kept.id::text) then raise exception 'Monthly bundle was pruned';end if;
end $$;
rollback;
