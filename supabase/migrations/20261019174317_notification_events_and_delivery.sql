
create table public.notification_preferences(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 discounts boolean not null default true, targets boolean not null default true,
 releases boolean not null default true, release_since timestamptz not null default now());
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select on public.notification_preferences to authenticated;
grant update(discounts,targets,releases) on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
create policy own_preferences on public.notification_preferences for select to authenticated using((select private.is_member()) and owner_id=(select auth.uid()));
create policy update_preferences on public.notification_preferences for update to authenticated
 using((select private.is_member()) and owner_id=(select auth.uid())) with check((select private.is_member()) and owner_id=(select auth.uid()));
insert into public.notification_preferences(owner_id) select id from public.members;
create function private.initialize_notification_preferences() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.notification_preferences(owner_id) values(new.id) on conflict do nothing;return new;end $$;
revoke all on function private.initialize_notification_preferences() from public,anon,authenticated,service_role;
create trigger initialize_notification_preferences after insert on public.members for each row execute function private.initialize_notification_preferences();
create function private.reset_release_notifications() returns trigger language plpgsql security invoker set search_path='' as $$
begin if new.releases and not old.releases then new.release_since:=clock_timestamp();end if;return new;end $$;
revoke all on function private.reset_release_notifications() from public,anon,authenticated,service_role;
create trigger reset_release_notifications before update on public.notification_preferences for each row execute function private.reset_release_notifications();
alter table public.notifications add column kind text not null default 'discount' check(kind in ('discount','target','release','test'));
alter table public.notifications add column game_id uuid references public.games(id) on delete set null;
alter table public.notifications add column url text not null default '/?tab=wishlist';
grant update(read_at) on public.notifications to authenticated;
create policy read_own_notification on public.notifications for update to authenticated
 using((select private.is_member()) and owner_id=(select auth.uid())) with check((select private.is_member()) and owner_id=(select auth.uid()));
