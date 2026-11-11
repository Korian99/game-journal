-- Run after the current price-worker migrations on a disposable database.
begin;
insert into auth.users(id,email) values
 ('66666666-6666-4666-8666-666666666661','store-release@example.invalid');
insert into public.members(id,display_name) values
 ('66666666-6666-4666-8666-666666666661','Store release fixture');
do $fixtures$
declare upcoming_game uuid; available_game uuid; wishlist_game uuid; playing_game uuid; trash_game uuid; invalid_game uuid;
        offer_id uuid; trash_id uuid;
begin
 insert into public.games(owner_id,data) values
 ('66666666-6666-4666-8666-666666666661','{"title":"Upcoming old date","release":"2020-01-01","year":2020}') returning id into upcoming_game;
 insert into public.games(owner_id,data) values
 ('66666666-6666-4666-8666-666666666661','{"title":"Available quote date","release":"2020-01-01","year":2020}') returning id into available_game;
 insert into public.games(owner_id,data) values
 ('66666666-6666-4666-8666-666666666661','{"title":"Wishlist stays","release":"2020-01-01","year":2020}') returning id into wishlist_game;
 insert into public.games(owner_id,data) values
 ('66666666-6666-4666-8666-666666666661','{"title":"Playing stays","release":"2020-01-01","year":2020}') returning id into playing_game;
 insert into public.games(owner_id,data) values
 ('66666666-6666-4666-8666-666666666661','{"title":"Trashed stays","release":"2020-01-01","year":2020}') returning id into trash_game;
 insert into public.games(owner_id,data) values
 ('66666666-6666-4666-8666-666666666661','{"title":"Invalid stays","release":"2020-01-01","year":2020}') returning id into invalid_game;
 insert into public.playthroughs(owner_id,game_id,data) values
 ('66666666-6666-4666-8666-666666666661',upcoming_game,'{"status":"upcoming"}'),
 ('66666666-6666-4666-8666-666666666661',available_game,'{"status":"upcoming"}'),
 ('66666666-6666-4666-8666-666666666661',wishlist_game,'{"status":"wishlist"}'),
 ('66666666-6666-4666-8666-666666666661',playing_game,'{"status":"playing"}');
 insert into public.playthroughs(owner_id,game_id,data,deleted_at) values
 ('66666666-6666-4666-8666-666666666661',trash_game,'{"status":"upcoming"}',now()) returning id into trash_id;
 insert into public.playthroughs(owner_id,game_id,data) values
 ('66666666-6666-4666-8666-666666666661',trash_game,'{"status":"wishlist"}');
 insert into public.offers(owner_id,game_id,url,store,product,region) values
 ('66666666-6666-4666-8666-666666666661',upcoming_game,'https://store.steampowered.com/app/10001/','steam','10001','AR') returning id into offer_id;
 perform public.record_quote(offer_id,'{"releaseDate":"2027-01-15","price":null,"currency":null,"status":"upcoming"}',null);
 if (select data->>'release' from public.games where id=upcoming_game) is distinct from '2027-01-15' or
    (select data->>'year' from public.games where id=upcoming_game) is distinct from '2027' then
   raise exception 'Upcoming date was not corrected without a price';
 end if;
 perform public.record_quote(offer_id,'{"releaseDate":"2028-02-01","price":null,"currency":null,"status":"upcoming"}',null);
 if (select data->>'release' from public.games where id=upcoming_game) is distinct from '2027-01-15' then raise exception 'Stale release quote overwrote the date'; end if;
 update public.playthroughs set data=jsonb_set(data,'{status}','"playing"') where game_id=upcoming_game and deleted_at is null;
 perform public.record_quote(offer_id,'{"releaseDate":"2029-02-01","price":null,"currency":null,"status":"upcoming"}',(select checked_at::text from public.offers where id=offer_id));
 if (select data->>'release' from public.games where id=upcoming_game) is distinct from '2027-01-15' then raise exception 'Release changed after leaving Próximos'; end if;
 insert into public.offers(owner_id,game_id,url,store,product,region) values
 ('66666666-6666-4666-8666-666666666661',available_game,'https://store.steampowered.com/app/10006/','steam','10006','AR') returning id into offer_id;
 perform public.record_quote(offer_id,'{"releaseDate":"2027-01-15","price":1,"regular":1,"currency":"USD","status":"available"}',null);
 if (select data->>'release' from public.games where id=available_game) is distinct from '2027-01-15' then raise exception 'Available quote release was gated by status'; end if;
 insert into public.offers(owner_id,game_id,url,store,product,region) values
 ('66666666-6666-4666-8666-666666666661',wishlist_game,'https://store.steampowered.com/app/10002/','steam','10002','AR') returning id into offer_id;
 perform public.record_quote(offer_id,'{"releaseDate":"2027-01-15","price":null,"currency":null,"status":"upcoming"}',null);
 if (select data->>'release' from public.games where id=wishlist_game) is distinct from '2020-01-01' then raise exception 'Wishlist release changed'; end if;
 insert into public.offers(owner_id,game_id,url,store,product,region) values
 ('66666666-6666-4666-8666-666666666661',playing_game,'https://store.steampowered.com/app/10003/','steam','10003','AR') returning id into offer_id;
 perform public.record_quote(offer_id,'{"releaseDate":"2027-01-15","price":null,"currency":null,"status":"upcoming"}',null);
 if (select data->>'release' from public.games where id=playing_game) is distinct from '2020-01-01' then raise exception 'Non-upcoming release changed'; end if;
 insert into public.offers(owner_id,game_id,url,store,product,region) values
 ('66666666-6666-4666-8666-666666666661',trash_game,'https://store.steampowered.com/app/10004/','steam','10004','AR') returning id into offer_id;
 perform public.record_quote(offer_id,'{"releaseDate":"2027-01-15","price":null,"currency":null,"status":"upcoming"}',null);
 if (select data->>'release' from public.games where id=trash_game) is distinct from '2020-01-01' then raise exception 'Trashed upcoming release changed'; end if;
 insert into public.playthroughs(owner_id,game_id,data) values
 ('66666666-6666-4666-8666-666666666661',invalid_game,'{"status":"upcoming"}');
 insert into public.offers(owner_id,game_id,url,store,product,region) values
 ('66666666-6666-4666-8666-666666666661',invalid_game,'https://store.steampowered.com/app/10005/','steam','10005','AR') returning id into offer_id;
 perform public.record_quote(offer_id,'{"releaseDate":"2026-02-30","price":null,"currency":null,"status":"upcoming"}',null);
 if (select data->>'release' from public.games where id=invalid_game) is distinct from '2020-01-01' then raise exception 'Invalid date overwrote release'; end if;
end $fixtures$;
select 'PASS: only valid release dates update active upcoming games, including quotes without prices' as result;
rollback;
