# Review journal data

Open **Configuración → Revisar datos** to inspect active playthroughs independently of list filters. Checks never rewrite dates, scores or comments. Open the exact game with **Ver juego** or its full editor with **Editar**.

## What appears

| Group | Checks |
| --- | --- |
| Inconsistencies | Unparseable nonempty play dates, a finish before its start, ratings outside 0–100 and recorded hours outside 0–100000. |
| Suggestions | An exact finish date with a state other than Terminado or Recuerdo. The combination can be intentional. |
| Optional reminders | Completed without a review, played without a console, played without recorded hours. Each reminder type starts disabled. Zero counts as filled. |

Approximate historical text in Recuerdo is accepted; an impossible exact date is still flagged. Missing store pages, legitimate reference links and approximate periods are not errors. Trashed entries are excluded by the active-record resource.

Filters use checkCategory, checkKind and checkHidden=show URL parameters within Settings. Up to 50 findings render initially; more can be shown explicitly.

## Hide and restore

Hiding saves the entry UUID, check kind and only the relevant field values. Title, notes and revision-only edits do not revive findings. A database trigger invalidates a dismissal when those relevant values change, including when later edits return to the original value. **Mostrar ocultos** exposes currently hidden findings and **Volver a mostrar** restores them. Only preferences and dismissals are stored; findings stay derived.

Preference switches update individually. Commands validate authentication, membership, ownership and active-entry status; the API checks the actual finding and the database rechecks its current values under a row lock. Errors retain the last successful state. Offline views can use loaded records; changes are not queued. An active unsaved inline edit must be saved or cancelled before opening another entry.

## Database and recovery rollout

Migration: [journal_data_checks.sql](../supabase/migrations/20261026170348_journal_data_checks.sql). Review it together with lib/backups/bundle.ts and lib/backups/restore.ts before production approval.

1. Publish the compatible backup reader (accepting versions 3–6) before changing snapshot generation. Keep the new client unpublished until its database functions exist.
2. Apply the separately approved additive migration: two owner-scoped tables, explicit grants/RLS, narrow authenticated RPCs, dismissal invalidation and format-6 daily snapshots. Existing game/play data is not backfilled or edited.
3. Publish the settings interface and verify with an owned disposable entry. No production migration or deployment is performed merely by implementing this feature.

Complete daily recovery JSON includes both new tables, including dismissals attached to trash. Old snapshots default to empty check state. Recovery requires an empty migrated project and explicit account mapping; it restores settings without enabling notification delivery or recreating sharing. Existing game-export columns are unchanged.

## Verification

- Unit/API: npm test -- tests/data-checks.test.ts tests/data-checks-api.test.ts tests/data-checks-backup.test.ts tests/journal-location.test.ts
- Browser: npm run test:browser -- e2e/mocked/data-checks.spec.ts
- Isolated ownership, invalidation, full backup and restore: npm run test:database
- Full regression: npm test; npm run lint; npm run typecheck; npm run build; npm run test:browser

All automated data writes use mocked services or disposable local databases. Actual Google Drive copying and production restoration are outside this feature's checks.
