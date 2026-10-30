# Covers, recaps, and game series

**State:** Implementation requested 2026-10-30; checkpoint 0 complete; checkpoint 1 complete locally; checkpoint 2 not started
**Prepared:** 2026-10-30

This plan adds game cover art, private monthly and yearly recaps, and user-defined game series. Checkpoint 0 is complete. Checkpoint 1 implementation, focused checks, and independent data/privacy review are complete locally; committing it or starting checkpoint 2 still follows the user’s working agreement. No production SQL, push, or deployment is authorized.

The delivery order is **covers → recaps → series**. Each numbered checkpoint is one coherent implementation unit. For each unit, complete the focused checks and present the diff and results; wait for explicit approval before committing or beginning the next unit. Do not reconstruct intermediate commits or perform remote operations.

## Proposed defaults for checkpoint 0

Only the three feature areas are accepted at this level. The defaults below are working implementation choices based on the accepted feature request and main-agent checkpoint 0 review. They do not authorize production SQL, a commit, push, or deployment.

| Area | Proposed default |
|---|---|
| Artwork ownership | Store cover metadata on the game identity (`gameId`), not on an individual playthrough (`id`). One game may have several playthroughs. |
| Artwork metadata | Game-level optional object: `games.data.cover` with `providerUrl`, optional `overrideUrl`, and `provider` (`steam` or `nintendo`). Each URL is bounded to 2000 characters and must use an approved exact image host. Effective art is override URL first, provider URL second; empty or absent values mean no cover. |
| Artwork sources | Prefer artwork found through the existing Steam/Nintendo search and preview flow. A provider refresh must not replace a manual override or an existing cover when adding a US counterpart. Do not backfill the whole library automatically. |
| Manual artwork | First version accepts a validated HTTPS image URL only from the approved provider image hosts and a reset action. The cover object remains private owner metadata; avoid uploads and a new storage service until separately justified. |
| Image loading | Current candidate hosts verified from provider responses: `shared.akamai.steamstatic.com`, `shared.fastly.steamstatic.com`, and `assets.nintendo.com`. Use returned image URLs; do not guess paths or allow wildcard hosts. Bound any server fetch and never create an unrestricted image proxy. Missing or failed art uses a neutral fallback. Changes to this allowlist require evidence from provider responses. |
| Recap calendar | Preserve the calendar date entered in date-only start/finish fields; do not interpret date-only values as UTC timestamps or shift them across days. Current `dateOrder` accepts full valid dates (`YYYY-MM-DD` or local day/month/year), not year-only values. Use Argentina time only for timestamps and the current period. Never infer a month from a year or period, or activity from a game's release date. |
| Recap completion count | Count a playthrough only when its status is `completed` and its full valid recorded finish date is in the selected month or year. Exclude year-only, approximate, and missing dates from both period counts and report the exclusion count. Show finished playthroughs and unique games separately so replays are not mistaken for distinct titles. A separate recorded-starts count may use full valid recorded start dates; it describes dates recorded, not verified activity. |
| Recap hours | Existing year-cohort hour sums are totals, not hours played during that year. Do not describe playthrough totals as hours played in a month or year. V1 omits period-hour totals; true time-in-period reporting requires session tracking, which is outside this plan. |
| Recap highlights | Offer an explicit curated highlight and optional note. Notes are excluded from exported images unless the user opts in for that export. Do not infer favorites from rating alone in V1. |
| Recap privacy | Recompute from current private owner data; do not publish links, schedule posts, or store historical recap snapshots in V1. |
| Series membership | Create series manually and order membership explicitly. A game may belong to multiple series. Do not infer a franchise or pull in remakes, spinoffs, or related titles automatically. |
| Series progress | Count a game once when it has a Completed, non-trashed playthrough. Replays do not raise the denominator or completion count. Trashing changes progress only when it removes the last qualifying completion; restoring that playthrough restores progress. |
| Deletion behavior | Deleting a series removes that series and preserves its games and playthroughs. Within an existing series, trashing a playthrough never removes membership; restore preserves it. Only permanently deleting a game identity removes its membership. |

Checkpoint 0 verifies these defaults against the current data model, ownership and restore behavior. Record any changed decision here so this remains the single source of pending work.

### Checkpoint 0 architecture map

