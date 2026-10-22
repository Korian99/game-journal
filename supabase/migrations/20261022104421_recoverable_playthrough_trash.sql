-- Recoverable deletion. No existing entries are removed by this migration.
alter table public.playthroughs add column deleted_at timestamptz;
create index playthrough_trash on public.playthroughs(owner_id,deleted_at) where deleted_at is not null;
create index playthrough_active_game on public.playthroughs(owner_id,game_id) where deleted_at is null;
revoke delete,update on public.playthroughs from authenticated;
-- Deleting game metadata would cascade around playthrough trash.
revoke delete on public.games from authenticated;
grant update(data,source_snapshot,updated_at) on public.playthroughs to authenticated;
create function private.guard_trashed_entry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.deleted_at is not null and new.deleted_at is not null and
 (new.data is distinct from old.data or new.game_id is distinct from old.game_id) then raise exception 'GONE';end if;
 if old.deleted_at is not null and new.deleted_at is null and old.deleted_at<=clock_timestamp()-interval '30 days' then raise exception 'GONE';end if;
 if old.deleted_at is distinct from new.deleted_at then
 new.updated_at:=clock_timestamp();
 if new.deleted_at is not null then delete from public.shared_entries where entry_id=old.id;end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_trashed_entry() from public,anon,authenticated,service_role;
