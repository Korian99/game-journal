create function private.sync_game_revisions() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.playthroughs set updated_at=clock_timestamp() where game_id=new.id;
 return new;
end $$;
revoke all on function private.sync_game_revisions() from public;
create trigger sync_game_revisions after update of data on public.games for each row when(old.data is distinct from new.data) execute function private.sync_game_revisions();
create or replace function public.save_record(input jsonb,record_id uuid default null,expected text default null,snapshot jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
 declare gid uuid;pid uuid;current_stamp timestamptz;meta jsonb;journal jsonb;begin
 if not private.is_member() then raise exception 'No autorizado';end if;
 if coalesce(length(trim(input->>'title')),0)=0 or length(input->>'title')>300 then raise exception 'Título inválido';end if;
 meta=jsonb_build_object('title',input->'title','year',input->'year','platforms',input->'platforms','ownership',input->'ownership','priority',input->'priority','hype',input->'hype','estimated',input->'estimated');
 journal=input-array['id','gameId','title','year','platforms','ownership','priority','hype','estimated','sourceKey','sourceSnapshot','updated_at','offers','links','raw'];
 if record_id is not null then
 select p.game_id,p.updated_at into gid,current_stamp from public.playthroughs p join public.games g on g.id=p.game_id where p.id=record_id and p.owner_id=(select auth.uid()) for update of g;
 if gid is null then raise exception 'Entrada no encontrada';end if;
 if expected is null or current_stamp<>expected::timestamptz then raise exception 'CONFLICT: la entrada cambió en otro dispositivo';end if;
 update public.games set data=meta where id=gid and data is distinct from meta;
 update public.playthroughs set data=journal,source_snapshot=coalesce(snapshot,source_snapshot),updated_at=clock_timestamp() where id=record_id returning id into pid;
 else
 if input->>'gameId' is not null then select id into gid from public.games where id=(input->>'gameId')::uuid and owner_id=(select auth.uid());if gid is null then raise exception 'Juego no encontrado';end if;
 else insert into public.games(owner_id,data)values((select auth.uid()),meta)returning id into gid;end if;
 insert into public.playthroughs(game_id,owner_id,data,source_key,source_snapshot)values(gid,(select auth.uid()),journal,nullif(input->>'sourceKey',''),coalesce(snapshot,'{}')) returning id into pid;
 end if;
 return jsonb_build_object('id',pid,'gameId',gid);end $$;
