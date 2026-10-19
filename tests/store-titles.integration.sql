-- Run after applying sync_titles_from_store_quotes to a disposable/test database.
begin;
insert into auth.users(id,email) values
 ('77777777-7777-4777-8777-777777777777','store-title-one@example.invalid'),
 ('88888888-8888-4888-8888-888888888888','store-title-two@example.invalid');
do $fixtures$
declare gid uuid; nid uuid; other_id uuid; oid uuid; pid uuid;
begin
 insert into public.games(owner_id,data) values('77777777-7777-4777-8777-777777777777','{"title":"Old manual title","year":2020,"priority":3}') returning id into gid;
 insert into public.games(owner_id,data) values('77777777-7777-4777-8777-777777777777','{"title":"Old Nintendo title"}') returning id into nid;
 insert into public.games(owner_id,data) values('88888888-8888-4888-8888-888888888888','{"title":"Other owner title"}') returning id into other_id;
 perform set_config('test.title_game',gid::text,true);
 perform set_config('test.title_nintendo_game',nid::text,true);
 perform set_config('test.title_other_game',other_id::text,true);
 insert into public.playthroughs(owner_id,game_id,data,source_key) values('77777777-7777-4777-8777-777777777777',gid,'{"notes":"PRIVATE_NOTES","rating":90,"started":"2026-01-01","status":"playing"}','title-test-one') returning id into pid;
 perform set_config('test.title_play_id',pid::text,true);
 perform set_config('test.title_old_stamp',(select updated_at::text from public.playthroughs where id=pid),true);
 insert into public.playthroughs(owner_id,game_id,data,source_key) values('77777777-7777-4777-8777-777777777777',gid,'{"notes":"SIBLING_NOTES"}','title-test-two');
 insert into public.offers(owner_id,game_id,url,store,product,region) values('77777777-7777-4777-8777-777777777777',gid,'https://store.steampowered.com/app/620/','steam','620','AR') returning id into oid;
 perform set_config('test.title_offer',oid::text,true);
 insert into public.offers(owner_id,game_id,url,store,product,region) values('77777777-7777-4777-8777-777777777777',gid,'https://store.steampowered.com/app/620/?cc=US','steam','620','US') returning id into oid;
 perform set_config('test.title_us_offer',oid::text,true);
 insert into public.offers(owner_id,game_id,url,store,product,region) values('77777777-7777-4777-8777-777777777777',gid,'https://www.nintendo.com/es-ar/store/products/title-test-switch/','nintendo','title-test-switch','AR') returning id into oid;
 perform set_config('test.title_secondary_offer',oid::text,true);
 insert into public.offers(owner_id,game_id,url,store,product,region) values('77777777-7777-4777-8777-777777777777',nid,'https://www.nintendo.com/es-ar/store/products/title-test-only-switch/','nintendo','title-test-only-switch','AR') returning id into oid;
 perform set_config('test.title_nintendo_offer',oid::text,true);
end $fixtures$;

-- Valid names still overwrite when the store has no current price.
select public.record_quote(current_setting('test.title_offer')::uuid,'{"name":"  Steam \n Title  ","price":null,"currency":null,"status":"unavailable"}',null);
do $assert$ begin
 if (select data->>'title' from public.games where id=current_setting('test.title_game')::uuid) <> 'Steam Title' then raise exception 'Store title was not saved'; end if;
 if (select data-'title' from public.games where id=current_setting('test.title_game')::uuid) <> '{"year":2020,"priority":3}'::jsonb then raise exception 'Other metadata changed'; end if;
 if (select data from public.playthroughs where id=current_setting('test.title_play_id')::uuid) <> '{"notes":"PRIVATE_NOTES","rating":90,"started":"2026-01-01","status":"playing"}'::jsonb then raise exception 'Journal content changed'; end if;
 if exists(select 1 from public.playthroughs where game_id=current_setting('test.title_game')::uuid and updated_at<=current_setting('test.title_old_stamp')::timestamptz) then raise exception 'Sibling revisions not advanced'; end if;
 perform set_config('test.title_synced_stamp',(select updated_at::text from public.playthroughs where id=current_setting('test.title_play_id')::uuid),true);
end $assert$;

-- Blank, invalid, excessive, and identical names do not change the title/revision.
select public.record_quote(current_setting('test.title_offer')::uuid,'{"name":" \t ","price":20,"regular":20,"currency":"USD","status":"available"}',(select checked_at::text from public.offers where id=current_setting('test.title_offer')::uuid));
select public.record_quote(current_setting('test.title_offer')::uuid,'{"name":{"invalid":"object"},"price":20,"regular":20,"currency":"USD","status":"available"}',(select checked_at::text from public.offers where id=current_setting('test.title_offer')::uuid));
select public.record_quote(current_setting('test.title_offer')::uuid,jsonb_build_object('name',repeat('a',301),'price',20,'regular',20,'currency','USD','status','available'),(select checked_at::text from public.offers where id=current_setting('test.title_offer')::uuid));
select public.record_quote(current_setting('test.title_offer')::uuid,'{"name":"Steam Title","price":20,"regular":20,"currency":"USD","status":"available"}',(select checked_at::text from public.offers where id=current_setting('test.title_offer')::uuid));

-- Stale results cannot rename games or overwrite a newer price.
select public.record_quote(current_setting('test.title_offer')::uuid,'{"name":"Stale title","price":1,"regular":1,"currency":"USD","status":"available"}',null);
-- Another store or Steam region does not make titles alternate between refreshes.
select public.record_quote(current_setting('test.title_secondary_offer')::uuid,'{"name":"Alternate Nintendo title","price":30,"regular":30,"currency":"USD","status":"available"}',null);
select public.record_quote(current_setting('test.title_us_offer')::uuid,'{"name":"Alternate US title","price":30,"regular":30,"currency":"USD","status":"available"}',null);
select public.record_quote(current_setting('test.title_nintendo_offer')::uuid,'{"name":"Nintendo Title","price":40,"regular":40,"currency":"USD","status":"available"}',null);
do $assert$ begin
 if (select data->>'title' from public.games where id=current_setting('test.title_game')::uuid) <> 'Steam Title' then raise exception 'Invalid/stale/alternate title accepted'; end if;
 if (select updated_at::text from public.playthroughs where id=current_setting('test.title_play_id')::uuid) <> current_setting('test.title_synced_stamp') then raise exception 'Unchanged title advanced a revision'; end if;
 if (select price from public.offers where id=current_setting('test.title_offer')::uuid) <> 20 then raise exception 'Stale quote changed the price'; end if;
 if (select data->>'title' from public.games where id=current_setting('test.title_nintendo_game')::uuid) <> 'Nintendo Title' then raise exception 'Nintendo-only title was not saved'; end if;
 if (select data->>'title' from public.games where id=current_setting('test.title_other_game')::uuid) <> 'Other owner title' then raise exception 'Other owner changed'; end if;
 if has_function_privilege('anon','public.record_quote(uuid,jsonb,text)','execute') or has_function_privilege('authenticated','public.record_quote(uuid,jsonb,text)','execute') then raise exception 'Untrusted role can submit store quotes'; end if;
end $assert$;
select 'PASS: store titles, missing prices, metadata preservation, stale quotes, store preference, revisions, and role restrictions' as result;
rollback;
