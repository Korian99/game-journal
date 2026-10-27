# Game Journal: search, mobile editing, suggestions, and data checks

Plan prepared 26/10/2026. Implementation branch: codex/daily-use-improvements. Phase 1 and the date/highlight refinements are committed locally. Phase 2 is implemented for local testing; phases 3-4 remain planned.

## Confirmed decisions

- Deliver the first four proposed improvements. Play-session tracking is outside this scope.
- Keep the Spanish interface, desktop inline editing, full editor, separate playthroughs, existing dates/status/period rules, URL filters, and Steam/Nintendo scheduling.
- Suggestions default to owned or family-access games not started yet, plus paused games. Exclude playing, completed, abandoned, remembered, upcoming, and trashed entries by default.
- En pausa (paused) means the user intends to return later and is eligible for suggestions. No terminado (abandoned) means the user chose to stop, for example because the game bored them; exclude it from suggestions. Never treat these statuses as interchangeable.
- The duration filter means estimated TOTAL game length. Do not subtract recorded hours or claim a game will fit a single session.
- Do not modify the spreadsheet, run production SQL, commit, push, deploy, or activate paid services as part of planning. Review actual SQL and request approval before any production database execution.

## 1. Global search

### User experience

- Add a search control to the shared header, accessible from every view. Desktop also supports Ctrl+K / Cmd+K when the user is not typing in another editor.
- Retain the existing list search and label it clearly as searching the current list. Global search is labelled Buscar en todos mis juegos.
- Search the owner's active entries independently of the current tab, year, status, and console filters. Shared games and trash are excluded in the first version.
- Normalize case, accents, and punctuation using existing title-normalization behavior. Search titles first, with console and period as secondary matches. Rank exact title, title prefix, remaining title matches, then secondary matches.
- Group multiple playthroughs by stable gameId; never group different games solely because their titles match. Let the user choose the desired playthrough, showing its status, console, and dates/period.
- Selecting a result closes search, opens the appropriate tab, clears filters that would hide it, and focuses/highlights the exact entry. Use existing revealEntry navigation and the entry URL parameter. For played states present in both Biblioteca and Diario, use Biblioteca; Recuerdo uses Diario.
- Support keyboard navigation, Escape, focus restoration, loading, refresh failure with retained results, and distinct no-results states. Display results progressively rather than rendering every match at once.

### Implementation boundaries

- Use the already-loaded, owner-scoped records. No new external API calls, full-text database service, or search table.
- Put matching/grouping/ranking in a pure domain module and the accessible search interface in its own component.
- Global search must not discard an active draft or steal shortcuts from the full editor or another dialog. Navigating with a changed draft requires an explicit save/discard/cancel decision.

## 2. Deliberate mobile quick editing

### User experience

- Make mobile cards readable without activating editing when their body is tapped. Add a clearly labelled pencil button with a comfortable 44-by-44 CSS-pixel target.
- The pencil opens an accessible bottom panel for existing entries. Initially provide status, recorded hours, priority, and review, showing only the controls relevant to the current entry/view.
- Provide Guardar, Cancelar, and Abrir formulario completo. Transfer the same draft into the full form without silently saving or losing edits. Returning focus goes to the pencil for that entry.
- Do not open the keyboard until a text/number control is deliberately selected. Normal scrolling and text selection must remain available.
- No saving on touch-down, scrolling, blur, dismissal, or tapping outside. Warn before discarding changed drafts through the close button, Escape, backdrop, or browser Back.
- Show saving progress; prevent duplicate requests. Failed saves preserve the draft. Successful saves apply the canonical response immediately, even if a subsequent refresh fails. Offer explicit Undo after a saved quick edit using the existing session history.
- Keep desktop inline editing for fine-pointer use. Coarse-pointer devices should use deliberate editing even if their screen is wide; verify tablets and mixed viewport/input cases.

### Implementation boundaries

- Reuse the validated save/revision/duplicate path and date/status/period helpers. Consolidate common save behavior where needed instead of creating a third independent implementation.
- Status changes retain current automatic missing-date behavior. Hours are the total recorded hours, not a new session.
- Ownership, pages, long reviews, and other details remain in the full form initially. New-game creation remains unchanged.

## 3. Que juego ahora?

### User experience and eligibility

