alter table public.offers add column last_success_at timestamptz;
create or replace function public.apply_import(batch_id uuid,resolutions jsonb default '{}') returns int language plpgsql security invoker set search_path='' as $$
 declare b public.imports;item jsonb;combined jsonb;current_data jsonb;f text;choice text;total int=0;saved jsonb;link text;match text[];offer_region text;offer_store text;product_id text;begin
 select * into b from public.imports where id=batch_id and owner_id=(select auth.uid()) for update;
 if b.id is null or b.applied_at is not null then raise exception 'Importación inválida o ya aplicada';end if;
 for item in select * from jsonb_array_elements(b.plan) loop
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
create or replace function public.record_quote(offer_id uuid,quote jsonb,expected text default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare old public.offers;np numeric;nc text;nd int;notification public.notifications;changed boolean;begin
 select * into old from public.offers where id=offer_id for update;if old.id is null then return null;end if;
 if old.checked_at is distinct from expected::timestamptz then return null;end if;
 np=(quote->>'price')::numeric;nc=quote->>'currency';nd=coalesce((quote->>'discount')::int,0);
 if np is null or nc is null then update public.offers set status=coalesce(quote->>'status','unavailable'),checked_at=now(),lease_until=null,error='Precio no disponible; se conserva el anterior' where id=old.id;return null;end if;
 changed=old.price is distinct from np or old.currency is distinct from nc or old.discount<>nd;
 update public.offers set price=np,regular_price=(quote->>'regular')::numeric,currency=nc,discount=nd,status=quote->>'status',checked_at=now(),last_success_at=now(),error=null,lease_until=null where id=old.id;
 if changed then insert into public.price_history(offer_id,owner_id,price,currency,discount)values(old.id,old.owner_id,np,nc,nd);end if;
 if old.watched and old.price is not null and old.currency=nc and(np<old.price or(old.discount=0 and nd>0))and(old.target_price is null or np<=old.target_price) then
 insert into public.notifications(owner_id,offer_id,event_key,title,body)values(old.owner_id,old.id,old.id::text||':'||coalesce(old.checked_at::text,'')||':'||nc||':'||np::text||':'||nd::text,coalesce(quote->>'name','Bajó un juego que seguís'),old.store||' · '||old.region||' · '||nc||' '||np::text||' · '||nd::text||'% OFF') on conflict(event_key)do nothing returning * into notification;
 end if;return to_jsonb(notification);end $$;

create function public.configure_push_keys(public_key text,private_key text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(741322);
 if not exists(select 1 from vault.secrets where name='game_journal_vapid_public') then
 perform vault.create_secret(public_key,'game_journal_vapid_public');
 perform vault.create_secret(private_key,'game_journal_vapid_private');
 end if;
 return public.worker_config();
end $$;
revoke all on function public.configure_push_keys(text,text) from public,anon,authenticated;
grant execute on function public.configure_push_keys(text,text) to service_role;
create function public.push_public_key() returns text language sql stable security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name='game_journal_vapid_public' and private.is_member();
$$;
revoke all on function public.push_public_key() from public,anon;
grant execute on function public.push_public_key() to authenticated;
-- Supabase Cron uses UTC. Every three hours at :00 matches 02/05/08/11/14/17/20/23 in Argentina (UTC-3).
select cron.schedule('game-journal-prices','0 2,5,8,11,14,17,20,23 * * *',$job$
 select net.http_post(url:='https://pgosoyxbuxfrkfjvmflm.supabase.co/functions/v1/price-worker',
 headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='game_journal_cron')),body:='{}'::jsonb,timeout_milliseconds:=10000);
$job$);
select cron.alter_job(job_id := (select jobid from cron.job where jobname='game-journal-prices'), active := false);
