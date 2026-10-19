create or replace function private.enqueue_price_change(previous public.offers,np numeric,nc text,nd integer) returns uuid language plpgsql security invoker set search_path='' as $$
declare pref public.notification_preferences; event_kind text; nid uuid; game_title text;
begin
 if not previous.watched or previous.price is null or previous.currency is distinct from nc or nd<=0
  or not(np<previous.price or previous.discount=0) then return null;end if;
 if not exists(select 1 from public.members where id=previous.owner_id and active) or not exists(
  select 1 from public.playthroughs p where p.game_id=previous.game_id and p.owner_id=previous.owner_id and p.data->>'status' in ('wishlist','upcoming')) then return null;end if;
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
revoke all on function private.enqueue_price_change(public.offers,numeric,text,integer) from public,anon,authenticated,service_role;


-- Independent dispatcher: no Steam/Nintendo requests. Uses the existing Vault cron secret.
select cron.schedule('game-journal-notifications','*/5 * * * *',$job$
 select net.http_post(
  url:='https://pgosoyxbuxfrkfjvmflm.supabase.co/functions/v1/notification-worker',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='game_journal_cron')),
  body:='{}'::jsonb,timeout_milliseconds:=10000);
$job$);
