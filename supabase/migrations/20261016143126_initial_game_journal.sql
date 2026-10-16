create schema if not exists private;
revoke all on schema private from public;
create table public.members(id uuid primary key references auth.users on delete cascade, display_name text not null, role text not null default 'member' check(role in ('admin','member')), active boolean not null default true);
create function private.is_member() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.members where id=(select auth.uid()) and active); $$;
revoke all on function private.is_member() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;
alter table public.members enable row level security;
create policy members_read on public.members for select to authenticated using(private.is_member());
grant select on public.members to authenticated;
create table public.games(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now());
create index games_owner on public.games(owner_id);
create table public.playthroughs(id uuid primary key default gen_random_uuid(),game_id uuid not null references public.games on delete cascade,owner_id uuid not null references auth.users on delete cascade,data jsonb not null default '{}',source_key text,source_snapshot jsonb not null default '{}',updated_at timestamptz not null default clock_timestamp(),unique(owner_id,source_key));
create index playthrough_owner on public.playthroughs(owner_id);
create index playthrough_game on public.playthroughs(game_id);
create table public.offers(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,game_id uuid not null references public.games on delete cascade,url text not null,store text not null check(store in ('steam','nintendo')),product text not null,region text not null,currency text,price numeric check(price>=0),regular_price numeric check(regular_price>=0),discount int not null default 0 check(discount between 0 and 100),status text not null default 'pending',checked_at timestamptz,error text,watched boolean not null default false,target_price numeric check(target_price>=0),lease_until timestamptz,unique(owner_id,game_id,store,product,region));
create index offers_owner on public.offers(owner_id);
create index offers_game on public.offers(game_id);
create table public.price_history(id uuid primary key default gen_random_uuid(),offer_id uuid not null references public.offers on delete cascade,owner_id uuid not null references auth.users on delete cascade,price numeric not null,currency text not null,discount int not null,created_at timestamptz not null default now());
create index history_offer on public.price_history(offer_id,created_at desc);
create index history_owner on public.price_history(owner_id);
create table public.imports(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,spreadsheet_id text,source jsonb not null,plan jsonb not null,applied_at timestamptz,created_at timestamptz not null default now());
create index imports_owner on public.imports(owner_id);
create table public.push_subscriptions(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,endpoint text not null unique,subscription jsonb not null,created_at timestamptz not null default now());
create index push_owner on public.push_subscriptions(owner_id);
create table public.notifications(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,offer_id uuid references public.offers on delete cascade,event_key text not null unique,title text not null,body text not null,delivered_at timestamptz,read_at timestamptz,created_at timestamptz not null default now());
create index notifications_owner on public.notifications(owner_id,created_at desc);
create table public.refresh_runs(id uuid primary key default gen_random_uuid(),started_at timestamptz not null default now(),finished_at timestamptz,processed int not null default 0,failed int not null default 0);
alter table public.refresh_runs enable row level security;
-- Only the worker service role can inspect jobs.
create table public.shared_entries(id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.playthroughs on delete cascade,owner_id uuid not null references auth.users on delete cascade,recipient_id uuid not null references public.members(id) on delete cascade,unique(entry_id,recipient_id));
create index shared_owner on public.shared_entries(owner_id);
create index shared_recipient on public.shared_entries(recipient_id);
alter table public.shared_entries enable row level security;
create policy shared_read on public.shared_entries for select to authenticated using(private.is_member() and (owner_id=(select auth.uid()) or recipient_id=(select auth.uid())));
create policy shared_insert on public.shared_entries for insert to authenticated with check(private.is_member() and owner_id=(select auth.uid()) and recipient_id<>owner_id and exists(select 1 from public.playthroughs p where p.id=entry_id and p.owner_id=(select auth.uid())));
create policy shared_delete on public.shared_entries for delete to authenticated using(private.is_member() and owner_id=(select auth.uid()));
grant select,insert,delete on public.shared_entries to authenticated;
do $$ declare tab text; begin foreach tab in array array['games','playthroughs','offers','price_history','imports','push_subscriptions','notifications'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('create policy own_read on public.%I for select to authenticated using(private.is_member() and owner_id=(select auth.uid()))',tab);
 if tab not in ('price_history','notifications') then
 execute format('create policy own_insert on public.%I for insert to authenticated with check(private.is_member() and owner_id=(select auth.uid()))',tab);
 execute format('create policy own_update on public.%I for update to authenticated using(private.is_member() and owner_id=(select auth.uid())) with check(private.is_member() and owner_id=(select auth.uid()))',tab);
 execute format('create policy own_delete on public.%I for delete to authenticated using(private.is_member() and owner_id=(select auth.uid()))',tab);
 execute format('grant select,insert,update,delete on public.%I to authenticated',tab);
 else execute format('grant select on public.%I to authenticated',tab);end if;
 end loop;end $$;
-- Child rows must belong to a game owned by the same user, even via direct REST writes.
alter table public.games add constraint games_owner_pair unique(id,owner_id);
alter table public.playthroughs add constraint playthrough_game_owner foreign key(game_id,owner_id) references public.games(id,owner_id) on delete cascade;
alter table public.offers add constraint offers_game_owner foreign key(game_id,owner_id) references public.games(id,owner_id) on delete cascade;
create function public.list_records() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(g.data||p.data||jsonb_build_object('id',p.id,'gameId',g.id,'sourceKey',coalesce(p.source_key,''),'sourceSnapshot',p.source_snapshot,'updated_at',p.updated_at) order by g.data->>'title'),'[]'::jsonb)
 from public.playthroughs p join public.games g on g.id=p.game_id;
