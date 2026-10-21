# Reliability, trash and Drive backup operations

These changes are local and uncommitted. Nothing in this document grants permission to deploy, execute production SQL, or restore over personal data. The spreadsheet connection remains read-only.

## Database rollout

Review both complete migration files in supabase/migrations before requesting approval to execute them:

- 20261021114538_recoverable_playthrough_trash.sql adds deletion metadata, owner-scoped trash functions, sharing revocation, import/worker guards, snapshot format 4 and transactional canonical save responses.
- 20261021115532_external_drive_backups.sql adds public owner-readable run metadata, private connection/job/OAuth state and Vault-backed credentials. Browser clients cannot read tokens or worker jobs. Every exposed function/table has explicit grants; exposed tables use RLS.

The normal records RPC excludes trash. A delete revokes sharing and moves only that playthrough into trash. Restore never recreates shares. A private Cron job purges entries older than 30 days at 03:05 Argentina, preserving game metadata and store history. Hard deletion is no longer granted directly to browser clients.

The server uses save_record_result to save and return the canonical record/revision in the same transaction. Older save_record and save_record_with_pages calls remain available.

## Google setup

Use a separate Google Cloud web OAuth client for backups. Enable the Drive API. Configure the exact redirect URI:

https://YOUR_APP_ORIGIN/api/backups/drive/callback

Use a separate localhost redirect when testing locally. Store the following values only in the server deployment environment:

- SUPABASE_SERVICE_ROLE_KEY
- GOOGLE_BACKUP_CLIENT_ID
- GOOGLE_BACKUP_CLIENT_SECRET
- BACKUP_WORKER_SECRET (a dedicated random secret)
- NEXT_PUBLIC_APP_URL (the canonical origin, without a trailing slash)

Do not put privileged values in NEXT_PUBLIC_ variables. Do not reuse the temporary Picker access token. Backup OAuth requests only drive.file, uses single-use state and PKCE, and needs consent once to obtain a refresh token. Refresh tokens live encrypted in Supabase Vault, referenced by private connection rows. A reconnect invalidates the previous recovery verification.

In Configuración, connect Google Drive. The app creates its private Game Journal Backups folder with ownership tags. It refuses unrelated files/folders or a shared folder. No spreadsheet is modified.

Google's web OAuth instructions: https://developers.google.com/identity/protocols/oauth2/web-server

## Daily schedule

The existing internal snapshot remains at 03:00 Argentina / 06:00 UTC. The new Cron schedule runs at minute 15 every hour, starting the external copy at 03:15 after the daily snapshot. Each connected active account gets its own protected Node worker invocation.

During deployment setup, privately provision these Vault entries after approval:

- game_journal_app_origin: the canonical HTTPS application origin.
- game_journal_backup_worker: the same value as server BACKUP_WORKER_SECRET.

No values should appear in migration files, logs, screenshots or chat. Until these entries and OAuth are configured, the schedule performs no HTTP work.

A run copies one successful internal snapshot, with its original identity. JSON and Excel are produced from that same snapshot, not from separate live queries. Its manifest records format, owner, capture time, byte sizes and SHA-256 hashes. All uploaded files are downloaded and verified before success is recorded. Retries reuse persisted Drive file IDs. Interrupted leases expire; failed attempts retry hourly. Missing source snapshots are marked expired.

After a verified upload, retain the latest 30 daily bundles and the first successful available bundle for each of the latest 12 months. Pruning only deletes app-owned files with matching account/run/folder tags. A failed upload never triggers pruning. Credentials, Auth sessions, push subscription secrets and worker queues are excluded from backups.

Internal and external statuses are separate. Configuración offers reconnect, retry, JSON/Excel download and a link to the private folder. The app warns about failed attempts, revoked authorization and external copies older than 48 hours.

## Recovery

Download JSON and Excel plus the manifest from the backup folder. Keep all three together.

npm run backup:restore -- --json PATH --excel PATH --manifest PATH --owner TARGET_OWNER_UUID

This validates checksums, ownership and relationships and prints a dry-run summary. To generate SQL for review, add:

--write-sql NEW_FILE.sql

The tool never connects to a database or executes SQL. It refuses to overwrite an existing output file. Create and invite the target owner in a completely empty disposable project first. SQL refuses a non-empty application database, maps the original owner's rows to that explicit target account and preserves IDs, raw import data and trash timestamps. Auth credentials and sharing are not restored. Push/event preferences are disabled and historical notifications are marked read/delivered.

Test the generated SQL only against that disposable project. Check records, raw reviews, dates, trash, offers, price history and ownership before considering a supervised production recovery. Metadata for a real verified run can be recorded through the service-only record_recovery operation after that verification. Do not record a mocked test as a real production recovery.

## Verification

npm run test:database requires Docker and always creates its own randomly named containers on internal networks. It accepts no production connection string. It applies every migration, disables scheduled jobs, runs rollback SQL tests and simulates a full external upload/restore into a second empty database with a different owner. Cleanup verifies ownership labels before removing only those test containers/networks.

npm run test:browser uses synthetic API responses and actual UI components. The older authenticated E2E suite still requires a disposable invited account; never use the personal account.

Offline editing is not part of this rollout. Saving requires a connection; failed saves retain the open form and all close paths warn about unsaved edits.

La reconexión reutiliza y verifica la carpeta privada existente, incluso después de desconectarla si se vuelve a usar la misma cuenta de Google. Las búsquedas se limitan a carpetas creadas por esta app y marcadas con el propietario; ver [búsqueda por appProperties](https://developers.google.com/workspace/drive/api/guides/search-files).
