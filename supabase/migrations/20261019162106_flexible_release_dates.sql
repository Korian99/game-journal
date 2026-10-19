-- Keep release precision in game metadata, shared by its playthroughs.
create or replace function public.save_record(input jsonb,record_id uuid default null,expected text default null,snapshot jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
 declare gid uuid;pid uuid;current_stamp timestamptz;meta jsonb;journal jsonb;release_value text;existing_release jsonb;begin
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
 select p.game_id,p.updated_at,g.data->'release' into gid,current_stamp,existing_release from public.playthroughs p join public.games g on g.id=p.game_id where p.id=record_id and p.owner_id=(select auth.uid()) for update of g;
 if gid is null then raise exception 'Entrada no encontrada';end if;
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

revoke all on function public.save_record(jsonb,uuid,text,jsonb) from public,anon;
grant execute on function public.save_record(jsonb,uuid,text,jsonb) to authenticated;