$$;
create function public.save_record(input jsonb,record_id uuid default null,expected text default null,snapshot jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
 declare gid uuid;pid uuid;current_stamp timestamptz;meta jsonb;journal jsonb;begin
 if not private.is_member() then raise exception 'No autorizado';end if;
 if coalesce(length(trim(input->>'title')),0)=0 or length(input->>'title')>300 then raise exception 'Título inválido';end if;
 meta=jsonb_build_object('title',input->'title','year',input->'year','platforms',input->'platforms','ownership',input->'ownership','priority',input->'priority','hype',input->'hype','estimated',input->'estimated');
 journal=input-array['id','gameId','title','year','platforms','ownership','priority','hype','estimated','sourceKey','sourceSnapshot','updated_at','offers','links','raw'];
 if record_id is not null then
 select game_id,updated_at into gid,current_stamp from public.playthroughs where id=record_id and owner_id=(select auth.uid()) for update;
 if gid is null then raise exception 'Entrada no encontrada';end if;
 if expected is null or current_stamp<>expected::timestamptz then raise exception 'CONFLICT: la entrada cambió en otro dispositivo';end if;
 update public.games set data=meta where id=gid;
 update public.playthroughs set data=journal,source_snapshot=coalesce(snapshot,source_snapshot),updated_at=clock_timestamp() where id=record_id returning id into pid;
 else
 if input->>'gameId' is not null then select id into gid from public.games where id=(input->>'gameId')::uuid and owner_id=(select auth.uid());if gid is null then raise exception 'Juego no encontrado';end if;
 else insert into public.games(owner_id,data)values((select auth.uid()),meta)returning id into gid;end if;
 insert into public.playthroughs(game_id,owner_id,data,source_key,source_snapshot)values(gid,(select auth.uid()),journal,nullif(input->>'sourceKey',''),coalesce(snapshot,'{}')) returning id into pid;
 end if;
 return jsonb_build_object('id',pid,'gameId',gid);end $$;
create function public.apply_import(batch_id uuid,resolutions jsonb default '{}') returns int language plpgsql security invoker set search_path='' as $$
 declare b public.imports;item jsonb;combined jsonb;current_data jsonb;f text;choice text;total int=0;begin
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
 perform public.save_record(combined,(item->>'id')::uuid,item->>'expectedUpdatedAt',item->'incoming');
 total=total+1;end if;
 end loop;
 update public.imports set applied_at=now() where id=batch_id;
 return total;end $$;
-- Narrow sharing projection: deliberately excludes notes, reason, ownership and source snapshots.
create function public.read_shared() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('shareId',s.id,'owner',m.display_name,'title',g.data->'title','period',p.data->'period','device',p.data->'device','status',p.data->'status','hours',p.data->'hours','rating',p.data->'rating','memorability',p.data->'memorability','impression',p.data->'impression','focus',p.data->'focus','replay',p.data->'replay')),'[]')
 from public.shared_entries s join public.playthroughs p on p.id=s.entry_id and p.owner_id=s.owner_id join public.games g on g.id=p.game_id join public.members m on m.id=s.owner_id and m.active
 where s.recipient_id=(select auth.uid()) and private.is_member();
$$;
-- This deliberate SECURITY DEFINER only returns an explicit safe projection gated by a live grant.
revoke all on function public.read_shared() from public,anon;
grant execute on function public.read_shared() to authenticated;
revoke all on function public.list_records(),public.save_record(jsonb,uuid,text,jsonb),public.apply_import(uuid,jsonb) from public,anon;
grant execute on function public.list_records(),public.save_record(jsonb,uuid,text,jsonb),public.apply_import(uuid,jsonb) to authenticated;
alter table public.playthroughs replica identity full;
alter publication supabase_realtime add table public.playthroughs,public.offers,public.shared_entries;
