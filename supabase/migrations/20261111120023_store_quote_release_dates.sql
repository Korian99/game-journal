-- Correct provider release metadata for games with an active upcoming playthrough.
create or replace function public.record_quote(offer_id uuid,quote jsonb,expected text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 old public.offers;np numeric;nc text;nd int;notification public.notifications;changed boolean;store_name text;
 release_value text;release_year int;
begin
 select * into old from public.offers where id=offer_id for update;if old.id is null then return null;end if;
 -- Serialize against save_record, which holds this row before changing playthrough status.
 perform 1 from public.games g where g.id=old.game_id and g.owner_id=old.owner_id for update;
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
 -- Store dates are applied only to games with a live upcoming playthrough.
 release_value=quote->>'releaseDate';
 if jsonb_typeof(quote->'releaseDate')='string' and exists(
   select 1 from public.playthroughs p where p.game_id=old.game_id and p.owner_id=old.owner_id
     and p.deleted_at is null and p.data->>'status'='upcoming'
 ) then
   if release_value ~ '^[0-9]{4}$' then
     release_year=release_value::int;
   elsif release_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
     begin
       perform release_value::date;
       release_year=substring(release_value,1,4)::int;
     exception when invalid_datetime_format or datetime_field_overflow then
       release_value=null;
     end;
   else
     release_value=null;
   end if;
   if release_value is not null and release_year between 1950 and 2200 then
     update public.games g
       set data=g.data||jsonb_build_object('release',release_value,'year',release_year)
       where g.id=old.game_id and g.owner_id=old.owner_id
         and (g.data->>'release' is distinct from release_value
           or g.data->>'year' is distinct from release_year::text);
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