create trigger guard_trashed_entry before update on public.playthroughs for each row execute function private.guard_trashed_entry();
create function private.trash_command(record_id uuid,command text,expected text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry public.playthroughs;
begin
 if not private.is_member() then raise exception 'UNAUTHORIZED';end if;
 select p.* into entry from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id
 where p.id=record_id and p.owner_id=(select auth.uid()) for update of g,p;
 if entry.id is null then raise exception 'NOT_FOUND';end if;
 if expected is not null and entry.updated_at<>expected::timestamptz then raise exception 'CONFLICT: la entrada cambió';end if;
 if command='trash' then
 if entry.deleted_at is null then update public.playthroughs set deleted_at=clock_timestamp() where id=entry.id;end if;
 elsif command='restore' then
 if entry.deleted_at is null then return jsonb_build_object('ok',true,'id',entry.id);end if;
 if entry.deleted_at<=clock_timestamp()-interval '30 days' then raise exception 'GONE';end if;
 update public.playthroughs set deleted_at=null where id=entry.id;
 elsif command='purge' then
 if entry.deleted_at is null then raise exception 'Solo se pueden eliminar definitivamente entradas en papelera';end if;
 delete from public.playthroughs where id=entry.id;
 else raise exception 'Operación inválida';end if;
 return jsonb_build_object('ok',true,'id',entry.id);
end $$;
revoke all on function private.trash_command(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.trash_command(uuid,text,text) to authenticated;
create function public.trash_record(record_id uuid,expected text default null) returns jsonb
language sql security invoker set search_path='' as $$select private.trash_command(record_id,'trash',expected);$$;
create function public.restore_record(record_id uuid,expected text default null) returns jsonb
language sql security invoker set search_path='' as $$select private.trash_command(record_id,'restore',expected);$$;
create function public.purge_record(record_id uuid,expected text default null) returns jsonb
language sql security invoker set search_path='' as $$select private.trash_command(record_id,'purge',expected);$$;
revoke all on function public.trash_record(uuid,text),public.restore_record(uuid,text),public.purge_record(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.trash_record(uuid,text),public.restore_record(uuid,text),public.purge_record(uuid,text) to authenticated;
create function private.purge_expired_trash() returns integer
language plpgsql security definer set search_path='' as $$
declare total integer;
begin delete from public.playthroughs where deleted_at<=clock_timestamp()-interval '30 days';get diagnostics total=row_count;return total;end $$;
revoke all on function private.purge_expired_trash() from public,anon,authenticated,service_role;
select cron.schedule('game-journal-trash-purge','5 6 * * *','select private.purge_expired_trash();');
alter policy shared_insert on public.shared_entries with check(private.is_member() and owner_id=(select auth.uid()) and recipient_id<>owner_id and exists(select 1 from public.playthroughs p where p.id=entry_id and p.owner_id=(select auth.uid()) and p.deleted_at is null));

create or replace function public.list_records() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(g.data||p.data||jsonb_build_object('id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at) order by g.data->>'title'),'[]'::jsonb)
 from public.playthroughs p join public.games g on g.id=p.game_id where p.deleted_at is null;
$$;

create or replace function public.list_records_with_trash() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(g.data||p.data||jsonb_build_object('id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at,'deleted_at',p.deleted_at) order by g.data->>'title'),'[]'::jsonb)
 from public.playthroughs p join public.games g on g.id=p.game_id;
$$;

create or replace function public.list_trash() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(g.data||p.data||jsonb_build_object('id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at,'deleted_at',p.deleted_at) order by g.data->>'title'),'[]'::jsonb)
 from public.playthroughs p join public.games g on g.id=p.game_id where p.deleted_at is not null;
$$;
revoke all on function public.list_records_with_trash(),public.list_trash() from public,anon,authenticated,service_role;
grant execute on function public.list_records_with_trash(),public.list_trash() to authenticated;

create or replace function public.save_record(input jsonb,record_id uuid default null,expected text default null,snapshot jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
 declare gid uuid;pid uuid;current_stamp timestamptz;removed timestamptz;meta jsonb;journal jsonb;release_value text;existing_release jsonb;begin
 if not private.is_member() then raise exception 'No autorizado';end if;
 if coalesce(length(trim(input->>'title')),0)=0 or length(input->>'title')>300 then raise exception 'Título inválido';end if;
 meta=jsonb_build_object('title',input->'title','year',input->'year','platforms',input->'platforms','ownership',input->'ownership','priority',input->'priority','hype',input->'hype','estimated',input->'estimated');
 if input ? 'release' then
   if jsonb_typeof(input->'release') is distinct from 'string' then raise exception 'Lanzamiento inválido'; end if;
   release_value=trim(input->>'release');
   if release_value<>'' then
     if release_value !~ '^[0-9]{4}(-[0-9]{2}-[0-9]{2}|-(spring|summer|autumn|winter))?$'
       or substring(release_value,1,4)::int not between 1950 and 2200 then raise exception 'Lanzamiento inválido'; end if;
     if release_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then perform release_value::date; end if;
     meta=meta||jsonb_build_object('year',substring(release_value,1,4)::int);
   else meta=meta||jsonb_build_object('year',null); end if;
   meta=meta||jsonb_build_object('release',release_value);
 end if;
 journal=input-array['id','gameId','title','year','release','platforms','ownership','priority','hype','estimated','sourceKey','sourceSnapshot','updated_at','offers','links','raw'];
 if record_id is not null then
 select p.game_id,p.updated_at,p.deleted_at,g.data->'release' into gid,current_stamp,removed,existing_release from public.playthroughs p join public.games g on g.id=p.game_id where p.id=record_id and p.owner_id=(select auth.uid()) for update of g;
 if gid is null then raise exception 'NOT_FOUND';end if;
 if removed is not null then raise exception 'GONE';end if;
 if expected is null or current_stamp<>expected::timestamptz then raise exception 'CONFLICT: la entrada cambió en otro dispositivo';end if;
 -- Older clients omit release: preserve the richer value on an ordinary edit.
 if not (input ? 'release') and existing_release is not null then
   meta=meta||jsonb_build_object('release',existing_release);
 end if;
 update public.games set data=meta where id=gid and data is distinct from meta;
 update public.playthroughs set data=journal,source_snapshot=coalesce(snapshot,source_snapshot),updated_at=clock_timestamp() where id=record_id returning id into pid;
 else
 if input->>'gameId' is not null then select id into gid from public.games where id=(input->>'gameId')::uuid and owner_id=(select auth.uid());if gid is null then raise exception 'Juego no encontrado';end if;
 else insert into public.games(owner_id,data)values((select auth.uid()),meta)returning id into gid;end if;
 insert into public.playthroughs(game_id,owner_id,data,source_key,source_snapshot)values(gid,(select auth.uid()),journal,nullif(input->>'sourceKey',''),coalesce(snapshot,'{}')) returning id into pid;
 end if;
 return jsonb_build_object('id',pid,'gameId',gid);end $$;

create or replace function private.read_shared() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('shareId',s.id,'owner',m.display_name,'title',g.data->'title','period',p.data->'period','device',p.data->'device','status',p.data->'status','hours',p.data->'hours','rating',p.data->'rating','memorability',p.data->'memorability','impression',p.data->'impression','focus',p.data->'focus','replay',p.data->'replay')),'[]')
 from public.shared_entries s join public.playthroughs p on p.id=s.entry_id and p.owner_id=s.owner_id join public.games g on g.id=p.game_id join public.members m on m.id=s.owner_id and m.active
 where p.deleted_at is null and s.recipient_id=(select auth.uid()) and private.is_member();
$$;

create or replace function public.apply_import(batch_id uuid,resolutions jsonb default '{}') returns int language plpgsql security invoker set search_path='' as $$
 declare b public.imports;item jsonb;combined jsonb;current_data jsonb;f text;choice text;total int=0;saved jsonb;link text;match text[];offer_region text;offer_store text;product_id text;begin
 select * into b from public.imports where id=batch_id and owner_id=(select auth.uid()) for update;
 if b.id is null or b.applied_at is not null then raise exception 'Importación inválida o ya aplicada';end if;
 for item in select * from jsonb_array_elements(b.plan) loop
 if item->'conflicts' ? 'trash' then
 if resolutions->(item->'incoming'->>'sourceKey')->>'trash'='skip' then continue;end if;
 raise exception 'Restaurá la entrada desde Papelera antes de importar';end if;
if item->>'id' is not null and exists(select 1 from public.playthroughs where id=(item->>'id')::uuid and deleted_at is not null) then raise exception 'GONE';end if;
if item->>'kind'='unchanged' then continue;end if;
 if item->>'id' is not null then
 select g.data||p.data||jsonb_build_object('sourceKey',p.source_key) into current_data from public.playthroughs p join public.games g on g.id=p.game_id where p.id=(item->>'id')::uuid;
 combined=current_data||coalesce(item->'changes','{}');
 else combined=item->'incoming';end if;
 for f in select jsonb_array_elements_text(item->'conflicts') loop
 choice=resolutions->(item->'incoming'->>'sourceKey')->>f;
 if choice is null then raise exception 'Resuelve todos los conflictos';end if;
 if f='duplicate' then if choice='skip' then combined=null;else raise exception 'Duplicado requiere revisar título/edición';end if;
 elsif choice='sheet' then combined=jsonb_set(combined,array[f],item->'incoming'->f);
 elsif choice<>'app' then raise exception 'Resolución inválida';end if;
 end loop;
 if combined is not null then
 saved=public.save_record(combined,(item->>'id')::uuid,item->>'expectedUpdatedAt',item->'incoming');
 for link in select jsonb_array_elements_text(coalesce(item->'incoming'->'links','[]')) loop
 match=regexp_match(link,'^https://store\.steampowered\.com/app/([0-9]+)/(?:\?cc=([A-Z]{2}))?$');
 if match is not null then offer_store='steam';product_id=match[1];offer_region=coalesce(match[2],'AR');
 else
 match=regexp_match(link,'^https://www\.nintendo\.com/(us|en-us|es-ar|en-ca|en-gb|es-es|es-mx|pt-br)/store/products/([a-zA-Z0-9-]+)/$');
 if match is null then continue;end if;
 offer_store='nintendo';product_id=match[2];offer_region=case match[1] when 'us' then 'US' when 'en-us' then 'US' when 'es-ar' then 'AR' when 'en-ca' then 'CA' when 'en-gb' then 'GB' when 'es-es' then 'ES' when 'es-mx' then 'MX' when 'pt-br' then 'BR' end;
 end if;
 insert into public.offers(owner_id,game_id,url,store,product,region)
 values((select auth.uid()),(saved->>'gameId')::uuid,link,offer_store,product_id,offer_region)
 on conflict(owner_id,game_id,store,product,region)do nothing;
 end loop;
 total=total+1;end if;
 end loop;
 update public.imports set applied_at=now() where id=batch_id;
 return total;end $$;

create or replace function public.claim_offers(member_id uuid default null)
returns setof public.offers
language sql security definer set search_path = '' as $$
  update public.offers o
  set lease_until = now() + interval '3 minutes'
  where o.id in (
    select x.id
    from public.offers x
    join public.members m on m.id = x.owner_id and m.active
    where (member_id is null or x.owner_id = member_id)
      and exists (
        select 1 from public.playthroughs p
        where p.game_id = x.game_id and p.owner_id = x.owner_id
          and p.deleted_at is null and p.data->>'status' in ('wishlist', 'upcoming')
      )
      and (x.lease_until is null or x.lease_until < now())
      and (x.checked_at is null or x.checked_at < now() -
        case when member_id is null then interval '170 minutes' else interval '5 minutes' end)
    order by x.checked_at nulls first
    for update of x skip locked limit 8
  )
  returning o.*;
$$;

create or replace function private.enqueue_release(released_game uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare nid uuid;
begin
 insert into public.notifications(owner_id,game_id,kind,event_key,title,body,url)
 select g.owner_id,g.id,'release','release:'||g.id::text,g.data->>'title','Ya llegó su lanzamiento.','/?tab=upcoming'
 from public.games g join public.members m on m.id=g.owner_id and m.active
 join public.notification_preferences pref on pref.owner_id=g.owner_id and pref.releases
 where g.id=released_game and exists(select 1 from public.playthroughs p where p.game_id=g.id and p.owner_id=g.owner_id and p.deleted_at is null and p.data->>'status'='upcoming')
 on conflict(event_key) do nothing returning id into nid;
 return nid;
end $$;

create or replace function public.notification_release_candidates(member_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(record),'[]'::jsonb) from(
 select distinct on(g.id) g.data||jsonb_build_object('id',g.id,'sourceSnapshot',p.source_snapshot,'releaseSince',pref.release_since) as record
 from public.games g join public.playthroughs p on p.game_id=g.id and p.owner_id=g.owner_id
 join public.members m on m.id=g.owner_id and m.active join public.notification_preferences pref on pref.owner_id=g.owner_id and pref.releases
 where p.deleted_at is null and p.data->>'status'='upcoming' and(member_id is null or g.owner_id=member_id) order by g.id,p.id) candidates;
$$;

create or replace function private.enqueue_price_change(previous public.offers,np numeric,nc text,nd integer) returns uuid language plpgsql security invoker set search_path='' as $$
declare pref public.notification_preferences; event_kind text; nid uuid; game_title text;
begin
 if not previous.watched or previous.price is null or previous.currency is distinct from nc or nd<=0
  or not(np<previous.price or previous.discount=0) then return null;end if;
 if not exists(select 1 from public.members where id=previous.owner_id and active) or not exists(
  select 1 from public.playthroughs p where p.game_id=previous.game_id and p.owner_id=previous.owner_id and p.deleted_at is null and p.data->>'status' in ('wishlist','upcoming')) then return null;end if;
 select * into pref from public.notification_preferences where owner_id=previous.owner_id;
 if pref.targets and previous.target_price is not null and np<previous.target_price and coalesce(previous.target_currency,previous.currency)=nc then event_kind:='target';
 elsif pref.discounts then event_kind:='discount';else return null;end if;
 select data->>'title' into game_title from public.games where id=previous.game_id;
 insert into public.notifications(owner_id,game_id,offer_id,kind,event_key,title,body,url)
 values(previous.owner_id,previous.game_id,previous.id,event_kind,
 'price:'||previous.id::text||':'||coalesce(previous.checked_at::text,'')||':'||nc||':'||np::text||':'||nd::text,coalesce(game_title,'Game Journal'),
 case when event_kind='target' then '¡Por debajo de tu precio objetivo! ' else 'Nuevo descuento: ' end ||
 upper(previous.store)||' · '||previous.region||' · '||nc||' '||np::text||' · '||nd::text||'% OFF','/?tab=wishlist')
 on conflict(event_key) do nothing returning id into nid;
 return nid;
end $$;

create or replace function public.record_quote(offer_id uuid,quote jsonb,expected text default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare old public.offers;np numeric;nc text;nd int;notification public.notifications;changed boolean;store_name text;begin
 select * into old from public.offers where id=offer_id for update;if old.id is null then return null;end if;
 if not exists(select 1 from public.playthroughs p where p.game_id=old.game_id and p.owner_id=old.owner_id and p.deleted_at is null and p.data->>'status' in ('wishlist','upcoming')) then return null;end if;
 if old.checked_at is distinct from expected::timestamptz then return null;end if;
 -- A price can be unavailable while the matching product title is still valid.
 -- One preferred offer prevents names/languages alternating between store refreshes.
 if jsonb_typeof(quote->'name')='string' then
   store_name=btrim(regexp_replace(quote->>'name','[[:space:]]+',' ','g'));
   if length(store_name) between 1 and 300 and old.id=(
     select o.id from public.offers o
     where o.game_id=old.game_id and o.owner_id=old.owner_id
     order by (o.store='steam') desc,(o.region='AR') desc,o.region,o.product,o.id
     limit 1
   ) then
     update public.games g set data=jsonb_set(g.data,'{title}',to_jsonb(store_name),true)
     where g.id=old.game_id and g.owner_id=old.owner_id
       and g.data->>'title' is distinct from store_name;
   end if;
 end if;
 np=(quote->>'price')::numeric;nc=quote->>'currency';nd=coalesce((quote->>'discount')::int,0);

 if old.store='steam' and old.status='upcoming' and quote->>'status' in ('available','free','early_access') then perform private.enqueue_release(old.game_id);end if;
 if np is null or nc is null then update public.offers set status=coalesce(quote->>'status','unavailable'),checked_at=now(),lease_until=null,error='Precio no disponible; se conserva el anterior' where id=old.id;return null;end if;
 changed=old.price is distinct from np or old.currency is distinct from nc or old.discount<>nd;
 update public.offers set price=np,regular_price=(quote->>'regular')::numeric,currency=nc,discount=nd,status=quote->>'status',checked_at=now(),last_success_at=now(),error=null,lease_until=null where id=old.id;
 if changed then insert into public.price_history(offer_id,owner_id,price,currency,discount)values(old.id,old.owner_id,np,nc,nd);end if;


 perform private.enqueue_price_change(old,np,nc,nd);
 return null;
end $$;

create or replace function private.capture_daily_backup(member_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare run uuid; snapshot jsonb; stamp timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtextextended('game-journal-backup:' || member_id::text, 0));
  select r.id into run from public.backup_runs r
    join private.backup_snapshots s on s.run_id=r.id
    where r.owner_id=member_id and r.status='succeeded'
      and r.backup_day=(stamp at time zone 'America/Argentina/Buenos_Aires')::date
    order by r.completed_at desc limit 1;
  if run is not null then return run; end if;
  insert into public.backup_runs(owner_id,status) values(member_id,'running') returning id into run;
  begin
    -- One SQL statement gives all source tables the same MVCC snapshot.
    select jsonb_build_object(
      'version',4,'kind','game-journal-daily','ownerId',member_id,'exportedAt',stamp,
      'records',coalesce((select jsonb_agg(g.data||p.data||jsonb_build_object(
        'id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),
        'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at) order by p.id)
        from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id
        where p.owner_id=member_id and p.deleted_at is null),'[]'::jsonb),
      'trash',coalesce((select jsonb_agg(g.data||p.data||jsonb_build_object('id',p.id,'gameId',g.id,'deleted_at',p.deleted_at,'updated_at',p.updated_at,'sourceKey',coalesce(p.source_key,''),'sourceSnapshot',p.source_snapshot)) from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id where p.owner_id=member_id and p.deleted_at is not null),'[]'::jsonb),
      'offers',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.offers o where o.owner_id=member_id),'[]'::jsonb),
      'priceHistory',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from public.price_history h where h.owner_id=member_id),'[]'::jsonb),
      'sourceTables',jsonb_build_object(
        'games',coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from public.games g where g.owner_id=member_id),'[]'::jsonb),
        'playthroughs',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.playthroughs p where p.owner_id=member_id),'[]'::jsonb),
        'imports',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.imports i where i.owner_id=member_id),'[]'::jsonb),
        'shared_entries',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.shared_entries s where s.owner_id=member_id),'[]'::jsonb),
        'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.id) from public.notifications n where n.owner_id=member_id),'[]'::jsonb),
        'notification_preferences',(select to_jsonb(pref) from public.notification_preferences pref where pref.owner_id=member_id),
        'member',(select to_jsonb(m) from public.members m where m.id=member_id)
      )
    ) into snapshot;
    insert into private.backup_snapshots(run_id,owner_id,payload) values(run,member_id,snapshot);
    update public.backup_runs set status='succeeded',completed_at=clock_timestamp(),
      record_count=jsonb_array_length(snapshot->'records'),
      offer_count=jsonb_array_length(snapshot->'offers'),
      history_count=jsonb_array_length(snapshot->'priceHistory'),
      byte_count=octet_length(snapshot::text),
      sha256=encode(extensions.digest(snapshot::text,'sha256'),'hex')
    where id=run;
    -- Keep the latest 30 successful snapshots, never prune after a failed capture.
    delete from private.backup_snapshots s where s.owner_id=member_id and s.run_id in (
      select r.id from public.backup_runs r join private.backup_snapshots b on b.run_id=r.id
      where r.owner_id=member_id and r.status='succeeded'
      order by r.completed_at desc,r.id desc offset 30
    );
    delete from public.backup_runs r where r.owner_id=member_id
      and r.started_at < stamp-interval '90 days'
      and not exists(select 1 from private.backup_snapshots s where s.run_id=r.id);
  exception when others then
    -- The subtransaction rolls back a partial snapshot. No payloads/errors in public logs.
    update public.backup_runs set status='failed',completed_at=clock_timestamp(),error_code=sqlstate
      where id=run;
  end;
  return run;
