begin;
insert into auth.users(id,email) values('abababab-abab-4bab-8bab-ababababab01','drive-fixture@example.invalid'),('abababab-abab-4bab-8bab-ababababab02','drive-other@example.invalid');
insert into public.members(id,display_name) values('abababab-abab-4bab-8bab-ababababab01','Drive fixture'),('abababab-abab-4bab-8bab-ababababab02','Drive other');
do $$ declare owner uuid:='abababab-abab-4bab-8bab-ababababab01';source uuid;work jsonb;again jsonb;ids jsonb:='{"json":"json_fixture","excel":"excel_fixture","manifest":"manifest_fixture"}';
begin
 source:=private.capture_daily_backup(owner);
 perform public.drive_backup_admin('oauth_begin',owner,'{"stateHash":"fixture","verifier":"verifier"}');
 if public.drive_backup_admin('oauth_consume',owner,'{"stateHash":"fixture"}')->>'verifier'<>'verifier' then raise exception 'OAuth state lost';end if;
 begin perform public.drive_backup_admin('oauth_consume',owner,'{"stateHash":"fixture"}');raise exception 'OAuth state replay accepted';exception when raise_exception then if sqlerrm='OAuth state replay accepted' then raise;end if;end;
 perform public.drive_backup_admin('connect',owner,'{"refreshToken":"fixture_not_a_real_token","folderId":"fixture_folder"}');
 work:=public.drive_backup_admin('claim');
 if work->>'ownerId'<>owner::text or work->>'sourceRunId'<>source::text or work->>'payloadText' is null then raise exception 'Incomplete claim';end if;
 if public.drive_backup_admin('claim') is not null then raise exception 'Concurrent claim accepted';end if;
 perform public.drive_backup_admin('checkpoint',null,jsonb_build_object('runId',work->>'runId','leaseToken',work->>'leaseToken','fileIds',ids,'manifest',jsonb_build_object('ownerId',owner,'snapshotId',source)));
 begin
  perform public.drive_backup_admin('checkpoint',null,jsonb_build_object('runId',work->>'runId','leaseToken',gen_random_uuid(),'fileIds',ids,'manifest',jsonb_build_object('ownerId',owner,'snapshotId',source)));
  raise exception 'Foreign lease accepted';
 exception when raise_exception then if sqlerrm='Foreign lease accepted' then raise;end if;end;
 perform public.drive_backup_admin('finish',null,jsonb_build_object('runId',work->>'runId','leaseToken',work->>'leaseToken','outcome','failed','errorCode','TEMPORARY'));
 perform public.drive_backup_admin('retry',owner);
 again:=public.drive_backup_admin('claim');
 if again->>'runId'<>work->>'runId' or again->'fileIds'<>ids then raise exception 'Retry generated duplicate run or files';end if;
 perform public.drive_backup_admin('finish',null,jsonb_build_object('runId',again->>'runId','leaseToken',again->>'leaseToken','outcome','succeeded'));
 if public.drive_backup_admin('claim') is not null then raise exception 'Successful daily copy repeated';end if;
 if (select count(*) from public.external_backup_runs where owner_id=owner)<>1 then raise exception 'Duplicate daily external backup';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','abababab-abab-4bab-8bab-ababababab01',true);
do $$ begin
 if public.drive_backup_status()->>'connected'<>'true' then raise exception 'Own connection missing';end if;
 if public.drive_backup_status()::text like '%fixture_not_a_real_token%' then raise exception 'OAuth secret exposed';end if;
 begin perform public.drive_backup_admin('claim');raise exception 'Authenticated user could claim secret';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','abababab-abab-4bab-8bab-ababababab02',true);
do $$ begin
 if public.drive_backup_status()->>'connected'<>'false' or exists(select 1 from public.external_backup_runs) then raise exception 'Another owner backup leaked';end if;
end $$;
rollback;
