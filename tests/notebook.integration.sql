-- Synthetic accounts in an isolated disposable database only.
begin;
do $$begin
  if to_regclass('public.notebooks') is null then raise exception 'Notebook storage missing'; end if;
end $$;
insert into auth.users(id,email) values
 ('87878787-1111-4111-8111-111111111111','notebook-one@example.invalid'),
 ('87878787-2222-4222-8222-222222222222','notebook-two@example.invalid'),
 ('87878787-3333-4333-8333-333333333333','notebook-inactive@example.invalid');
insert into public.members(id,display_name,active) values
 ('87878787-1111-4111-8111-111111111111','Notebook one',true),
 ('87878787-2222-4222-8222-222222222222','Notebook two',true),
 ('87878787-3333-4333-8333-333333333333','Notebook inactive',false);
set local role authenticated;
select set_config('request.jwt.claim.sub','87878787-1111-4111-8111-111111111111',true);
insert into public.notebooks(owner_id,content) values
 (auth.uid(),E'  First line\n<b>Not HTML</b> 🙂\t ');
do $$declare saved text;begin
  select content into saved from public.notebooks;
  if saved is distinct from E'  First line\n<b>Not HTML</b> 🙂\t ' then raise exception 'Plain text changed'; end if;
  insert into public.notebooks(owner_id,content) values(auth.uid(),'Updated')
    on conflict(owner_id) do update set content=excluded.content returning content into saved;
  if saved is distinct from 'Updated' then raise exception 'Save failed'; end if;
  update public.notebooks set content='' where owner_id=auth.uid() returning content into saved;
  if saved is distinct from '' then raise exception 'Clear failed'; end if;
  update public.notebooks set content='Private note' where owner_id=auth.uid();
  begin
    update public.notebooks set content=repeat('x',100001) where owner_id=auth.uid();
    raise exception 'Oversized text accepted';
  exception when check_violation then null; end;
  begin
    insert into public.notebooks(owner_id,content) values('87878787-2222-4222-8222-222222222222','Not mine');
    raise exception 'Cross-owner insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.notebooks set owner_id='87878787-2222-4222-8222-222222222222';
    raise exception 'Owner reassignment accepted';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.notebooks;
    raise exception 'Delete privilege exposed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','87878787-2222-4222-8222-222222222222',true);
do $$declare affected integer;begin
  if exists(select 1 from public.notebooks) then raise exception 'Cross-owner read'; end if;
  update public.notebooks set content='Not mine';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Cross-owner write'; end if;
end $$;
select set_config('request.jwt.claim.sub','87878787-3333-4333-8333-333333333333',true);
do $$begin
  if exists(select 1 from public.notebooks) then raise exception 'Inactive read'; end if;
  begin
    insert into public.notebooks(owner_id,content) values(auth.uid(),'Inactive');
    raise exception 'Inactive write';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$begin
  begin
    perform content from public.notebooks;
    raise exception 'Anonymous read';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$begin
  if (select content from public.notebooks where owner_id='87878787-1111-4111-8111-111111111111') is distinct from 'Private note' then raise exception 'Rejected write changed note'; end if;
  if not (select relrowsecurity from pg_class where oid='public.notebooks'::regclass) then raise exception 'RLS disabled'; end if;
end $$;
rollback;