- **Identity and saves:** `src/lib/journal/journal-types.ts` defines `JournalEntry` as `JournalRecord` plus optional `gameId`; `id` is the playthrough ID and `gameId` is the stable game ID. The latest `list_records` projection in `supabase/migrations/20261022104421_recoverable_playthrough_trash.sql` merges `games.data` with `playthroughs.data`, then adds those IDs and source metadata. `save_record` writes shared game fields to `games.data` and playthrough fields to `playthroughs.data`. The current canonical `save_record_result` path delegates page-bearing saves to `save_record_with_pages`.
- **Validation and preview:** `src/lib/contracts.ts` explicitly enumerates the fields returned as journal entries, so unknown projected fields are discarded by that schema. `src/lib/offers/store-preview-contract.ts` currently has no artwork field. `src/components/games/entry-editor.tsx` merges preview title/platform/release data into the draft and adds canonical page links; it does not overwrite unrelated personal fields. Search adapters in `src/lib/offers/store-search.ts` and `nintendo-search.ts` currently return no image field. New cover data therefore needs an explicit validated provider contract and game-level save path; do not weaken the API schema to pass arbitrary keys.
- **Snapshots and restore:** The latest local capture definition is migration `20261026170348_journal_data_checks.sql`; it emits snapshot version 6 and captures raw `games` and `playthroughs` rows, including their `data` objects. Earlier local formats 3–5 are accepted by `src/lib/backups/bundle.ts`. Its row `data` schemas are records of unknown JSON values, so new game-data keys can survive bundle parsing; its derived `records` use the explicit journal schema and drop unknown fields. `src/lib/backups/restore.ts` writes the captured source rows and remaps owner IDs; sharing grants are not recreated. Bundle manifest `formatVersion: 1` is distinct from snapshot `version: 6`. This describes local code/migrations, not a live database version.
- **Exports and sharing:** `/api/export` returns JSON version 2 from the `list_records` projection; CSV/XLSX use fixed columns in `src/lib/export.ts`. Include validated cover metadata in structured JSON and backups; preserve existing CSV/XLSX columns. `private.read_shared()` in migration `20261022104421_recoverable_playthrough_trash.sql` constructs an explicit field allowlist and currently exposes no cover metadata. For an already-shared game, expose only its validated effective cover URL through the same grant, projection, and revocation rules; never expose provider or override metadata. Require privacy and grant-revocation tests in checkpoint 1.
- **Date and statistics:** `src/lib/journal/view-config.ts` parses full valid dates and formats date-only values from UTC calendar components to avoid day shifts; it does not parse year-only values as dates. `src/lib/journal/statistics.ts` sums playthrough hours over its year cohort, not hours played during that calendar year. Recap period hours stay out of scope; date-only full dates are the only dates eligible for monthly and yearly counts.
- **Checkpoint 1 contract:** `games.data.cover` is an optional object with optional `providerUrl`, `overrideUrl`, and provider (`steam` or `nintendo`) members, so an override-only value is valid. Each present URL is at most 2000 characters and uses one of the exact HTTPS hosts listed above. Absent or empty values resolve to no cover; effective art is override first, then provider URL. Provider refresh and adding a Nintendo US page must not replace a manual override or the existing AR cover. Keep the cover object as private owner metadata. Include validated cover metadata in the owner’s structured JSON export and backup; keep existing CSV/XLSX columns unchanged. Shared games expose only the validated effective cover URL through the same existing grant, projection, and revocation rules; never expose provider or override metadata. Add privacy and revocation tests before completing this implementation unit, without changing auth boundaries.
- **Checkpoint 0 review outcome:** The main agent reviewed and approved the data map and working defaults above. This is based on local code and migration history; no claim is made about a live database version. Checkpoint 0 is complete.

## Checkpoints

| Done | # | Deliverable |
|---|---:|---|
| [x] | 0 | Confirm defaults and map existing data |
| [x] | 1 | Persist and ingest cover metadata |
| [ ] | 2 | Display and manually manage covers |
| [ ] | 3 | Define recap calculations |
| [ ] | 4 | Present and export recaps |
| [ ] | 5 | Create and edit ordered series with recovery compatibility |
| [ ] | 6 | Show series progress and verify recovery |

### 0. Confirm decisions and map existing data

