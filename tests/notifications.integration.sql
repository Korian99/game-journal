
-- Disposable data, no network or push messages; always rollback.
begin;
insert into auth.users(id,email) values('99999999-9999-4999-8999-999999999991','notify-one@example.invalid'),('99999999-9999-4999-8999-999999999992','notify-two@example.invalid');
insert into public.members(id,display_name) values('99999999-9999-4999-8999-999999999991','Notify one'),('99999999-9999-4999-8999-999999999992','Notify two');
do $tests$
declare gid uuid; oid uuid; other uuid; n integer; q jsonb; delivery jsonb; first_device uuid; second_device uuid;
begin
 insert into public.games(owner_id,data) values('99999999-9999-4999-8999-999999999991','{"title":"Notification fixture"}') returning id into gid;
 insert into public.playthroughs(owner_id,game_id,data) values('99999999-9999-4999-8999-999999999991',gid,'{"status":"wishlist"}');
 insert into public.offers(owner_id,game_id,url,store,product,region,target_price,target_currency)
 values('99999999-9999-4999-8999-999999999991',gid,'https://store.steampowered.com/app/620/','steam','620','AR',10,'USD') returning id into oid;
 -- First quote is baseline, not an alert even if discounted.
 perform public.record_quote(oid,'{"price":20,"regular":40,"currency":"USD","discount":50,"status":"available"}',null);
 if exists(select 1 from public.notifications where offer_id=oid) then raise exception 'First quote spam';end if;
 perform public.record_quote(oid,'{"price":15,"regular":40,"currency":"USD","discount":63,"status":"available"}',(select checked_at::text from public.offers where id=oid));
 if (select count(*) from public.notifications where offer_id=oid and kind='discount')<>1 then raise exception 'New discount above target missing';end if;
 perform public.record_quote(oid,'{"price":9,"regular":40,"currency":"USD","discount":78,"status":"available"}',(select checked_at::text from public.offers where id=oid));
 if (select count(*) from public.notifications where offer_id=oid)<>2 or not exists(select 1 from public.notifications where offer_id=oid and kind='target') then raise exception 'Threshold should produce ONE target event';end if;
 perform public.record_quote(oid,'{"price":9,"regular":40,"currency":"USD","discount":78,"status":"available"}',(select checked_at::text from public.offers where id=oid));
 if (select count(*) from public.notifications where offer_id=oid)<>2 then raise exception 'Repeated quote spam';end if;
 -- Disable all discount alerts.
 update public.notification_preferences set discounts=false,targets=false where owner_id='99999999-9999-4999-8999-999999999991';
 perform public.record_quote(oid,'{"price":8,"regular":40,"currency":"USD","discount":80,"status":"available"}',(select checked_at::text from public.offers where id=oid));
 if (select count(*) from public.notifications where offer_id=oid)<>2 then raise exception 'Disabled discount alerts ignored';end if;
 update public.notification_preferences set discounts=true,targets=true where owner_id='99999999-9999-4999-8999-999999999991';
 -- Release events work without a store link, are idempotent, and never move the game.
 update public.playthroughs set data='{"status":"upcoming"}' where game_id=gid;
 perform public.enqueue_due_releases(array[gid,gid]);
 if (select count(*) from public.notifications where game_id=gid and kind='release')<>1 then raise exception 'Release deduplication failed';end if;
 if (select data->>'status' from public.playthroughs where game_id=gid)<>'upcoming' then raise exception 'Release moved game';end if;
 -- Devices existed before these test events; no real push endpoints are contacted.
 insert into public.push_subscriptions(owner_id,endpoint,subscription,created_at) values
 ('99999999-9999-4999-8999-999999999991','https://fcm.googleapis.com/notify-fixture-one','{"endpoint":"https://fcm.googleapis.com/notify-fixture-one"}',now()-interval '1 hour') returning id into first_device;
 insert into public.push_subscriptions(owner_id,endpoint,subscription,created_at) values
 ('99999999-9999-4999-8999-999999999991','https://fcm.googleapis.com/notify-fixture-two','{"endpoint":"https://fcm.googleapis.com/notify-fixture-two"}',now()-interval '1 hour') returning id into second_device;
 perform set_config('test.notify_device',first_device::text,true);
 q:=public.claim_notification_deliveries('99999999-9999-4999-8999-999999999991');
 if jsonb_array_length(q)<>6 then raise exception 'Expected 3 events * 2 devices, got %',jsonb_array_length(q);end if;
 if jsonb_array_length(public.claim_notification_deliveries('99999999-9999-4999-8999-999999999991'))<>0 then raise exception 'Concurrent worker duplicated claims';end if;
 for delivery in select * from jsonb_array_elements(q) loop
  perform public.finish_notification_delivery((delivery->>'event_id')::uuid,(delivery->>'subscription_id')::uuid,(delivery->>'lease_token')::uuid,
   case when (delivery->>'subscription_id')::uuid=first_device then 'sent' else 'retry' end);
 end loop;
 update public.notification_deliveries set next_attempt_at=now() where owner_id='99999999-9999-4999-8999-999999999991';
 q:=public.claim_notification_deliveries('99999999-9999-4999-8999-999999999991');
 if jsonb_array_length(q)<>3 then raise exception 'Successful devices were re-sent';end if;
 for delivery in select * from jsonb_array_elements(q) loop
  if public.finish_notification_delivery((delivery->>'event_id')::uuid,(delivery->>'subscription_id')::uuid,gen_random_uuid(),'sent') then raise exception 'Stale lease accepted';end if;
  perform public.finish_notification_delivery((delivery->>'event_id')::uuid,(delivery->>'subscription_id')::uuid,(delivery->>'lease_token')::uuid,'sent');
 end loop;
 if exists(select 1 from public.notifications where game_id=gid and delivered_at is null) then raise exception 'Delivered events not recorded';end if;

 -- Strictly below Objetivo, not equal; muted pages and completed games never alert.
 select count(*) into n from public.notifications where game_id=gid;
 update public.notification_preferences set discounts=false,targets=true where owner_id='99999999-9999-4999-8999-999999999991';
 update public.offers set target_price=4 where id=oid;
 perform public.record_quote(oid,'{"price":4,"regular":40,"currency":"USD","discount":90,"status":"available"}',(select checked_at::text from public.offers where id=oid));
 if(select count(*) from public.notifications where game_id=gid)<>n then raise exception 'Equal to threshold is not below it';end if;
 perform public.record_quote(oid,'{"price":3,"regular":40,"currency":"USD","discount":93,"status":"available"}',(select checked_at::text from public.offers where id=oid));
 if(select count(*) from public.notifications where game_id=gid)<>n+1 then raise exception 'Strictly below threshold missing';end if;
 update public.offers set watched=false where id=oid;
 perform public.record_quote(oid,'{"price":2,"regular":40,"currency":"USD","discount":95,"status":"available"}',(select checked_at::text from public.offers where id=oid));
 update public.offers set watched=true where id=oid;
 update public.playthroughs set data='{"status":"completed"}' where game_id=gid;
 perform public.record_quote(oid,'{"price":1,"regular":40,"currency":"USD","discount":98,"status":"available"}',(select checked_at::text from public.offers where id=oid));
 if(select count(*) from public.notifications where game_id=gid)<>n+1 then raise exception 'Muted/completed game alert';end if;
