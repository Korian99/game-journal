-- Disposable local fixture. Never execute against a personal account.
begin;
insert into auth.users(id,email) values ('88888888-8888-4888-8888-888888888881','trash-one@example.invalid'),('88888888-8888-4888-8888-888888888882','trash-two@example.invalid');
insert into public.members(id,display_name) values ('88888888-8888-4888-8888-888888888881','Trash one'),('88888888-8888-4888-8888-888888888882','Trash two');
insert into public.games(id,owner_id,data) values('88888888-8888-4888-8888-888888888883','88888888-8888-4888-8888-888888888881','{"title":"Recoverable game"}');
insert into public.playthroughs(id,owner_id,game_id,data,source_key) values('88888888-8888-4888-8888-888888888884','88888888-8888-4888-8888-888888888881','88888888-8888-4888-8888-888888888883','{"status":"wishlist","notes":"Private recovery note"}','trash-fixture');
insert into public.shared_entries(entry_id,owner_id,recipient_id) values('88888888-8888-4888-8888-888888888884','88888888-8888-4888-8888-888888888881','88888888-8888-4888-8888-888888888882');
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888881',true);
select public.trash_record('88888888-8888-4888-8888-888888888884',null);
do $$ begin
 if jsonb_array_length(public.list_records())<>0 then raise exception 'Trash leaked into active library';end if;
 if jsonb_array_length(public.list_trash())<>1 then raise exception 'Trash is not recoverable';end if;
 if exists(select 1 from public.shared_entries where entry_id='88888888-8888-4888-8888-888888888884') then raise exception 'Trash still shared';end if;
end $$;
select public.restore_record('88888888-8888-4888-8888-888888888884',null);
do $$ begin
 if public.list_records()->0->>'notes'<>'Private recovery note' then raise exception 'Restore lost review';end if;
 if exists(select 1 from public.shared_entries where entry_id='88888888-8888-4888-8888-888888888884') then raise exception 'Restore reenabled sharing';end if;
end $$;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888882',true);
do $$ begin
 if jsonb_array_length(public.list_trash())<>0 then raise exception 'Other owner trash leaked';end if;
 begin perform public.trash_record('88888888-8888-4888-8888-888888888884',null);raise exception 'Other owner could delete';exception when raise_exception then if sqlerrm='Other owner could delete' then raise;end if;end;
end $$;
reset role;
update public.playthroughs set deleted_at=clock_timestamp()-interval '31 days' where id='88888888-8888-4888-8888-888888888884';
select private.purge_expired_trash();
do $$ begin
 if exists(select 1 from public.playthroughs where id='88888888-8888-4888-8888-888888888884') then raise exception 'Expired trash not purged';end if;
 if not exists(select 1 from public.games where id='88888888-8888-4888-8888-888888888883') then raise exception 'Purge removed shared game metadata';end if;
end $$;
rollback;
