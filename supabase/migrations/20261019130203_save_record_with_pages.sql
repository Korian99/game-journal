-- Store a game and its optional pages in the same transaction.
-- Price-backed pages become offers; other HTTPS pages remain private references.
create function public.save_record_with_pages(
  input jsonb,
  record_id uuid default null,
  expected text default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  page_value jsonb;
  page_url text;
  page_match text[];
  page_store text;
  page_product text;
  page_region text;
  reference_pages jsonb := '[]'::jsonb;
  tracked_pages jsonb := '[]'::jsonb;
  tracked_page jsonb;
  saved jsonb;
begin
  if not private.is_member() then raise exception 'No autorizado'; end if;
  if jsonb_typeof(input->'pages') is distinct from 'array'
    or jsonb_array_length(input->'pages') > 20 then
    raise exception 'Podés agregar hasta 20 páginas';
  end if;
  for page_value in select value from jsonb_array_elements(input->'pages') loop
    if jsonb_typeof(page_value) is distinct from 'string' then
      raise exception 'Enlace de página inválido';
    end if;
    page_url := page_value #>> '{}';
    if length(page_url) > 2000
      or page_url !~ '^https://[a-zA-Z0-9.-]+([/?#][^[:space:]]*)?$' then
      raise exception 'Usá un enlace HTTPS válido, sin usuario ni contraseña';
    end if;
    page_match := regexp_match(page_url, '^https://store\.steampowered\.com/app/([0-9]+)/(?:\?cc=([A-Z]{2}))?$');
    if page_match is not null then
      page_store := 'steam';
      page_product := page_match[1];
      page_region := coalesce(page_match[2], 'AR');
    else
      page_match := regexp_match(page_url, '^https://www\.nintendo\.com/(us|en-us|es-ar|en-ca|en-gb|es-es|es-mx|pt-br)/store/products/([a-zA-Z0-9-]+)/$');
      if page_match is null then
        if not (reference_pages ? page_url) then
          reference_pages := reference_pages || jsonb_build_array(page_url);
        end if;
        continue;
      end if;
      page_store := 'nintendo';
      page_product := page_match[2];
      page_region := case page_match[1]
        when 'us' then 'US' when 'en-us' then 'US' when 'es-ar' then 'AR'
        when 'en-ca' then 'CA' when 'en-gb' then 'GB' when 'es-es' then 'ES'
        when 'es-mx' then 'MX' when 'pt-br' then 'BR' end;
    end if;
    tracked_pages := tracked_pages || jsonb_build_array(
      jsonb_build_object('url', page_url, 'store', page_store, 'product', page_product, 'region', page_region)
    );
  end loop;
  saved := public.save_record(input || jsonb_build_object('pages', reference_pages), record_id, expected);
  for tracked_page in select value from jsonb_array_elements(tracked_pages) loop
    insert into public.offers(owner_id, game_id, url, store, product, region)
    values (
      auth.uid(), (saved->>'gameId')::uuid, tracked_page->>'url',
      tracked_page->>'store', tracked_page->>'product', tracked_page->>'region'
    ) on conflict(owner_id, game_id, store, product, region) do nothing;
  end loop;
  return saved;
end $$;
revoke all on function public.save_record_with_pages(jsonb, uuid, text) from public, anon;
grant execute on function public.save_record_with_pages(jsonb, uuid, text) to authenticated;
