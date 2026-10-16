create function public.bootstrap_member(token text,user_id uuid,email text) returns boolean language plpgsql security definer set search_path='' as $$
 begin
 lock table public.members in exclusive mode;
 if exists(select 1 from public.members where role='admin') then raise exception 'Administrador ya configurado';end if;
 if not exists(select 1 from vault.decrypted_secrets where name='game_journal_setup' and decrypted_secret=token) then raise exception 'Token inválido';end if;
 insert into public.members(id,display_name,role)values(user_id,email,'admin');

 return true;end $$;
revoke all on function public.bootstrap_member(text,uuid,text) from public,anon,authenticated;
grant execute on function public.bootstrap_member(text,uuid,text) to service_role;