create index notifications_game on public.notifications(game_id);
create index notifications_offer on public.notifications(offer_id);
alter table public.offers add column target_currency text;
update public.offers set target_currency=currency where target_price is not null;
alter table public.offers alter column watched set default true;
-- Existing wishlist/upcoming pages start followed; users can mute each page.
update public.offers o set watched=true where exists(select 1 from public.playthroughs p where p.game_id=o.game_id and p.owner_id=o.owner_id and p.data->>'status' in ('wishlist','upcoming'));
create function private.enqueue_release(released_game uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare nid uuid;
begin
 insert into public.notifications(owner_id,game_id,kind,event_key,title,body,url)
 select g.owner_id,g.id,'release','release:'||g.id::text,g.data->>'title','Ya llegó su lanzamiento.','/?tab=upcoming'
 from public.games g join public.members m on m.id=g.owner_id and m.active
 join public.notification_preferences pref on pref.owner_id=g.owner_id and pref.releases
 where g.id=released_game and exists(select 1 from public.playthroughs p where p.game_id=g.id and p.owner_id=g.owner_id and p.data->>'status'='upcoming')
 on conflict(event_key) do nothing returning id into nid;
 return nid;
end $$;
revoke all on function private.enqueue_release(uuid) from public,anon,authenticated,service_role;
create function public.enqueue_due_releases(game_ids uuid[]) returns integer language plpgsql security definer set search_path='' as $$
declare gid uuid; total integer:=0;
begin
 if coalesce(cardinality(game_ids),0)>500 then raise exception 'Too many release candidates';end if;
 foreach gid in array coalesce(game_ids,'{}'::uuid[]) loop if private.enqueue_release(gid) is not null then total:=total+1;end if;end loop;
 return total;
end $$;
revoke all on function public.enqueue_due_releases(uuid[]) from public,anon,authenticated;
grant execute on function public.enqueue_due_releases(uuid[]) to service_role;
create function public.notification_release_candidates(member_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(record),'[]'::jsonb) from(
 select distinct on(g.id) g.data||jsonb_build_object('id',g.id,'sourceSnapshot',p.source_snapshot,'releaseSince',pref.release_since) as record
 from public.games g join public.playthroughs p on p.game_id=g.id and p.owner_id=g.owner_id
 join public.members m on m.id=g.owner_id and m.active join public.notification_preferences pref on pref.owner_id=g.owner_id and pref.releases
 where p.data->>'status'='upcoming' and(member_id is null or g.owner_id=member_id) order by g.id,p.id) candidates;
$$;
revoke all on function public.notification_release_candidates(uuid) from public,anon,authenticated;
grant execute on function public.notification_release_candidates(uuid) to service_role;
create function private.enqueue_price_change(previous public.offers,np numeric,nc text,nd integer) returns uuid language plpgsql security invoker set search_path='' as $$
declare pref public.notification_preferences; event_kind text; nid uuid; game_title text;
begin
 if not previous.watched or previous.price is null or previous.currency is distinct from nc or nd<=0
  or not(np<previous.price or previous.discount=0) then return null;end if;
 if not exists(select 1 from public.members where id=previous.owner_id and active) or not exists(
  select 1 from public.playthroughs p where p.game_id=previous.game_id and p.owner_id=previous.owner_id and p.data->>'status' in ('wishlist','upcoming')) then return null;end if;
 select * into pref from public.notification_preferences where owner_id=previous.owner_id;
 if pref.targets and previous.target_price is not null and np<=previous.target_price and coalesce(previous.target_currency,previous.currency)=nc then event_kind:='target';
 elsif pref.discounts then event_kind:='discount';else return null;end if;
 select data->>'title' into game_title from public.games where id=previous.game_id;
 insert into public.notifications(owner_id,game_id,offer_id,kind,event_key,title,body,url)
 values(previous.owner_id,previous.game_id,previous.id,event_kind,
 'price:'||previous.id::text||':'||coalesce(previous.checked_at::text,'')||':'||nc||':'||np::text||':'||nd::text,coalesce(game_title,'Game Journal'),
 case when event_kind='target' then '¡Llegó a tu precio objetivo! ' else 'Nuevo descuento: ' end ||
 upper(previous.store)||' · '||previous.region||' · '||nc||' '||np::text||' · '||nd::text||'% OFF','/?tab=wishlist')
 on conflict(event_key) do nothing returning id into nid;
 return nid;
end $$;
revoke all on function private.enqueue_price_change(public.offers,numeric,text,integer) from public,anon,authenticated,service_role;
create table public.notification_deliveries(
 event_id uuid not null references public.notifications(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sent','failed')),
 attempts integer not null default 0, lease_token uuid,lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),sent_at timestamptz,primary key(event_id,subscription_id));
create index notification_deliveries_sub on public.notification_deliveries(subscription_id);
create index notification_deliveries_owner on public.notification_deliveries(owner_id);
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from public,anon,authenticated;
grant all on public.notification_deliveries to service_role;
-- Internal queue has no browser policies or grants.
create function public.claim_notification_deliveries(member_id uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 insert into public.notification_deliveries(event_id,subscription_id,owner_id)
 select n.id,s.id,n.owner_id from public.notifications n
 join public.push_subscriptions s on s.owner_id=n.owner_id and s.created_at<=n.created_at
 join public.members m on m.id=n.owner_id and m.active join public.notification_preferences pref on pref.owner_id=n.owner_id
 where n.kind<>'test' and n.created_at>now()-interval '24 hours' and (member_id is null or n.owner_id=member_id)
 and case n.kind when 'discount' then pref.discounts when 'target' then pref.targets when 'release' then pref.releases else false end
 on conflict do nothing;
 update public.notification_deliveries set status='failed' where status='pending' and attempts>=8
 and(lease_until is null or lease_until<now()) and(member_id is null or owner_id=member_id);
 with claimed as(
 update public.notification_deliveries d set lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=attempts+1
 where(d.event_id,d.subscription_id) in(
 select x.event_id,x.subscription_id from public.notification_deliveries x join public.notifications n on n.id=x.event_id
 join public.members m on m.id=x.owner_id and m.active join public.notification_preferences pref on pref.owner_id=x.owner_id
 where x.status='pending' and x.attempts<8 and x.next_attempt_at<=now() and(x.lease_until is null or x.lease_until<now())
 and n.created_at>now()-interval '24 hours' and(member_id is null or x.owner_id=member_id)
 and case n.kind when 'discount' then pref.discounts when 'target' then pref.targets when 'release' then pref.releases when 'test' then true else false end
 order by n.created_at,x.subscription_id for update of x skip locked limit 40) returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('event_id',c.event_id,'subscription_id',c.subscription_id,'lease_token',c.lease_token,
 'subscription',s.subscription,'title',n.title,'body',n.body,'url',n.url)),'[]'::jsonb) into result
 from claimed c join public.notifications n on n.id=c.event_id join public.push_subscriptions s on s.id=c.subscription_id;
 return result;
end $$;
revoke all on function public.claim_notification_deliveries(uuid) from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries(uuid) to service_role;
create function public.finish_notification_delivery(event uuid,device uuid,token uuid,result text) returns boolean language plpgsql security invoker set search_path='' as $$
declare changed boolean;
begin
 if result not in('sent','retry','expired') then raise exception 'Invalid delivery result';end if;
 -- Lock before checking the lease: concurrent/late acknowledgements cannot delete a newer subscription.
 perform 1 from public.notification_deliveries d where d.event_id=event and d.subscription_id=device
 and d.lease_token=token and d.lease_until>now() and d.status='pending' for update;
 if not found then return false;end if;
 if result='expired' then delete from public.push_subscriptions where id=device;return true;end if;
 update public.notification_deliveries set status=case when result='sent' then 'sent' when attempts>=8 then 'failed' else 'pending' end,
 sent_at=case when result='sent' then now() else null end,next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer),
 lease_until=null,lease_token=null where event_id=event and subscription_id=device and lease_token=token and status='pending';
 changed:=found;
 update public.notifications n set delivered_at=now() where n.id=event and exists(select 1 from public.notification_deliveries d where d.event_id=n.id)
 and not exists(select 1 from public.notification_deliveries d where d.event_id=n.id and d.status<>'sent');
 return changed;