end $tests$;
set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999992',true);
do $isolation$ begin
 if (select count(*) from public.notifications)<>0 or (select count(*) from public.notification_preferences)<>1 then raise exception 'Owner isolation failed';end if;
 begin perform public.request_test_notification('https://fcm.googleapis.com/notify-fixture-one');raise exception 'Other owner test sent';
 exception when others then if sqlerrm='Other owner test sent' then raise;end if;end;
 if has_function_privilege('authenticated','public.claim_notification_deliveries(uuid)','execute') or
 has_function_privilege('anon','public.enqueue_due_releases(uuid[])','execute') or
 has_table_privilege('authenticated','public.notification_deliveries','select') or
 has_column_privilege('authenticated','public.notifications','title','update') then raise exception 'Unsafe notification grants';end if;
end $isolation$;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999991',true);
select public.request_test_notification('https://fcm.googleapis.com/notify-fixture-one');
reset role;
do $test_device$ begin
 if(select count(*) from public.notification_deliveries d join public.notifications n on n.id=d.event_id where n.kind='test' and n.owner_id='99999999-9999-4999-8999-999999999991')<>1 then raise exception 'Test should target only requesting device';end if;
end $test_device$;
select 'PASS: discount/target baseline and deduplication, preferences, releases, per-device retries, leases and owner isolation' as result;
rollback;
