begin;
insert into auth.users(id,email) values
 ('01000000-0000-4000-8000-000000000001','appearance-one@example.test'),
 ('01000000-0000-4000-8000-000000000002','appearance-two@example.test');
insert into public.members(id,display_name)
select id,email from auth.users where email like 'appearance-%@example.test';
insert into public.games(id,owner_id,data) values
 ('02000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001','{"title":"One"}'),
 ('02000000-0000-4000-8000-000000000002','01000000-0000-4000-8000-000000000002','{"title":"Two"}');
insert into public.playthroughs(id,game_id,owner_id) values
 ('03000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001'),
 ('03000000-0000-4000-8000-000000000002','02000000-0000-4000-8000-000000000002','01000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','01000000-0000-4000-8000-000000000001',true);
do $$
declare
 own_game jsonb := '{"entryId":"03000000-0000-4000-8000-000000000001","color":"#aabbcc"}';
 other_game jsonb := '{"entryId":"03000000-0000-4000-8000-000000000002","color":"#ffffff"}';
begin
 begin
   insert into public.member_appearance(member_id) values ('01000000-0000-4000-8000-000000000001');
   raise exception 'Direct appearance insert was accepted';
 exception when insufficient_privilege then null;
 end;
 perform public.save_member_appearance(jsonb_build_object('mode','light','game',own_game), true);
 perform public.save_member_appearance('{"mode":"dark","game":null}', true);
 if (select mode from public.member_appearance) <> 'light' then raise exception 'Initialization overwrote preference'; end if;
 begin
   update public.member_appearance set mode='dark';
   raise exception 'Direct appearance update was accepted';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.save_member_appearance(jsonb_build_object('game',other_game));
   raise exception 'Cross-owner selection was accepted';
 exception when no_data_found then null;
 end;
 perform public.save_member_appearance('{"mode":"dark"}');
 if not exists(select 1 from public.member_appearance where mode='dark' and accent='#aabbcc') then raise exception 'Partial update lost game'; end if;
 perform public.save_member_appearance('{"game":null}');
 perform public.save_member_appearance(jsonb_build_object('game',own_game), false, own_game);
 if (select playthrough_id from public.member_appearance) is not null then raise exception 'Late sample revived game'; end if;
 perform public.save_member_appearance(jsonb_build_object('game',own_game));
 perform public.trash_record('03000000-0000-4000-8000-000000000001');
 if exists(select 1 from public.member_appearance where playthrough_id is not null or accent is not null) then raise exception 'Trash retained appearance game'; end if;
 perform public.restore_record('03000000-0000-4000-8000-000000000001');
 perform public.save_member_appearance(jsonb_build_object('game',own_game));
end $$;
select set_config('request.jwt.claim.sub','01000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.member_appearance) then raise exception 'Cross-owner read succeeded'; end if;
end $$;
reset role;
delete from public.playthroughs where id='03000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.playthroughs where id='03000000-0000-4000-8000-000000000001') then raise exception 'Hard deletion was suppressed'; end if;
 if not exists(select 1 from public.member_appearance where member_id='01000000-0000-4000-8000-000000000001' and playthrough_id is null and accent is null) then raise exception 'Deletion retained appearance game'; end if;
end $$;
rollback;