end $$;
revoke all on function public.finish_notification_delivery(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finish_notification_delivery(uuid,uuid,uuid,text) to service_role;
create function private.request_test_notification(endpoint text) returns uuid language plpgsql security definer set search_path='' as $$
declare sub uuid; event uuid; owner uuid:=(select auth.uid());
begin
 if not private.is_member() then raise exception 'No autorizado';end if;
 perform pg_advisory_xact_lock(hashtextextended('test-push:'||owner::text,0));
 select s.id into sub from public.push_subscriptions s where s.owner_id=owner and s.endpoint=request_test_notification.endpoint;
 if sub is null then raise exception 'Activá las notificaciones en este dispositivo primero.';end if;
 if exists(select 1 from public.notifications where owner_id=owner and kind='test' and created_at>now()-interval '1 minute') then raise exception 'Esperá un minuto antes de repetir la prueba.';end if;
 event:=gen_random_uuid();
 insert into public.notifications(id,owner_id,kind,event_key,title,body,url)
 values(event,owner,'test','test:'||event::text,'Game Journal','¡Las notificaciones están funcionando!','/?tab=settings');
 insert into public.notification_deliveries(event_id,subscription_id,owner_id) values(event,sub,owner);
 return event;
end $$;
revoke all on function private.request_test_notification(text) from public,anon,authenticated,service_role;
grant execute on function private.request_test_notification(text) to authenticated;
create function public.request_test_notification(endpoint text) returns uuid language sql security invoker set search_path='' as $$ select private.request_test_notification(endpoint); $$;
revoke all on function public.request_test_notification(text) from public,anon,service_role;
grant execute on function public.request_test_notification(text) to authenticated;

create or replace function public.record_quote(offer_id uuid,quote jsonb,expected text default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare old public.offers;np numeric;nc text;nd int;notification public.notifications;changed boolean;store_name text;begin
 select * into old from public.offers where id=offer_id for update;if old.id is null then return null;end if;
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

revoke all on function public.record_quote(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_quote(uuid,jsonb,text) to service_role;

-- Include notification choices in future daily snapshots.
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
      'version',3,'kind','game-journal-daily','ownerId',member_id,'exportedAt',stamp,
      'records',coalesce((select jsonb_agg(g.data||p.data||jsonb_build_object(
        'id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),
        'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at) order by p.id)
        from public.playthroughs p join public.games g on g.id=p.game_id and g.owner_id=p.owner_id
        where p.owner_id=member_id),'[]'::jsonb),
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
