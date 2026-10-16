create function public.claim_offers(member_id uuid default null) returns setof public.offers language sql security definer set search_path='' as $$
 update public.offers o set lease_until=now()+interval '3 minutes'
 where o.id in(select x.id from public.offers x join public.members m on m.id=x.owner_id and m.active
 where(member_id is null or x.owner_id=member_id) and(x.lease_until is null or x.lease_until<now()) and(x.checked_at is null or x.checked_at<now()-case when member_id is null then interval '170 minutes' else interval '5 minutes' end)
 order by x.checked_at nulls first for update of x skip locked limit 8)
 returning o.*;
$$;
revoke all on function public.claim_offers(uuid) from public,anon,authenticated;
grant execute on function public.claim_offers(uuid) to service_role;
create function public.get_price_cache(cache_key text) returns jsonb language sql stable security definer set search_path='' as $$ select data from private.price_cache where key=cache_key and checked_at>now()-interval '5 minutes'; $$;
create function public.set_price_cache(cache_key text,quote jsonb) returns void language sql security definer set search_path='' as $$ insert into private.price_cache(key,data)values(cache_key,quote)on conflict(key)do update set data=excluded.data,checked_at=now(); $$;
revoke all on function public.get_price_cache(text),public.set_price_cache(text,jsonb) from public,anon,authenticated;
grant execute on function public.get_price_cache(text),public.set_price_cache(text,jsonb) to service_role;
create function public.record_quote(offer_id uuid,quote jsonb,expected text default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare old public.offers;np numeric;nc text;nd int;notification public.notifications;changed boolean;begin
 select * into old from public.offers where id=offer_id for update;if old.id is null then return null;end if;
 if old.checked_at is distinct from expected::timestamptz then return null;end if;
 np=(quote->>'price')::numeric;nc=quote->>'currency';nd=coalesce((quote->>'discount')::int,0);
 if np is null or nc is null then update public.offers set status=coalesce(quote->>'status','unavailable'),checked_at=now(),lease_until=null,error='Precio no disponible; se conserva el anterior' where id=old.id;return null;end if;
 changed=old.price is distinct from np or old.currency is distinct from nc or old.discount<>nd;
 update public.offers set price=np,regular_price=(quote->>'regular')::numeric,currency=nc,discount=nd,status=quote->>'status',checked_at=now(),error=null,lease_until=null where id=old.id;
 if changed then insert into public.price_history(offer_id,owner_id,price,currency,discount)values(old.id,old.owner_id,np,nc,nd);end if;
 if old.watched and old.price is not null and old.currency=nc and(np<old.price or(old.discount=0 and nd>0))and(old.target_price is null or np<=old.target_price) then
 insert into public.notifications(owner_id,offer_id,event_key,title,body)values(old.owner_id,old.id,old.id::text||':'||coalesce(old.checked_at::text,'')||':'||nc||':'||np::text||':'||nd::text,coalesce(quote->>'name','Bajó un juego que seguís'),old.store||' · '||old.region||' · '||nc||' '||np::text||' · '||nd::text||'% OFF') on conflict(event_key)do nothing returning * into notification;
 end if;return to_jsonb(notification);end $$;
revoke all on function public.record_quote(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_quote(uuid,jsonb,text) to service_role;
