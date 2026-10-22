# Implementation review — 21/10/2026

Scope: the retained improvement roadmap plus the later Diario requests. This reviews local code and synthetic tests. It does not certify the deployed site or query personal production data.

## Requirement check

| Area | Local implementation and evidence |
| --- | --- |
| API contracts and resource state | Zod response contracts, independent records/offers/sharing/notifications resources, retained successful data after errors, stable HTTP error codes, canonical saved record/revision. Unit coverage in contracts, API client, resources and route failure tests; browser coverage for partial loads and failed refresh after save. |
| Refresh coordination | In-flight loads coalesce, invalidated responses cannot replace newer data, Realtime bursts refresh affected resources. Resource tests verify overlapping loads and canonical-save precedence. Notification pages are tied to the successful head response they followed. |
| Entry editor | Four tab components share one draft; close/Escape/outside/Cancel and browser navigation protection; failed saves retain the draft. Browser coverage includes dirty close, keyboard tab movement, conflict failures and successful save followed by failed refresh. |
| Trash | Nullable playthrough deletion metadata, confirmation, ten-second Undo, Settings restore/permanent-delete/empty-trash controls, thirty-day purge. SQL checks cover ownership, revoked sharing, expired restore, imports and worker eligibility, and preserving game/history data. Browser checks cover undo/restore with a failed refresh. |
| Drive backup implementation | Separate server OAuth, refresh tokens in Vault, private app-owned folder, internal snapshot reuse, JSON/Excel/SHA-256 manifest, persisted file IDs, hourly retries, verified upload before success and retention, separate stale/failure/reconnect controls. Mocked Drive and SQL tests cover retries, integrity, retention and permissions. Live setup remains pending below. |
| Recovery | Validation and dry-run CLI with explicit target-owner mapping; refuses a populated application database. A simulated external bundle is restored into a second empty disposable database. Personal data is never used. |
| Duplicate warnings | Normalized title and canonical Steam/Nintendo identities, including saved offer URLs; explicit existing-entry/replay/separate-game choices. Server recheck and unit/browser coverage. No automatic merging. |
| Quick actions | Status, priority and access use the same validated revision-aware save endpoint. Dates are not invented. Browser coverage includes a conflict retaining the selected values. |
| Notification history | Exact total unread count, unread/all/type filters, cursor pagination and targeted/mark-all read actions. URL persistence and accessible drawer. Subscription endpoints remain compatible. |
| Statistics | Biblioteca year cohorts, comparison, completed/started counts, completion rate, recorded hours, ratings, unique games and console breakdown. Strict story/extras/completionist parsing with sample counts; multiple-device hours counted once under Varias consolas. Controls persist in the URL. |
| Diario | Recuerdo, Jugando, Terminado, No terminado and En pausa; status badge/filter; combined Valoración column for Reseña, Memorabilidad and Impresiones. Badge uses Reseña first, otherwise numeric Impresiones × 10, including zero and decimal commas. Memorabilidad is never the badge fallback. Defaults remain year 2024 and period descending; mobile hours remain visible. |
| CI and documentation | Unit tests, lint, production build, TypeScript, mocked browser tests and worker-domain consistency checks; isolated database workflow and setup/recovery documentation. GitHub-hosted results must be checked for the pushed revision. |

Diario retains the period-based year filter. Select Todos los años to include entries without a matching period. Qualitative impressions remain text; numeric impressions from 0 to 10 can supply the badge. No original review or imported data is rewritten.

## Issues found and fixed in this review

1. A failed notification refresh removed previously loaded history pages. A delayed pagination response could also append an obsolete page after a newer head response. Pages now belong to their successful head response; failed refreshes preserve them and stale pages are ignored.
2. Database failures in notification preference/device queries and offer editing were reported as field validation errors. These routes now return temporary failure codes/503; absent offers return NOT_FOUND/404.
3. A confirmed move to trash depended on the next refresh to hide the row. If refreshing failed, the deleted entry remained in the normal view. The confirmed result now removes it and its local sharing grants immediately, while Undo/restore still work.
4. Retrying notification history or a Drive backup could succeed while an obsolete action-error banner stayed visible. Starting a new attempt now clears that old error; new failures still display normally.

Each issue was reproduced by a failing regression test before the fix.

## Verification

- 176 unit tests passed; one optional live-store test skipped.
- 11 mocked browser tests passed, including desktop/mobile Diario and the new failure regressions.
- 14 SQL checks passed using isolated disposable PostgreSQL containers.
- Simulated JSON + Excel + manifest upload and recovery into a second empty database passed with a different owner.
- Lint, TypeScript, production build and the worker-domain consistency check passed.

These tests do not demonstrate actual Google service authorization, live backups, phone push delivery or production deployment.

## Pending live setup

- Review the actual SQL and obtain approval before executing the two additive trash/Drive migrations.
- Configure the server OAuth client, Drive API, privileged server environment and Cron Vault entries described in improvements-setup.md.
- Complete the owner's one-time Google authorization.
- Verify a real Drive upload/download/restore cycle into an empty disposable project before recording recovery verification.
- The owner subsequently requested commit, push and deployment. SQL execution remains subject to the separate approval described above. No spreadsheet edits or paid services are part of this work.

Offline creation/editing was canceled by the owner. It is intentionally excluded: no IndexedDB record cache, persistent drafts, mutation queue, sync endpoint or offline-write migration remains.

## Rollout update — 22/10/2026

The owner approved the three exact migration files and pre/post verification SQL. Production now contains explicit worker grants, recoverable trash/canonical saving and external backup metadata/functions. Counts remained 211 games, 212 playthroughs, 175 offers and 158 price-history rows. All three new endpoint functions were found after rollout. Local filenames were aligned with the versions assigned by Supabase without changing SQL bytes. Google OAuth authorization and a real external backup/restore cycle still need setup; production publishing status must be checked in Vercel.
