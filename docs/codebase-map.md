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
- src/lib/journal/entry-status.ts: date/status rules. Editing a date can change status; transitioning an existing record to playing/completed fills its matching blank date with today's Argentina date.
- src/lib/validation.ts: runtime validation rules for saved records and page URLs.
- src/lib/domain.ts: store parsing and spreadsheet import planning.

## Follow a save

1. EntryEditor keeps changes in its local draft.
2. Saving validates the release and pages and applies the existing date/status rule.
3. JournalApp sends the entry to /api/records through apiRequest.
4. The server checks membership, validates the request, compares the saved status, and fills a missing start/finish date for a transition to playing/completed before calling the database save function.
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

- components/games/editor/{main,playthrough,review,more}-tab.tsx render the four editor panels. EntryEditor owns one draft, validates it once, warns on every unsaved close path, and retains it after failed saves. A saving state keeps a spinner/status visible in the sticky dialog header, disables draft fields, and blocks repeated submissions through one shared save guard. Failed saves unlock the preserved draft. Offer price targets share that draft and are validated/saved by Guardar entrada; leaving the target field no longer starts a competing automatic save. Play-date edits derive Período as YYYY or YYYY-YYYY in both the shared draft and save API, including dates filled by status transitions. Manual approximate periods remain available when dates are unchanged. There is no persistent offline queue.
- lib/contracts.ts and lib/imports/contracts.ts define Zod response schemas. TypeScript describes expected values at build time; Zod checks the JSON actually received at runtime.
- lib/resource.ts models independent loading, freshness and errors while retaining successful data. useJournalData coalesces Realtime bursts and refreshes only affected resources. A failed notifications request cannot erase the library.
- lib/api-errors.ts adds stable codes and HTTP status while retaining the existing error text. apiRequest throws ApiRequestError, including structured field errors/details.
- lib/journal/duplicates.ts compares normalized titles and canonical store identities, including separately stored offers. Warnings require an explicit choice; existing games are never merged automatically.
- EntryEditor edits status, priority and access through the validated save endpoint and server revision. List quick actions and their trailing column were removed at the owner's request. The shared save endpoint still fills a missing start date on a transition to Jugando, or a missing finish date on a transition to Terminado, using Argentina's calendar date. Nonblank dates and unchanged statuses are preserved.
- lib/journal/statistics.ts calculates Biblioteca year cohorts, unique games, recorded hours, ratings and interpretable estimates. statistics-panel.tsx displays the comparison. Missing/ambiguous values never become zero samples.
- lib/notifications/history.ts and app/api/notifications provide keyset pagination, exact unread counts and owner-scoped read actions. components/notifications/notification-drawer.tsx is the accessible bell drawer; push subscription behavior remains in api/push. lib/notifications/read-state.ts coordinates immediate read updates across the drawer, settings and bell count, with per-action rollback. Notification refreshes wait for pending saves; successful reads stay visible as read if refreshing fails. Read actions refresh only notifications, and the drawer can close while saving.

The URL state also contains statistics controls and notification filters/open state. Refreshing or bookmarking preserves them.

## Recovery and deletion

The game/playthrough separation is retained. playthroughs.deleted_at controls visibility, sharing and worker eligibility. Only controlled trash functions can change deletion state or permanently delete a trashed playthrough. Browser game deletion is revoked to prevent cascades bypassing trash. Imports identify trash matches and require restoration or skipping.

lib/backups/ contains snapshot validation, deterministic JSON/Excel bundles, Drive ownership checks, resumable uploads, worker coordination and recovery SQL generation. Credentials remain on the server and in Vault; public.external_backup_runs contains owner-readable metadata, and private tables hold connections/jobs.

The protected Next Node worker is invoked by Supabase Cron. It exports a saved internal snapshot rather than re-reading changing live tables. A successful copy requires verified JSON, Excel and manifest files.

Follow a save now: editor → Zod request validation → membership/duplicate checks → save_record_result → canonical record plus revision in the same transaction → adopt that entry → refresh affected data. A later refresh failure is reported separately from the successful save.

## Repeatable verification

npm run lint, npm test, npm run build, npm run typecheck and npm run test:browser are required by CI. Mocked browser tests use real components with synthetic API data; they require no private account.

npm run test:database creates isolated Docker PostgreSQL databases, applies every migration, runs rollback integration tests and restores a simulated external bundle into a second empty database with a new owner. It has no production connection-string option.

node scripts/sync-worker-domain.mjs updates the Deno worker's domain/type copies; --check verifies them in CI.

See improvements-setup.md for exact SQL rollout and real Google authorization/recovery steps. Production SQL, deployment and a real external backup cycle remain separate setup actions.

## Diario

Diario reúne Recuerdo, Jugando, Terminado, No terminado y En pausa. Mantiene el año inicial 2024 y el orden por período; los filtros de estado y reseña y el orden de valoración se guardan en la URL. El filtro de reseña permite todas, con reseña o sin reseña; un cero cuenta como reseña, y la insignia de impresiones no sustituye ese campo. journal-review.tsx reúne reseña, memorabilidad e impresiones, usando reseña o impresiones numéricas × 10 en la insignia. Los campos originales se conservan sin conversión.

Lista de deseos muestra una única lista: se retiraron las tarjetas repetidas de precios que aparecían debajo de la tabla. Se mantienen prioridad, acceso, precios y descuentos en la lista.

## Guía de reseñas

`lib/scoring-guide.ts` define los valores iniciales y la validación compartida. `components/settings/scoring-guide.tsx` permite consultar y editar la guía desde Configuración y la pestaña Reseña del editor. `app/api/scoring` usa autenticación y persistencia por propietario. JSON, Excel y respaldos completos incluyen las personalizaciones. Ver [scoring-guide.md](scoring-guide.md) para el contrato y rollout pendiente.

