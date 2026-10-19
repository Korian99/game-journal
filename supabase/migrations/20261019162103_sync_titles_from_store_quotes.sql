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
 if np is null or nc is null then update public.offers set status=coalesce(quote->>'status','unavailable'),checked_at=now(),lease_until=null,error='Precio no disponible; se conserva el anterior' where id=old.id;return null;end if;
 changed=old.price is distinct from np or old.currency is distinct from nc or old.discount<>nd;
 update public.offers set price=np,regular_price=(quote->>'regular')::numeric,currency=nc,discount=nd,status=quote->>'status',checked_at=now(),last_success_at=now(),error=null,lease_until=null where id=old.id;
 if changed then insert into public.price_history(offer_id,owner_id,price,currency,discount)values(old.id,old.owner_id,np,nc,nd);end if;
 if old.watched and old.price is not null and old.currency=nc and(np<old.price or(old.discount=0 and nd>0))and(old.target_price is null or np<=old.target_price) then
 insert into public.notifications(owner_id,offer_id,event_key,title,body)values(old.owner_id,old.id,old.id::text||':'||coalesce(old.checked_at::text,'')||':'||nc||':'||np::text||':'||nd::text,coalesce(quote->>'name','Bajó un juego que seguís'),old.store||' · '||old.region||' · '||nc||' '||np::text||' · '||nd::text||'% OFF') on conflict(event_key)do nothing returning * into notification;
 end if;return to_jsonb(notification);end $$;

revoke all on function public.record_quote(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_quote(uuid,jsonb,text) to service_role;
