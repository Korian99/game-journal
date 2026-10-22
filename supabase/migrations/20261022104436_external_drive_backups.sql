-- External Drive backup metadata. Credentials and leases never enter app snapshots.
create table public.external_backup_runs(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 source_run_id uuid not null,backup_day date not null,status text not null default 'pending' check(status in('pending','running','failed','succeeded','expired')),
 created_at timestamptz not null default now(),completed_at timestamptz,verified_at timestamptz,pruned_at timestamptz,
 file_ids jsonb not null default '{}',manifest jsonb,error_code text,unique(owner_id,source_run_id));
alter table public.external_backup_runs enable row level security;
revoke all on public.external_backup_runs from public,anon,authenticated;
grant select on public.external_backup_runs to authenticated;
grant all on public.external_backup_runs to service_role;
create policy external_backup_owner on public.external_backup_runs for select to authenticated using(private.is_member() and owner_id=(select auth.uid()));
create index external_backup_owner_date on public.external_backup_runs(owner_id,backup_day desc);

create table private.drive_backup_connections(
 owner_id uuid primary key references auth.users(id) on delete cascade,secret_id uuid not null references vault.secrets(id),
 folder_id text not null,state text not null default 'connected',connected_at timestamptz not null default now(),error_code text,recovery_verified_at timestamptz,recovery_run_id uuid);
create table private.drive_backup_oauth(
 state_hash text primary key,owner_id uuid not null references auth.users(id) on delete cascade,verifier text not null,expires_at timestamptz not null default now()+interval '10 minutes');
create table private.drive_backup_jobs(
 run_id uuid primary key references public.external_backup_runs(id) on delete cascade,lease_token uuid,lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),attempts integer not null default 0);
alter table private.drive_backup_connections enable row level security;
alter table private.drive_backup_oauth enable row level security;
alter table private.drive_backup_jobs enable row level security;
revoke all on private.drive_backup_connections,private.drive_backup_oauth,private.drive_backup_jobs from public,anon,authenticated,service_role;

create function private.read_drive_backup_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare connection private.drive_backup_connections;latest jsonb;successful jsonb;
begin
 if not private.is_member() then raise exception 'UNAUTHORIZED';end if;
 select * into connection from private.drive_backup_connections where owner_id=(select auth.uid());
 select to_jsonb(r) into latest from public.external_backup_runs r where owner_id=(select auth.uid()) order by created_at desc limit 1;
 select to_jsonb(r) into successful from public.external_backup_runs r where owner_id=(select auth.uid()) and status='succeeded' and pruned_at is null order by verified_at desc limit 1;
 return jsonb_build_object('connected',connection.owner_id is not null,'state',coalesce(connection.state,'disconnected'),
 'folderId',connection.folder_id,'errorCode',connection.error_code,'recoveryVerifiedAt',connection.recovery_verified_at,
 'latest',latest,'lastSuccess',successful,'checkedAt',clock_timestamp());
end $$;
revoke all on function private.read_drive_backup_status() from public,anon,authenticated,service_role;
grant execute on function private.read_drive_backup_status() to authenticated;
create function public.drive_backup_status() returns jsonb language sql stable security invoker set search_path='' as $$select private.read_drive_backup_status();$$;
revoke all on function public.drive_backup_status() from public,anon,authenticated,service_role;
grant execute on function public.drive_backup_status() to authenticated;