end $$;

create function public.purge_trash_items(items jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item jsonb; total integer:=0;
begin
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>5000 or jsonb_array_length(items)<1 then raise exception 'Selección inválida';end if;
 for item in select value from jsonb_array_elements(items) order by value->>'id' loop
  perform private.trash_command((item->>'id')::uuid,'purge',item->>'expected');total:=total+1;
 end loop;return jsonb_build_object('ok',true,'count',total);
end $$;
revoke all on function public.purge_trash_items(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.purge_trash_items(jsonb) to authenticated;

-- Save and return its canonical revision in one transaction. Older save RPCs remain available.
create function public.save_record_result(input jsonb,record_id uuid default null,expected text default null) returns jsonb
language plpgsql security invoker set search_path='' as $saved$
declare result jsonb;entry jsonb;
begin
 if input ? 'pages' then result:=public.save_record_with_pages(input,record_id,expected);
 else result:=public.save_record(input,record_id,expected);end if;
 select value into entry from jsonb_array_elements(public.list_records()) where value->>'id'=result->>'id';
 if entry is null then raise exception 'NOT_FOUND';end if;
 return result||jsonb_build_object('record',entry,'revision',entry->>'updated_at');
end $saved$;
revoke all on function public.save_record_result(jsonb,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.save_record_result(jsonb,uuid,text) to authenticated;
