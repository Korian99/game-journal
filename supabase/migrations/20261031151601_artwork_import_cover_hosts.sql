create or replace function private.cover_image_url(value text)
returns text
language sql
immutable
parallel safe
set search_path=''
as $$
  select case
    when value is not null
      and char_length(btrim(value)) between 1 and 2000
      and btrim(value) !~ '[[:space:]]'
      and lower(btrim(value)) ~ '^https://(shared\.akamai\.steamstatic\.com|shared\.fastly\.steamstatic\.com|assets\.nintendo\.com|applescoop\.org|bfasset\.costco-static\.com|boulanger\.scene7\.com|cdn\.awsli\.com\.br|cdn\.cloudflare\.steamstatic\.com|cdn\.mobygames\.com|cdn\.mos\.cms\.futurecdn\.net|divinity\.com|down-my\.img\.susercontent\.com|ecommerce\.datablitz\.com\.ph|gameplay\.com\.co|gaming-cdn\.com|http2\.mlstatic\.com|i\.ebayimg\.com|i5\.walmartimages\.com|imagenes\.hobbyconsolas\.com|images\.artandgungame\.com|images\.ctfassets\.net|images\.inkl\.com|images\.launchbox-app\.com|img\.youtube\.com|justpressplayonline\.com|media\.gamatomic\.com|media\.gamestop\.com|media\.karousell\.com|miro\.medium\.com|multimedia\.bbycastatic\.ca|pnpdistribution\.com|retrogamefan\.com|retronorthgames\.com|rimage\.ripley\.com\.pe|s13emagst\.akamaized\.net|shared\.steamstatic\.com|storage\.googleapis\.com|superretro\.com\.au|tbcgames\.com|videogamesplus\.ca|www\.japanzon\.com|www\.kjell\.com|www\.nintendo\.com|www\.powerupgaming\.ca|www\.pressstart\.pt|www\.staples-3p\.com|www\.switchscores\.com|www\.tinyrobotonline\.com|www\.videodivari\.fi|www\.videogameschronicle\.com)(:443)?/'
    then btrim(value)
    else null
  end;
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
 elsif f='cover' and choice='sheet' then
   combined=jsonb_set(
     combined,
     array[f],
     (case when jsonb_typeof(combined->'cover')='object' then combined->'cover' else '{}'::jsonb end-'providerUrl'-'provider')||
       jsonb_build_object('providerUrl',item->'incoming'->'cover'->'providerUrl'),
     true
   );
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