- Add a dedicated Que juego ahora? destination, accessible on desktop and phone, with console, maximum total duration, and Historia / Historia + extras / Completista controls.
- Start from unstarted wishlist entries and paused entries with Comprado or Acceso familiar. Unstarted means no recorded start or finish date; incomplete historical play data must not be assumed to mean a game is new.
- Exclude future releases and upcoming status, trash, and other statuses by default. Do not move released upcoming games automatically. Uncertain release information stays visibly uncertain.
- Use available-platform metadata and added store pages to establish console compatibility. Do not infer ownership of a specific console edition from game-level access, or treat the previously played console as proof of every available platform.
- Reuse the existing strict estimate parser: a clear three-value estimate supports all targets; a single value supports Historia only; ambiguous text and ranges remain unknown. Preserve the original estimate text.
- With a maximum duration selected, exclude unknown estimates by default and show the excluded count with an explicit option to include unknown durations. Unknown console compatibility is not a confirmed match either.
- Return up to three distinct games. Rank transparently by ascending numeric priority, then known Hype (Hyper, Alto, Medio, Bajo), then title. Preserve textual priorities such as Migui as labels without inventing a numeric meaning; Dunno is unknown Hype.
- Explain each result with real facts such as priority, access, paused status, console compatibility, and estimated total duration. Do not present an opaque recommendation score.
- Offer Ver juego and Ver mas opciones. Browsing suggestions changes no data. Starting a game requires an explicit status action with the normal save rules.
- Persist filters in URL parameters. Explanations for empty results identify which filters narrowed the pool; they do not silently relax the user's choices.

### Implementation boundaries

- Compute eligibility and ranking locally from loaded records/offers. No AI API, external recommender, price refresh, or new game-metadata integration.
- Deduplicate by gameId and choose the relevant paused playthrough when present. Never merge records or create a replay automatically.
- Keep the recommendation algorithm pure and deterministic for repeatable tests and understandable results.

## 4. Optional data-check view

### User experience

- Add Revisar datos inside Configuracion, with counts, issue-type filters, and direct links to the exact entry. Compute checks over active records independently of list filters.
- Separate inconsistencies from optional completion reminders. This view is informative and does not add unrelated blocking validation or notification spam.
- Initial inconsistencies: a nonempty unparseable play date; a finish date earlier than its start; numeric review/hour values outside supported bounds in legacy data. Label ambiguous status/date combinations as suggestions rather than asserting they are invalid.
- Initial optional reminders: completed entries without a review, played entries without a console, and played entries without recorded hours. A review or hours value of zero counts as filled.
- Missing exact dates or approximate periods for Recuerdo are not errors. Missing Steam/Nintendo pages and links to other legitimate sites are not data-quality errors.
- Each item explains why it appears and offers Ver juego / Editar. Never fabricate dates, scores, consoles, or comments, and never bulk-correct or merge entries automatically.
- Let users enable optional reminder types, hide an individual finding, and show hidden findings again. Hide only that specific finding; if its relevant underlying values change, evaluate it again. Do not use the entire entry revision as the fingerprint, since unrelated edits should not revive a dismissed reminder.

### Persistence and recovery

- Keep the checks themselves derived rather than storing copies of games or lists of findings.
- Persist account-level reminder preferences and owner-scoped dismissals so they work across devices. This is the only planned database addition.
- Use an additive migration with explicit grants/RLS, validated API boundaries, and owner checks for referenced entries. Avoid browser access to any other account's records or settings.
- Extend versioned complete snapshots and recovery validation for these settings, preserving compatibility with older backup formats. Restore must preserve explicit owner mapping. Keep existing game-export columns unchanged.
- Review the actual migration and updated backup reader together before requesting SQL approval; do not publish a client that requires an unapplied migration.

## Cross-feature architecture

- Reuse useJournalData for independent loading/error/freshness states; do not confuse a failed load with an empty collection.
- Extract a shared entry-destination helper from existing notification navigation for search, suggestions, and data-check links. Reuse existing highlight/focus behavior rather than building three navigation systems.
- Extend the typed URL contract for suggestions and review filters. Preserve browser Back/Forward and existing parameters. Global search does not rewrite list filters until a result is selected.
- Suggested module areas: lib/journal/search.ts, suggestions.ts, data-checks.ts; matching hooks/components in journal/search, journal/suggestions, journal/mobile, and settings. Follow existing repository conventions during implementation.
- Draft and mutation guards apply across overlays. One active editing draft at a time; opening another feature must not lose or overwrite it.
- Reads may use retained loaded data with a visible freshness indication after connection loss. Saving stays online; this plan does not add offline synchronization.

## Delivery order

1. Global search and shared entry navigation. Verify search behavior, grouping, focus, and URL history.
2. Mobile quick editing, shared save behavior, and touch/keyboard guards. Preserve desktop behavior and session undo.
3. Deterministic suggestions with the confirmed candidate pool and total-duration filter.
4. Derived data checks, settings/dismissal persistence, backup compatibility, and the separately approved database rollout.

Complete and verify each increment before starting the next. Use a dedicated implementation branch when implementation is requested. No automatic merge/push/deploy is included.

## Verification and acceptance