## Carga desde una página

Al crear un juego se elige una página de Steam/Nintendo o carga manual. entry-start.tsx consulta el endpoint autenticado api/store-preview; lib/offers/store-preview.ts obtiene y normaliza los campos de tienda sin guardar datos. EntryEditor aplica esos campos al borrador compartido antes de confirmar la creación. Ver [store-page-creation.md](store-page-creation.md).

## Estados vigentes

Se retiró Pendiente. Los juegos nuevos y las importaciones sin estado definido usan Lista de deseos. lib/journal/status-schema.ts acepta el valor heredado backlog y lo interpreta como wishlist en lecturas y guardados; las opciones solo muestran los estados vigentes. La exportación Excel/CSV también usa esa etiqueta. No se modifican filas de producción: los valores antiguos se normalizan al guardar, mientras los respaldos completos conservan sus tablas originales.

## Comentarios debajo de cada juego

Biblioteca y Diario mantienen los datos principales en una fila y muestran Comentarios adicionales en otra fila que abarca todas las columnas visibles. Solo se crea esa fila si hay texto; se conservan los párrafos, la agrupación al ordenar y los bordes entre juegos. En móvil, game-comments.tsx ocupa todo el ancho de la tarjeta. El campo notes sigue definido como columna oculta para conservar los ordenamientos existentes.

## Mejor consola en Diario

La sexta tarjeta de Diario muestra la consola con mayor valoración media dentro de los filtros actuales, siempre que tenga al menos cinco partidas con una única consola registrada y una valoración válida. La cantidad mínima incluye partidas sin puntaje; el promedio usa solo reseñas o, si faltan, impresiones numéricas × 10. Los ceros cuentan. Los empates se resuelven por cantidad de valoraciones y luego por nombre. Sin candidatos aparece “Sin datos suficientes”. Biblioteca conserva Reseña media.

## Etiquetas de emulación

lib/journal/console-labels.ts normaliza las variantes de emulación a Emulador en lecturas, guardados, importaciones, exportaciones tabulares y filtros guardados en URL. La comparación de importaciones normaliza también la base para evitar conflictos causados solo por etiquetas antiguas. Las reseñas y snapshots originales de importación se conservan. La limpieza aprobada del 23/10/2026 unificó seis etiquetas guardadas; otras tres ya eran Emulador.

Notification links use useNotificationNavigation to reveal an active game in its current tab, reset filters that could hide it, and mark the event read in the background. Phone notifications carry the event UUID in the URL; the owner-scoped notifications API resolves it after games load. The selected playthrough UUID persists as entry in the URL, and JournalGameTable scrolls/focuses its visible row or mobile card with an accent highlight. Stale lookups cannot override later navigation; missing active entries show a notice.

La edición directa de escritorio está descrita en docs/desktop-inline-editing.md. inlineFields/inlineCandidate definen los campos y validación; useInlineEditing conserva borrador, revisión y deshacer; components/journal/inline renderiza los controles de escritorio.

Global search lives in components/journal/search/global-search.tsx and lib/journal/search.ts. It searches the full loaded active-records resource independently of list filters, groups replays by gameId, and uses lib/journal/entry-destination.ts with revealEntry to open the exact playthrough. Notifications reuse the same destination helper. Loading and failed refresh states preserve the distinction between unavailable and empty data. The global search saves no data unless the user explicitly chooses to save an existing inline draft before navigating.

Play dates accept dd/mm/yy or dd/mm/yyyy, with a fixed two-digit-year window of 1950-2049. PlayDateInput keeps raw text while typing and formats on blur; recordSchema normalizes valid play dates to dd/mm/yyyy before saves, including automatic status dates at the records API boundary. Unknown historical text is preserved. The shared dateOrder parser keeps filters, sorting, status transitions, and derived periods consistent.

Mobile quick editing uses components/journal/mobile/quick-editor.tsx and lib/journal/quick-editing.ts. Card bodies have no edit action; a deliberate pencil opens the sheet. useInlineEditing.saveDraft is shared with desktop saves for validation, current-revision checks, canonical response handling, and session Undo. useOverlayHistory guards browser Back without putting private drafts in the URL or history state. EntryEditor accepts initialDraft to transfer quick edits without losing its original baseline. Primary coarse-pointer layouts render these cards even on wide screens.


Suggestions use lib/journal/suggestions.ts for pure eligibility, distinct-game selection, numeric-priority/Hype/title ranking, available-console evidence and strict total-duration filtering. components/journal/suggestions/suggestions-panel.tsx renders three options with explicit navigation and start/resume actions. Access classification lives in lib/journal/ownership.ts and is re-exported by OwnershipBadge for existing callers. The suggestions URL contract uses tab=suggestions, platform, maxHours, estimateTarget and unknownEstimates=include. Browsing remains read-only; start/resume uses useInlineEditing.saveDraft and the existing API date/period/conflict behavior.


Data checks live in lib/journal/data-checks.ts (pure findings, relevant-field fingerprints and typed contracts), components/settings/data-check-panel.tsx and hooks/use-data-check-state.ts. The settings resource loads independently and adopts canonical command responses; failures retain previous state. app/api/data-checks uses owner-scoped RPCs. The additive journal_data_checks migration owns preferences, dismissals, invalidation on relevant edits and format-6 snapshots. Backup parsing/restoration accepts earlier formats and maps the new rows to the explicit recovery owner. See [data-checks.md](data-checks.md) for behavior and rollout ordering.
