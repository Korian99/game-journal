# Game Journal improvement roadmap

Approved 21/10/2026. Offline creation/editing was removed from this rollout at the owner's request before release. The app remains online for saving. The original implementation scope excluded spreadsheet edits, paid services, pushes, deployments and production SQL execution. The owner later requested commit, push and deployment on 21/10/2026. Production SQL still requires review and explicit approval.

## Retained scope

1. Typed and validated API boundaries, independent resource loading, stable errors, coalesced Realtime refreshes, canonical save responses, four editor tab components, unsaved-change protection, CI and documentation.
2. Thirty-day playthrough trash, ten-second undo, restore, confirmed permanent deletion, sharing revocation, import and worker eligibility guards.
3. Private Google Drive JSON + Excel backup bundles with SHA-256 manifests, resumable file IDs, 30 daily and 12 monthly bundles. Internal snapshots stay at 03:00 Argentina; external copying starts at 03:15, with hourly retries.
4. Duplicate warnings with explicit choices, validated quick actions, notification history with exact unread counts, and a separate Estadísticas tab with estimate targets.

## Local delivery

- Reliability, trash, backup code, statistics, notifications and quick actions are implemented locally.
- Tests use mocked external services, synthetic records and isolated disposable PostgreSQL containers.
- A JSON + Excel + manifest upload simulation is restored into a fresh empty database, with explicit owner mapping, trash and private review preservation, and sharing disabled.
- A real Google authorization and an actual Drive upload/restore cycle still require setup. Local mocked recovery is not recorded as a production recovery verification.
- Offline queues, IndexedDB, local write settings, synchronization endpoints and their migration were removed. Connection-loss messages and unsaved-form warnings remain.

## Rollout

Read the actual SQL before requesting execution approval:

1. 20261022104421_recoverable_playthrough_trash.sql
2. 20261022104436_external_drive_backups.sql

Apply migrations before releasing the corresponding server code. Existing save RPCs and push subscription endpoints remain available for older clients. Review the live migration history before execution. The three pending migrations were applied in production on 22/10/2026 after the owner's explicit approval; pre/post counts were unchanged.

See improvements-setup.md for private OAuth setup, Cron configuration and recovery. Full production recovery remains a separate supervised operation.

## Verified before the Diario redesign

161 unit tests passed (one optional live-store test skipped); seven mocked browser tests passed; fourteen SQL checks plus a separate empty-database recovery passed. Lint, TypeScript and the production build passed. These are local results, not deployment or Google authorization confirmation.

## Review after the Diario corrections

See [implementation-review.md](implementation-review.md) for the requirement matrix, four reproduced and fixed reliability gaps, latest verification, and live setup still pending. The final badge fallback is numeric Impresiones × 10, never Memorabilidad. The foundation and later UI/review changes are committed. Publishing must follow the approved database rollout.