- **Outcome:** Read-only map of the current game/playthrough fields, latest local snapshot version, backup compatibility, sharing boundary, and verified provider image hosts; proposed defaults are ready for owner review.
- **Acceptance:** The plan distinguishes `id` (playthrough) from `gameId` (game), records the local current snapshot format without claiming a live database version, explains which backup data preserves new game fields and which derived records strip them, and identifies explicit export/sharing compatibility decisions.
- **Focused verification:** Read current types, latest relevant migrations, provider preview contracts, export and restore code. No tests or database access are needed for this documentation-only checkpoint; use synthetic fixtures for later restore tests.
- **Boundary:** Documentation and schema review only. No migration, artwork backfill, code, or SQL.

### 1. Persist and ingest cover metadata

- **Outcome:** A newly searched or previewed game can retain validated artwork metadata with its game identity.
- **Scope:** Extend explicit Steam/Nintendo search/preview and canonical save/read contracts for optional game-level artwork. Preserve manual override priority and do not rewrite the existing cover when adding a US counterpart or refreshing provider metadata. Treat older backups without artwork fields as valid. Include validated cover metadata in structured JSON and backups; preserve existing CSV/XLSX columns.
- **Acceptance:** New results can provide an approved cover; unsupported, absent, malformed, or oversized metadata falls back cleanly. Existing covers survive provider refresh. One game with several playthroughs has one shared cover.
- **Focused verification:** Unit tests for host/URL validation, field bounds, provider refresh versus override, and old backup decoding; mocked preview/save browser flow; synthetic export/backup/restore compatibility check.
- **Commit boundary:** Cover metadata and provider/save integration together, with tests and compatibility notes.
- **Checkpoint 1 verification (2026-10-30):** Completed local implementation adds the shared cover contract and Steam/Nintendo provider URLs, preserves cover metadata in canonical records and owner JSON/backup data, validates game-level SQL writes, and shares only the effective validated URL under existing grants. Focused Vitest: 74 tests passed; TypeScript and ESLint passed; mocked search-to-save browser suite: 12 tests passed (desktop/mobile included); `node --import tsx tests/run-covers-database.mjs` passed cover save/legacy omission/replay isolation/stale revision/owner denial/validation/share/revocation checks, existing RLS and release scenarios, and synthetic backup restore of provider plus override URLs. Independent data/privacy review found no actionable issues. Checkpoint 1 is complete locally; its migration has not been applied to production.

### 2. Display and manually manage covers

- **Outcome:** Covers appear consistently in game details and library views, with a usable fallback and manual correction.
- **Scope:** Add cover thumbnails to search results, a game header/thumbnail, and an optional library grid behind an explicit view choice (keep the current table as default). Add lazy loading, fixed image dimensions, manual HTTPS override, reset action, and mobile/keyboard support.
- **Acceptance:** Broken art does not shift layout or block editing. A user-selected image stays selected after provider refresh and when a second playthrough or page is added. Existing table workflow remains available.
- **Focused verification:** Browser primary flow at desktop and narrow mobile sizes; keyboard/focus check; broken-image and long-title fixtures; render an exported view with and without artwork.
- **Commit boundary:** Cover presentation and manual override together, after checkpoint 1 is complete.

### 3. Define recap calculations

- **Outcome:** Pure, deterministic monthly/yearly recap data based only on supported recorded activity.
- **Scope:** Reuse existing statistics/date helpers. Preserve entered date-only calendar days; do not UTC-convert them. Show finished playthroughs and unique games separately. An entry with missing or imprecise dates is excluded from date-based period counts and the recap explains the exclusion. Do not allocate total hours to a period.
- **Acceptance:** A playthrough counts as completed only when its status is `completed` and its full valid recorded finish date is within the period; a finish date on an abandoned or other non-completed playthrough does not count. Date-only starts/finishes belong to the calendar day recorded. Year-only, approximate, missing, and invalid dates are excluded from month and year counts, with the exclusion shown. Release dates and current list filters never fabricate recap activity. A separate starts metric, if included, means a full valid start date was recorded, not that activity was verified. A curated highlight is explicit; no automatic favorite ranking is claimed.
- **Focused verification:** Pure tests for month/year boundaries, date-only values without UTC day shifts, Argentina timezone for timestamps, completed status plus finish date, recorded starts, missing/partial dates, replays, duplicate game identities, deleted/trash exclusions, and empty periods.
- **Commit boundary:** Recap definitions and calculation module with their tests; no new persistence.