- Search: accents/punctuation, duplicate titles versus intentional replays, filters hiding results, loading/refresh failures, deleted entries, keyboard navigation, focus restoration, and Back/Forward.
- Mobile: real touch scrolling does not open an editor or save; pencil and form controls have usable targets; no initial keyboard pop-up; dirty close paths, complete-form draft transfer, repeated taps, failed saves, conflicts, status-derived dates, and Undo. Test narrow phones, wide coarse-pointer tablets, and desktop regression flows.
- Suggestions: owned/family aliases, started versus unstarted entries, paused replays, future/uncertain releases, explicit exclusion of No terminado while including En pausa, numeric/textual priority, missing Hype, known/unknown platforms, estimate targets, zero/missing/ambiguous estimates, total-length limits, distinct-game results, and URL persistence. Verify that using suggestions causes no Steam/Nintendo requests or writes.
- Data checks: inconsistent versus optional data, valid zero values, approximate memories, unrelated edits after dismissal, owner isolation, trash exclusions, reminder preferences, and old/new backup restore compatibility using disposable databases.
- Retain existing date/status/period, filter, sort, import/export, notification, sharing, separate-playthrough, desktop inline editing, and mobile layout coverage.
- Automated tests use mocked APIs and disposable accounts/databases. Do not run destructive tests against personal data. Include a hands-on phone/PWA check before publishing touch changes; emulation alone does not certify real-device behavior.

## Explicitly outside this plan

Play-session tracking, offline writes, new external game APIs, paid services, automatic metadata corrections, automatic game merging, changing existing spreadsheet columns, and automatic production rollout.

## Phase 1 local testing

The shared header now exposes global search with Ctrl+K / Cmd+K. It uses loaded owner records and offers, groups replays by game identity, and navigates through the same entry destination/highlight behavior as notifications. Dirty inline drafts require an explicit save/discard/cancel decision before navigation. The current list filter remains independent. Loading failures are distinct from empty results, and results are rendered in batches of 30 playthroughs. No migration, production SQL, push, or deployment has been performed for this phase. The owner authorized committing the completed work before starting phase 2.

## Phase 2 local testing

Mobile and primary coarse-pointer layouts now use read-only cards with explicit 44-pixel pencils. QuickEditor opens a bottom sheet focused on the game heading, with status and relevant hours/review or priority fields. The shared useInlineEditing.saveDraft path validates revisions, applies canonical saves, and records session Undo. Failed saves keep the draft. Closing a changed panel through its controls, backdrop, Escape, or browser Back requires an explicit discard decision. Refresh/auth/offline limitations remain visible; offline saves are not queued. Abrir formulario completo transfers changes into EntryEditor via initialDraft while preserving the original entry for dirty and revision checks. The overlay history marker stays on the same URL and is removed after closing.

The local automated scenarios cover narrow phones, wide touch devices, a touch swipe beginning on the pencil, save progress/Undo, stale revisions, failed saves, draft transfer, dirty close paths, and offline read-only behavior. These tests emulate touch in Chromium; hands-on phone/PWA verification remains a rollout step. No production SQL, push, or deployment was performed for phase 2, and its new changes remain uncommitted pending a later request.


## Phase 3 local testing

¿Qué juego ahora? is a separate navigation destination. It reads active owner records and existing page/offer identities locally; it does not refresh prices or call external services. Candidates are owned/family unstarted wishlist playthroughs or paused playthroughs. Nonblank play dates/periods or positive recorded hours prevent treating a wishlist entry as unstarted. Abandoned, remembered, playing, completed, upcoming and known future releases are excluded. Same-year approximate releases remain visibly unconfirmed, without inventing hemisphere-specific season dates.

The pure suggestions module chooses one playthrough per game (paused first, latest start date, then stable priority/Hype/title/identity ties). It returns three suggestions per page, with console and total-duration filters, estimate target, explicit unknown-duration inclusion, counts and empty-state explanations. It never subtracts hours already played. Console evidence comes from available-platform metadata and recognized store pages, not the previous play device; available platforms do not establish ownership of a particular edition. URL parameters preserve filters through reload and Back.

Ver juego uses the shared exact-entry destination/highlight. Empezar/Retomar explicitly saves Jugando through the revision-checked canonical save path, preserves existing dates, fills a missing start date through the server's established rule, and supports session Undo. Dirty inline drafts block these actions until saved or cancelled. Loading failures remain distinct from empty results; retained records survive refresh failures. No database migration, production data change, commit, push, deployment or phase 4 implementation is included.


## Phase 4 local implementation

Implementation and verification progress are tracked in [review-journal-data.md](../odd/tasks/review-journal-data.md). The settings panel derives inconsistencies, suggestions and opt-in reminders from all active records; filters persist in the URL. Hiding fingerprints only the relevant facts, and a database trigger invalidates saved dismissals when those facts change. Owner-scoped commands and format-6 recovery state require a separately approved migration. No spreadsheet change or production rollout is included.
