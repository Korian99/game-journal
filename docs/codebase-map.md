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

This readability refactor keeps the API contracts, database schema, styles, UI labels, and existing behavior unchanged.

## Checks

Run npm test for the unit tests, npm run build for the production build, and npm run typecheck for TypeScript. Browser tests live under e2e; authenticated tests require a disposable fixture account as described in the README. SQL integration checks live under tests and use rollback transactions.
