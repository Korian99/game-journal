# Codebase map

Start with src/app/page.tsx, which checks access and passes the URL state to JournalApp. The main component assembles the page and connects its callbacks; the details live in the modules below.

## Folder guide

```text
src/
  app/                 Pages, layouts, and HTTP endpoints (Next.js routes)
  components/
    auth/              Login form
    games/             Entry editor, form controls, and game badges
    imports/           Spreadsheet import review
    journal/           Main screen, table, filters, and summary
    offers/            Store page editor and wishlist prices
    settings/          Invitations, backup status, and notifications
    ui/                Shared interface primitives, such as dialogs
  hooks/               React state, effects, URL state, and filtered collections
  lib/
    journal/           View rules, dates, summaries, status, and journal types
    offers/            Price formatting, discount checks, and store platforms
    supabase/          Browser and server database clients
    ...                Shared types, validation, API helpers, and integrations
```

Put a new component in its feature folder, a reusable stateful hook in `src/hooks`, and a calculation or formatting helper in the relevant `src/lib` folder. Shared helpers stay directly under `src/lib`. Route folders under `src/app` define URLs; the component folders do not.

## Frontend responsibilities

| File                                            | Responsibility                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| src/components/journal/journal-app.tsx          | Page composition, navigation, choosing an entry to edit, and wiring user actions.                                                           |
| src/hooks/use-journal-data.ts                   | Loads games, offers, sharing, and notifications; subscribes to Realtime; manages loading, success, and error state.                         |
| src/hooks/use-journal-location.ts               | Stores the active tab, filters, and sorting in the URL and remembers state when switching tabs.                                             |
| src/hooks/use-journal-collection.ts             | Applies the existing search, date, status, discount, and platform filters; calculates summary values and filter choices.                    |
| src/components/journal/journal-columns.tsx      | Defines the table columns and sort behavior for each view. Common columns have names such as title and release rather than array positions. |
| src/components/journal/journal-game-table.tsx   | Renders the sorted desktop rows and mobile cards.                                                                                           |
| src/components/journal/journal-toolbar.tsx      | Renders search and filter controls.                                                                                                         |
| src/components/journal/journal-summary.tsx      | Renders the totals and games per console for the filtered collection.                                                                       |
| src/components/games/entry-editor.tsx           | Owns the entry draft, form tabs, validation feedback, and deletion confirmation.                                                            |
| src/components/offers/offer-editor.tsx          | Edits an existing store page, its target price, and notification setting.                                                                   |
| src/components/imports/import-review-dialog.tsx | Shows the import plan and collects conflict resolutions before applying it.                                                                 |
| src/components/settings/admin-invite.tsx        | Requests and displays a private invitation link.                                                                                            |

## Shared helpers

- src/lib/api-client.ts: the existing JSON request/response handling, shared by frontend components.
- src/lib/offers/format-offer-price.ts: the existing currency formatting for store offers.
- src/lib/journal/journal-types.ts: the entry type, including its game ID, and the shared action callback type.
- src/lib/journal/entry-status.ts: the rule for changing status when start/finish dates are edited.
- src/lib/validation.ts: runtime validation rules for saved records and page URLs.
- src/lib/domain.ts: store parsing and spreadsheet import planning.

## Follow a save

1. EntryEditor keeps changes in its local draft.
2. Saving validates the release and pages and applies the existing date/status rule.
3. JournalApp sends the entry to /api/records through apiRequest.
4. The server checks membership and validates the request before calling the database save function.
5. performAction reloads the journal after success. The collection hook recalculates the filtered rows and summary.

The components handle presentation, hooks handle state and effects, and small helpers hold reusable calculations. A custom hook is a React function named useSomething; it lets a component reuse stateful logic without putting it inline in the page.

## Backend locations

- src/app/api/**/route.ts: Next.js HTTP endpoints, running on the server.
- supabase/functions/: Deno workers for prices, notifications, and invitations.
- supabase/migrations/: versioned database changes and database functions.

The earlier folder refactor preserved behavior. The additional reliability and app changes are described below.

## Checks

Run npm test for the unit tests, npm run build for the production build, and npm run typecheck for TypeScript. Browser tests live under e2e; authenticated tests require a disposable fixture account as described in the README. SQL integration checks live under tests and use rollback transactions.

## Reliability and daily-use improvements

JournalApp still composes the page. The additional feature modules keep new behavior out of the main screen:

- components/games/editor/{main,playthrough,review,more}-tab.tsx render the four editor panels. EntryEditor owns one draft, validates it once, warns on every unsaved close path, and retains it after failed saves. There is no persistent offline queue.
- lib/contracts.ts and lib/imports/contracts.ts define Zod response schemas. TypeScript describes expected values at build time; Zod checks the JSON actually received at runtime.
- lib/resource.ts models independent loading, freshness and errors while retaining successful data. useJournalData coalesces Realtime bursts and refreshes only affected resources. A failed notifications request cannot erase the library.
- lib/api-errors.ts adds stable codes and HTTP status while retaining the existing error text. apiRequest throws ApiRequestError, including structured field errors/details.
- lib/journal/duplicates.ts compares normalized titles and canonical store identities, including separately stored offers. Warnings require an explicit choice; existing games are never merged automatically.
- components/games/quick-actions.tsx edits status, priority and access using the same validated save endpoint and server revision as the editor. It does not manufacture start/finish dates.
- lib/journal/statistics.ts calculates Biblioteca year cohorts, unique games, recorded hours, ratings and interpretable estimates. statistics-panel.tsx displays the comparison. Missing/ambiguous values never become zero samples.
- lib/notifications/history.ts and app/api/notifications provide keyset pagination, exact unread counts and owner-scoped read actions. components/notifications/notification-drawer.tsx is the accessible bell drawer; push subscription behavior remains in api/push.

The URL state also contains statistics controls and notification filters/open state. Refreshing or bookmarking preserves them.

## Recovery and deletion

The game/playthrough separation is retained. playthroughs.deleted_at controls visibility, sharing and worker eligibility. Only controlled trash functions can change deletion state or permanently delete a trashed playthrough. Browser game deletion is revoked to prevent cascades bypassing trash. Imports identify trash matches and require restoration or skipping.

lib/backups/ contains snapshot validation, deterministic JSON/Excel bundles, Drive ownership checks, resumable uploads, worker coordination and recovery SQL generation. Credentials remain on the server and in Vault; public.external_backup_runs contains owner-readable metadata, and private tables hold connections/jobs.

The protected Next Node worker is invoked by Supabase Cron. It exports a saved internal snapshot rather than re-reading changing live tables. A successful copy requires verified JSON, Excel and manifest files.

Follow a save now: editor/quick action → Zod request validation → membership/duplicate checks → save_record_result → canonical record plus revision in the same transaction → adopt that entry → refresh affected data. A later refresh failure is reported separately from the successful save.

## Repeatable verification

npm run lint, npm test, npm run build, npm run typecheck and npm run test:browser are required by CI. Mocked browser tests use real components with synthetic API data; they require no private account.

npm run test:database creates isolated Docker PostgreSQL databases, applies every migration, runs rollback integration tests and restores a simulated external bundle into a second empty database with a new owner. It has no production connection-string option.

node scripts/sync-worker-domain.mjs updates the Deno worker's domain/type copies; --check verifies them in CI.

See improvements-setup.md for exact SQL rollout and real Google authorization/recovery steps. Production SQL, deployment and a real external backup cycle remain separate setup actions.
