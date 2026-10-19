-- Allow the full batch of bounded push requests to complete within the two-minute lease.
-- Independent dispatcher: no Steam/Nintendo requests. Uses the existing Vault cron secret.
select cron.schedule('game-journal-notifications','*/5 * * * *',$job$
 select net.http_post(
  url:='https://pgosoyxbuxfrkfjvmflm.supabase.co/functions/v1/notification-worker',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='game_journal_cron')),
  body:='{}'::jsonb,timeout_milliseconds:=120000);
$job$);