-- This service-only bridge is used exclusively by authenticated server routes and the cron worker.
create function private.drive_backup_admin(action text,member_id uuid default null,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare connection private.drive_backup_connections;work record;source record;sid uuid;rid uuid;token uuid;verifier text;ids jsonb;
begin
 if action in('oauth_begin','oauth_consume','connect','disconnect','credentials','retry','record_recovery','retention') and
 not exists(select 1 from public.members where id=member_id and active) then raise exception 'FORBIDDEN';end if;
 if action='oauth_begin' then
  delete from private.drive_backup_oauth where expires_at<now();
  insert into private.drive_backup_oauth(state_hash,owner_id,verifier) values(payload->>'stateHash',member_id,payload->>'verifier');
  return '{"ok":true}';
 elsif action='oauth_consume' then
  delete from private.drive_backup_oauth where state_hash=payload->>'stateHash' and owner_id=member_id and expires_at>now() returning drive_backup_oauth.verifier into verifier;
  if verifier is null then raise exception 'OAuth vencido o ya utilizado';end if;
  return jsonb_build_object('verifier',verifier);
 elsif action='connect' then
  if coalesce(length(payload->>'refreshToken'),0)<10 or coalesce(payload->>'folderId','')!~'^[a-zA-Z0-9_-]{1,200}$' then raise exception 'Conexión inválida';end if;
  select secret_id into sid from private.drive_backup_connections where owner_id=member_id for update;
  if sid is null then select vault.create_secret(payload->>'refreshToken','game_journal_drive_'||member_id::text) into sid;
  else perform vault.update_secret(sid,payload->>'refreshToken');end if;
  insert into private.drive_backup_connections(owner_id,secret_id,folder_id) values(member_id,sid,payload->>'folderId')
  on conflict(owner_id) do update set secret_id=excluded.secret_id,folder_id=excluded.folder_id,state='connected',connected_at=now(),error_code=null,recovery_verified_at=null,recovery_run_id=null;
  return '{"ok":true}';
 elsif action='credentials' then
  select * into connection from private.drive_backup_connections where owner_id=member_id;
  return jsonb_build_object('folderId',connection.folder_id,'refreshToken',(select decrypted_secret from vault.decrypted_secrets where id=connection.secret_id));
 elsif action='disconnect' then
  delete from private.drive_backup_connections where owner_id=member_id returning secret_id into sid;
  delete from private.drive_backup_oauth where owner_id=member_id;
  delete from private.drive_backup_jobs where run_id in(select id from public.external_backup_runs where owner_id=member_id and status<>'succeeded');
  if sid is not null then delete from vault.secrets where id=sid;end if;
  return '{"ok":true}';
 elsif action='retry' then
  update private.drive_backup_jobs set next_attempt_at=now() where run_id in(select id from public.external_backup_runs where owner_id=member_id and status='failed');
  return '{"ok":true}';
 elsif action='claim' then
  select c.* into connection from private.drive_backup_connections c join public.members m on m.id=c.owner_id and m.active
  where c.state='connected' and (member_id is null or c.owner_id=member_id) and (
   exists(select 1 from public.external_backup_runs r join private.drive_backup_jobs j on j.run_id=r.id where r.owner_id=c.owner_id and r.status in('pending','running','failed') and j.next_attempt_at<=now() and (j.lease_until is null or j.lease_until<now()))
   or exists(select 1 from public.backup_runs b join private.backup_snapshots s on s.run_id=b.id where b.owner_id=c.owner_id and b.status='succeeded' and b.id=(select x.id from public.backup_runs x join private.backup_snapshots y on y.run_id=x.id where x.owner_id=c.owner_id and x.status='succeeded' order by x.completed_at desc limit 1) and not exists(select 1 from public.external_backup_runs e where e.owner_id=c.owner_id and e.source_run_id=b.id))
  ) order by c.owner_id for update of c skip locked limit 1;
  if connection.owner_id is null then return null;end if;
  select r.id into rid from public.external_backup_runs r join private.drive_backup_jobs j on j.run_id=r.id
   where r.owner_id=connection.owner_id and r.status in('pending','running','failed') and j.next_attempt_at<=now() and(j.lease_until is null or j.lease_until<now())
   order by r.created_at for update of r,j skip locked limit 1;
  if rid is null then
   select b.id,b.backup_day into source from public.backup_runs b join private.backup_snapshots s on s.run_id=b.id where b.owner_id=connection.owner_id and b.status='succeeded' order by b.completed_at desc limit 1;
   if source.id is null then return null;end if;
   insert into public.external_backup_runs(owner_id,source_run_id,backup_day) values(connection.owner_id,source.id,source.backup_day) on conflict(owner_id,source_run_id) do nothing returning id into rid;
   if rid is null then return null;end if;
   insert into private.drive_backup_jobs(run_id) values(rid);
  end if;
  select r.*,s.payload::text as payload_text,b.sha256 from public.external_backup_runs r
   left join private.backup_snapshots s on s.run_id=r.source_run_id and s.owner_id=r.owner_id
   left join public.backup_runs b on b.id=r.source_run_id and b.owner_id=r.owner_id where r.id=rid into work;
  if work.payload_text is null then update public.external_backup_runs set status='expired',error_code='SNAPSHOT_EXPIRED' where id=rid;return null;end if;
  if encode(extensions.digest(work.payload_text,'sha256'),'hex')<>work.sha256 then raise exception 'Backup checksum mismatch';end if;
  token=gen_random_uuid();
  update private.drive_backup_jobs set lease_token=token,lease_until=now()+interval '3 minutes',attempts=attempts+1 where run_id=rid;
  update public.external_backup_runs set status='running',error_code=null where id=rid;
  return jsonb_build_object('runId',rid,'ownerId',work.owner_id,'sourceRunId',work.source_run_id,'sourceSha256',work.sha256,
   'payloadText',work.payload_text,'leaseToken',token,'folderId',connection.folder_id,
   'refreshToken',(select decrypted_secret from vault.decrypted_secrets where id=connection.secret_id),
   'fileIds',work.file_ids,'manifest',work.manifest);
 elsif action in('checkpoint','finish','pruned') then
  rid=(payload->>'runId')::uuid;
  select r.*,j.lease_token,j.lease_until into work from public.external_backup_runs r join private.drive_backup_jobs j on j.run_id=r.id where r.id=rid for update of r,j;
  if work.id is null then raise exception 'NOT_FOUND';end if;
  if action<>'pruned' and (work.lease_token is null or work.lease_until is null or work.lease_token is distinct from (payload->>'leaseToken')::uuid or work.lease_until<now()) then raise exception 'CONFLICT: venció la reserva del respaldo';end if;
  if action='checkpoint' then
   ids=payload->'fileIds';
   if not(ids ?& array['json','excel','manifest']) or (select count(*) from jsonb_object_keys(ids))<>3 or
    exists(select 1 from jsonb_each_text(ids) where value!~'^[a-zA-Z0-9_-]{1,200}$') then raise exception 'Identificadores de Drive inválidos';end if;
   if work.file_ids<>'{}'::jsonb and work.file_ids<>ids then raise exception 'CONFLICT: los archivos ya tienen identificadores';end if;
   if work.manifest is not null and work.manifest<>payload->'manifest' then raise exception 'Backup artifact checksum changed';end if;
   if payload->'manifest'->>'ownerId'<>work.owner_id::text or payload->'manifest'->>'snapshotId'<>work.source_run_id::text then raise exception 'Manifiesto incorrecto';end if;
   update public.external_backup_runs set file_ids=ids,manifest=payload->'manifest' where id=rid;
  elsif action='finish' then
   if payload->>'outcome'='succeeded' then
    if work.manifest is null or work.file_ids='{}'::jsonb then raise exception 'Faltan archivos verificados';end if;
    update public.external_backup_runs set status='succeeded',verified_at=clock_timestamp(),completed_at=clock_timestamp(),error_code=null where id=rid;
    update private.drive_backup_connections set error_code=null where owner_id=work.owner_id;
   else
    if coalesce(payload->>'errorCode','TEMPORARY')!~'^[A-Z_]{1,60}$' then raise exception 'Código inválido';end if;
    update public.external_backup_runs set status='failed',error_code=coalesce(payload->>'errorCode','TEMPORARY') where id=rid;
    update private.drive_backup_connections set error_code=coalesce(payload->>'errorCode','TEMPORARY'),state=case when payload->>'errorCode'='AUTH_REVOKED' then 'needs_reconnect' else state end where owner_id=work.owner_id;
   end if;
   update private.drive_backup_jobs set lease_token=null,lease_until=null,next_attempt_at=now()+interval '1 hour' where run_id=rid;
  else
   if work.owner_id is distinct from member_id or work.status<>'succeeded' then raise exception 'FORBIDDEN';end if;
   update public.external_backup_runs set pruned_at=now() where id=rid;
  end if;
  return '{"ok":true}';
 elsif action='retention' then
  return (with daily as(select id,row_number() over(order by backup_day desc,verified_at desc) as number from public.external_backup_runs where owner_id=member_id and status='succeeded' and pruned_at is null),
  monthly as(select distinct on(date_trunc('month',backup_day)) id from public.external_backup_runs where owner_id=member_id and status='succeeded' and pruned_at is null order by date_trunc('month',backup_day) desc,backup_day,verified_at limit 12)
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.external_backup_runs r join daily d on d.id=r.id where d.number>30 and not exists(select 1 from monthly m where m.id=r.id));
 elsif action='record_recovery' then
  if not exists(select 1 from public.external_backup_runs where id=(payload->>'runId')::uuid and owner_id=member_id and status='succeeded' and pruned_at is null) or payload->>'targetProject' is null then raise exception 'Verificación inválida';end if;
  update private.drive_backup_connections set recovery_verified_at=clock_timestamp(),recovery_run_id=(payload->>'runId')::uuid where owner_id=member_id;
  return '{"ok":true}';
 end if;
 raise exception 'Operación inválida';
end $$;
revoke all on function private.drive_backup_admin(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.drive_backup_admin(text,uuid,jsonb) to service_role;
create function public.drive_backup_admin(action text,member_id uuid default null,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select private.drive_backup_admin(action,member_id,payload);$$;
revoke all on function public.drive_backup_admin(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.drive_backup_admin(text,uuid,jsonb) to service_role;

-- Add the public application origin and a dedicated worker secret to Vault during deployment setup.
-- This schedule does no work until a connection and an app origin exist.
select cron.schedule('game-journal-drive-backups','15 * * * *',$job$
 select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='game_journal_app_origin')||'/api/internal/backup-drive',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='game_journal_backup_worker')),
 body:=jsonb_build_object('ownerId',c.owner_id),timeout_milliseconds:=60000)
 from private.drive_backup_connections c join public.members m on m.id=c.owner_id and m.active
 where c.state='connected' and exists(select 1 from vault.decrypted_secrets where name='game_journal_app_origin')
 and exists(select 1 from vault.decrypted_secrets where name='game_journal_backup_worker');
$job$);
