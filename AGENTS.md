<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Agent Routing

- The main agent coordinates and scopes work, assigns bounded tasks, reviews outcomes, owns integration decisions and Git, and maintains task records.
- Delegate application code, tests, and implementation documentation to a worker by default, including small implementation tasks. The main agent does not implement them unless the user explicitly asks.
- Use `gpt-6.2-sol` at medium reasoning when the worker must decide how a UI should look or behave, investigate an unclear problem, or weigh implementation tradeoffs. Keep the resulting implementation, tests, and relevant documentation with that worker.
- Use `gpt-6-luna` at high reasoning for straightforward coding when the behavior and approach are already clear. This includes implementing a fully specified UI change. Keep its tests and relevant documentation in the same assignment.
- If Luna uncovers a material decision, it pauses the affected work and reports the decision and what it has verified. The main agent hands technical or UI tradeoffs to Sol. When the decision depends on product intent, the main agent asks the user one focused question and waits for the answer. Keep one writer per affected file throughout the handoff.
- If `gpt-6-luna` is unavailable, use `gpt-6.2-sol` at medium reasoning for the same bounded implementation. If a task requires Sol and Sol is unavailable, ask the user before substituting another model.
- Use an explorer with `gpt-6.2-sol` at medium reasoning only when an unfamiliar area needs a map before the work can be scoped.
- Use an independent verifier with `gpt-6.1-sol` at medium reasoning for consequential ownership, authentication, data, concurrency, or backup changes, or when the user explicitly requests a review. Do not add verification agents to routine edits without a concrete risk.
- This project override supersedes earlier inline-implementation and writer-trigger defaults. Existing authorization, SQL review, no-push/deploy, and safety requirements remain applicable.