### 4. Present and export recaps

- **Outcome:** Users can review a month or year and download a shareable image.
- **Scope:** Period selector, clear metric labels, explicit exclusions, curated highlight, optional note, cover artwork, preview, and image download. Recompute from current data; editing old entries can change later views of a recap.
- **Acceptance:** Export dimensions are useful on common phones and desktop. Notes are off by default per export. Missing or cross-origin artwork cannot taint or break canvas/image generation; the fallback still exports. No public URL, automatic posting, scheduled job, or stored snapshot.
- **Focused verification:** Browser period selection; compare displayed values with checkpoint 3 fixtures; render and inspect actual downloaded PNGs in light/dark themes with good and failed artwork.
- **Commit boundary:** Recap UI and image export together, after calculation behavior is approved.

### 5. Create and edit ordered series

- **Outcome:** A user can create a named series and explicitly assign and reorder games.
- **Scope:** Owner-scoped series and membership keyed to stable game identity, not playthrough identity. Reuse existing game search/selection. Keep names and membership manual; no external series catalog or inferred franchise data.
- **Acceptance:** A game can appear in multiple series; a standalone game remains unaffected. Reordering persists. Deleting a series leaves every game and playthrough intact. Within an existing series, trashing a playthrough never removes membership; progress changes only if the trashed playthrough was the last qualifying completion, and restore restores that progress. Only permanently deleting a game identity removes its membership. Shared users do not gain access to owner-private series accidentally.
- **Focused verification:** Domain tests for ordering, duplicate membership prevention within one series, multiple-series membership, trash/restore and permanent deletion behavior, ownership, and old-format backup compatibility; browser edit/reload flow; disposable database tests for ownership and concurrent/revision-checked writes if persistence requires them.
- **Commit boundary:** Series persistence, validation, editor, export and backup/restore compatibility with old formats, and focused tests together. Review actual migration and grants/RLS before any later request to run SQL.

### 6. Show series progress and verify recovery

- **Outcome:** Series pages show ordered covers, next incomplete games, and transparent progress.
- **Scope:** Progress counts unique member games, with a member complete if any eligible, non-trashed playthrough has Completed status. Replays do not increase progress. Wishlist/upcoming are incomplete; paused/abandoned remain incomplete. Trashing/restoring a playthrough changes progress when it is the last qualifying completion but never changes membership. Permanent game deletion removes membership. Verify the compatibility shipped in checkpoint 5 end to end.
- **Acceptance:** Progress survives reload and backup/restore. Older backup formats remain readable. Missing covers do not make ordering or progress unusable.
- **Focused verification:** Domain tests for replays, multiple playthroughs, trash/restore and permanent game removal; desktop/mobile browser flow through reorder and progress; synthetic older/newer backup round trip.
- **Commit boundary:** Series progress UI and its focused tests. Recovery format changes belong to checkpoint 5. A production migration or rollout is a separate, explicitly approved decision.

## Shared implementation gates

- Keep ownership and privacy checks at existing authenticated boundaries. Recaps and series are private to the current owner unless a separate sharing decision is approved.
- Preserve separate playthrough semantics, current date/status/period rules, export columns, trash behavior, and backup restoration of the explicitly selected owner.
- Use focused tests for the changed domain/provider behavior, then the primary browser flow at desktop and mobile. Use disposable databases only for new persistence, ownership, concurrency, or restore behavior; no automatic full suite at every checkpoint.
- Review the actual migration and backup changes before any production SQL request. No checkpoint authorizes production execution, deployment, publishing, remote operations, or a commit without the owner's later approval.

## Existing code to review when implementation is requested

`src/lib/types.ts`, `src/lib/journal/journal-types.ts`, `src/lib/journal/statistics.ts`, `src/lib/offers/store-search.ts`, `src/lib/offers/nintendo-search.ts`, `src/lib/offers/store-preview.ts`, `src/lib/offers/store-preview-contract.ts`, `src/components/games/editor/store-search.tsx`, `src/components/games/entry-editor.tsx`, `src/components/journal/statistics-panel.tsx`, `src/components/journal/library-game-details.tsx`, `src/lib/export.ts`, `src/lib/backups/restore.ts`, `src/lib/backups/bundle.ts`, and `docs/improvements-setup.md`.
