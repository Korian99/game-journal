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
      and lower(btrim(value)) ~ '^https://(shared\.akamai\.steamstatic\.com|shared\.fastly\.steamstatic\.com|assets\.nintendo\.com)(:443)?/'
    then btrim(value)
    else null
  end;
$$;

create or replace function private.cover_metadata_is_valid(value jsonb)
returns boolean
language plpgsql
immutable
set search_path=''
as $$
declare
  key text;
  image_url text;
begin
  if jsonb_typeof(value) is distinct from 'object'
     or (value - array['providerUrl','overrideUrl','provider']) <> '{}'::jsonb then
    return false;
  end if;
  if value ? 'provider' and (
    jsonb_typeof(value->'provider') is distinct from 'string'
    or value->>'provider' not in ('steam','nintendo')
  ) then
    return false;
  end if;
  foreach key in array array['providerUrl','overrideUrl'] loop
    if value ? key then
      if jsonb_typeof(value->key) is distinct from 'string' then
        return false;
      end if;
      image_url := value->>key;
      if char_length(image_url) > 2000 then
        return false;
      end if;
      if btrim(image_url) <> '' and private.cover_image_url(image_url) is null then
        return false;
      end if;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function private.cover_image_url(text), private.cover_metadata_is_valid(jsonb) from public, anon;
grant execute on function private.cover_image_url(text), private.cover_metadata_is_valid(jsonb) to authenticated, service_role;

create or replace function public.save_record(input jsonb,record_id uuid default null,expected text default null,snapshot jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
 declare gid uuid;pid uuid;current_stamp timestamptz;removed timestamptz;meta jsonb;journal jsonb;release_value text;existing_release jsonb;existing_cover jsonb;begin
 if not private.is_member() then raise exception 'No autorizado';end if;
 if coalesce(length(trim(input->>'title')),0)=0 or length(input->>'title')>300 then raise exception 'Título inválido';end if;
 if input ? 'cover' and not private.cover_metadata_is_valid(input->'cover') then raise exception 'Portada inválida';end if;
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
 journal=input-array['id','gameId','cover','title','year','release','platforms','ownership','priority','hype','estimated','sourceKey','sourceSnapshot','updated_at','offers','links','raw'];
 if record_id is not null then
 select p.game_id,p.updated_at,p.deleted_at,g.data->'release',g.data->'cover' into gid,current_stamp,removed,existing_release,existing_cover from public.playthroughs p join public.games g on g.id=p.game_id where p.id=record_id and p.owner_id=(select auth.uid()) for update of g;
 if gid is null then raise exception 'NOT_FOUND';end if;
 if removed is not null then raise exception 'GONE';end if;
 if expected is null or current_stamp<>expected::timestamptz then raise exception 'CONFLICT: la entrada cambió en otro dispositivo';end if;
 if input ? 'cover' then meta=meta||jsonb_build_object('cover',input->'cover');
 elsif existing_cover is not null and jsonb_typeof(existing_cover)<>'null' then meta=meta||jsonb_build_object('cover',existing_cover);end if;
 -- Older clients omit release: preserve the richer value on an ordinary edit.
 if not (input ? 'release') and existing_release is not null then
   meta=meta||jsonb_build_object('release',existing_release);
 end if;
 update public.games set data=meta where id=gid and data is distinct from meta;
 update public.playthroughs set data=journal,source_snapshot=coalesce(snapshot,source_snapshot),updated_at=clock_timestamp() where id=record_id returning id into pid;
 else
 if input->>'gameId' is not null then
   select id into gid from public.games where id=(input->>'gameId')::uuid and owner_id=(select auth.uid()) for update;
   if gid is null then raise exception 'Juego no encontrado';end if;
 else
   if input ? 'cover' then meta=meta||jsonb_build_object('cover',input->'cover');end if;
   insert into public.games(owner_id,data)values((select auth.uid()),meta)returning id into gid;
 end if;
 insert into public.playthroughs(game_id,owner_id,data,source_key,source_snapshot)values(gid,(select auth.uid()),journal,nullif(input->>'sourceKey',''),coalesce(snapshot,'{}')) returning id into pid;
 end if;
 return jsonb_build_object('id',pid,'gameId',gid);end $$;

create or replace function private.read_shared() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('shareId',s.id,'owner',m.display_name,'title',g.data->'title','period',p.data->'period','device',p.data->'device','status',p.data->'status','hours',p.data->'hours','rating',p.data->'rating','memorability',p.data->'memorability','impression',p.data->'impression','focus',p.data->'focus','replay',p.data->'replay','coverUrl',coalesce(private.cover_image_url(g.data->'cover'->>'overrideUrl'),private.cover_image_url(g.data->'cover'->>'providerUrl')))),'[]')
 from public.shared_entries s join public.playthroughs p on p.id=s.entry_id and p.owner_id=s.owner_id join public.games g on g.id=p.game_id join public.members m on m.id=s.owner_id and m.active
 where p.deleted_at is null and s.recipient_id=(select auth.uid()) and private.is_member();
$$;
