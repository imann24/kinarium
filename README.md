# Kinarium

[Play Kinarium](https://kinarium.isaiahbmann.workers.dev)

A persistent, multiplayer community playground. No objectives or win state: the simulation, relationships, conversations, and accumulated history are the game.

## Run locally

Use Node 24 (or Node ≥22.13) and pnpm 11.9.0. `.nvmrc` and `packageManager` pin the development toolchain.

```sh
nvm use
corepack enable
pnpm install
pnpm dev
```

Open **http://127.0.0.1:5173**. One command starts Vite with hot reload and the actual Cloudflare local runtime, including SQLite persistence, alarms, and WebSockets. Local world data is retained in `.wrangler/state/` across restarts. It is ignored by Git and is not uploaded during deployment.

Vite proxies `/api` and WebSockets to port 8787. Server source changes reload automatically through Wrangler. To preview the production build without Vite, run `pnpm build` followed by `pnpm dev:server`, then open http://localhost:8787. The two services can also be run separately with `pnpm dev:server` and `pnpm dev:client`.

## What works

- `/`: searchable public world directory, open-door and persistent-mode filters, creation dialog, field guide.
- `/w/<slug>`: one shared authoritative simulation, live anonymous observer presence, automatic reconnection.
- Fullscreen world viewing from the stage toolbar, with Escape to exit and a page-filling fallback when browser fullscreen is unavailable. Resident profiles, settings, and events remain available.
- Worlds start open by default; optionally protect entry with a password. Their names and descriptions remain public; snapshots, WebSockets, history, and commands require entry.
- Three World v1 templates selectable at creation, with illustrated previews: the common house, the makers’ house, and the harbor house. Each has themed rooms, colors, furnishings, and initial residents. The makers’ house starts with more supplies and creative tension; the harbor house starts with stronger cohesion and modest supplies. All share three floors, an elevator, and vector residents. Travel and stopped ticks alternate; residents board and leave only while stopped. The renderer uses one eased cabin trajectory for all passengers and waits for arrival plus a pause before showing an exit, including when snapshots arrive close together.
- Autonomous movement, energy/rest, mood, belonging, conversations, conflict, friendship, shared resources, evening rituals, and community degradation/recovery.
- Pairwise affinity and trust; bounded personal memories; a durable, paginated world history.
- Six extensible events with a shared 45-second world cooldown and a separate allowance of 3 events per player per world in any rolling 5-minute window: shared meal, gift, story night, common project, outage, rumor.
- Adjustable active population cap (1–40), new residents, reversible time away. Away residents retain memories and relationships and do not count against the cap. Maximum 200 total archived/active residents per world for this first version.
- Persistent or fast-forward time, configurable for each world.
- Optional, budget-limited AI dialogue, using Cloudflare Workers AI by default.

There are deliberately no accounts, ownership privileges, direct NPC controls, or objectives. Everyone admitted to a world has the same influence, including settings. Presence represents browser identities, not verified people; multiple tabs with the same identity are grouped.

Event allowances are enforced on the server and saved in SQLite, atomically with successful events. A per-world, HttpOnly anonymous player cookie shares the allowance across tabs and refreshes; changing an observer name does not reset it. Failed events do not spend an allowance. The UI shows remaining events, refill progress, and separate personal/world countdowns using server time. Without accounts, clearing cookies or switching browsers creates a new anonymous player. Change the limits in `src/simulation/event-budget.ts`.

## Architecture and technology choice

**React + TypeScript + Vite** for the browser. **Cloudflare Workers + SQLite-backed Durable Objects** for the backend and database. Worker static assets serve the SPA from the same origin.

Each world is a Durable Object: a single authority serializes mutations, stores its own SQLite state/history, broadcasts snapshots through hibernatable WebSockets, and uses durable alarms for autonomous time. A separate directory Durable Object stores public summaries and enforces unique slugs. No external database, D1 provisioning, Redis, persistent VM, or always-running Node server is required.

This topology fits small shared simulations better than stateless function handlers coordinating a separate database. The storage engine is SQLite, managed inside Cloudflare. The tradeoff is that multiplayer transport, storage, and alarms are Cloudflare-specific. The simulation itself is plain TypeScript and portable.

Cloudflare offers usage-based pricing with free allowances. An occupied world ticks every 4 seconds; an empty persistent world wakes every minute (about 43,200 alarm invocations per 30-day month, plus storage writes). Empty fast-forward worlds schedule no future alarms. World count, activity, log growth, and AI usage determine cost; always-on worlds are not cost-free. Review the current [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) before scaling.

### Code boundaries

| Area | Responsibility |
| --- | --- |
| `src/simulation/types.ts` | Versioned world state and shared command protocol |
| `src/simulation/catalog.ts` | Template, trait, color, and event registries |
| `src/simulation/engine.ts` | Deterministic simulation and commands; no React, network, database, or model dependencies |
| `src/server/index.ts` | Directory, authentication, persistence, alarms, multiplayer, validation, rate limiting |
| `src/server/security.ts` | Bounded JSON requests, password hashing, cookies, origin checks |
| `src/server/llm.ts` | Replaceable model-provider adapter; dialogue only, never authoritative state |
| `src/client/Building.tsx` | SVG rendering and selection; no simulation or server mutations |
| `src/client/main.tsx` | Interaction controls, directory, profiles, history, settings, WebSocket client |

### Time

One 4-second real-time tick advances 2 simulated minutes; a simulated day is 48 real minutes.

- **Occupied:** durable alarms every 4 seconds, shared by all visitors.
- **Persistent and empty:** alarms approximately every minute, replaying the intervening ticks. The world continues without a browser. Alarm timing is best-effort, not a real-time scheduling guarantee.
- **Fast-forward and empty:** no recurring alarm. On return, elapsed ticks are replayed before the snapshot is sent.
- Catch-up is bounded to 720 detailed ticks (one simulated day) per invocation. Longer gaps advance the clock across the older quiet interval and record that compression explicitly. There are no offline LLM calls.
- The durable wall-clock cursor prevents duplicate simulation ticks on alarm retries.

### State and history

SQLite stores a versioned state snapshot and a separate history table. A synchronous transaction atomically persists the current state and new log records. The live snapshot carries the most recent 80 records; all older events are available through the history cursor. Each resident retains up to 64 event-grounded memories, balancing eight salient moments with recent experience. The profile separates fictional background from a dated personal history. Memories carry optional event IDs, kinds, other participant IDs, tone, and salience; old text/time-only saves remain readable without inferred provenance. Only actual participants remember new events; skipped catch-up intervals are never backfilled. `recallMemories(character, { participantIds, minute, limit, beforeEventId })` in `src/simulation/memories.ts` selects relevant context for dialogue. Recent shared social memories provide a fading, capped ±7.5 percentage-point influence on encounter outcomes and can inform procedural dialogue. AI context excludes the current event and future memories. Memory summaries describe encounters without copying dialogue that may later be enriched. Relationship affinity decays toward neutral after long periods without contact, including time away.

The directory is an eventually updated summary, not a continuously live view of every world. It currently returns up to 500 worlds. Each world accepts up to 64 simultaneous WebSocket connections. These are explicit first-version limits; larger deployments should add directory pagination, monitoring, and log archival.

## Optional AI

Production uses **Cloudflare Workers AI** through the native `AI` binding. Inference runs in the same Cloudflare account as the Worker; it needs no separate provider API key. The default is Llama 3.1 8B FP8 Fast, an inexpensive, non-reasoning model for brief dialogue. Provider-specific code stays in `src/server/llm.ts`; the simulation has no model dependency.

Defaults in `wrangler.jsonc`:

```text
LLM_PROVIDER=cloudflare
LLM_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8-fast
LLM_DAILY_CALL_LIMIT=240
```

Set `LLM_PROVIDER=disabled` to use only procedural dialogue. Errors, quota exhaustion, and malformed responses also preserve procedural dialogue. There is no automatic retry or cross-provider fallback.

`pnpm dev`, `pnpm dev:server`, and `pnpm preview` select the `local` Wrangler environment, which omits the remote AI binding and disables generation. No Cloudflare login or inference charges are required for ordinary development. Wrangler may warn that `env.local` does not inherit `ai`; this omission is intentional. To test real Workers AI, log in with `pnpm exec wrangler login`, then run `pnpm dev:server:ai` and `pnpm dev:client` in separate terminals. This deliberately opts into real Cloudflare inference and metered usage; [Workers AI has no local emulator](https://developers.cloudflare.com/workers/local-development/).

To switch to Vercel AI Gateway or another OpenAI-compatible Chat Completions service, set `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, and `LLM_MODEL`, and store `LLM_API_KEY` with `pnpm exec wrangler secret put LLM_API_KEY`. For local testing, copy `.dev.vars.example` to `.dev.vars.local` and fill in those values. The old `AI_GATEWAY_API_KEY` secret remains supported as an alias, but provider selection is explicit. When deploying with a compatible provider, remove the unused `ai` binding if desired. Secrets and environment-specific `.dev.vars` files are ignored by Git.

Conversations are persistent threads with alternating turns, revealed every six simulation minutes. Residents stay together while talking; departures interrupt the thread. Completed exchanges enter both residents’ memories. AI plans 3–7 responsive replies using the transcript, personalities, backstories, memories, relationship, prior exchange, and recent events. It runs only while observers are connected, at most one request at a time, at least eight seconds apart, and 240 attempts per world per UTC day by default (configurable up to 10,000). Requests have a 900-token output limit and six-second cancellation signal. Each thread gets one attempt; failures consume the reserved allowance and keep procedural replies. Stale results are discarded. AI turns are individually labeled in expandable journal threads. Older one-line history remains readable. Limits are per world, not a deployment-wide dollar cap; monitor account usage as world count grows.

As of October 2026, [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) lists a shared free allocation of 10,000 neurons/day and this model at $0.045/million input tokens and $0.384/million output tokens. At an illustrative 500 input tokens and the full 90 output tokens, 24 calls/day for 30 days is roughly **$0.04/world/month for inference before the free allocation**, excluding Worker, storage, and other application costs. Actual prompt sizes and usage vary. Model quality and end-to-end latency need validation with live inference.

Model generation of names, backstories, memories, rituals, and events is not needed for v1; those currently come from the simulation. The adapter boundary is ready for additional content generators. Never let generated prose issue commands or mutate authoritative state.

## Deploy

Deploy this app to your Cloudflare account as one Worker, including its Workers AI binding.

```sh
pnpm exec wrangler login
pnpm deploy
```

Wrangler provisions the SQLite Durable Object classes from the `v1` migration and uploads the built static assets. Choose a unique Worker name in `wrangler.jsonc` if needed. The default deployment enables metered Workers AI within the limits above; set the top-level `LLM_PROVIDER` to `disabled` before deploying for procedural-only play. The first directory visit initializes The Common House. Custom domains can be attached in Cloudflare. No production deployment or paid resources are provisioned by local development.

## Verification

```sh
pnpm test                 # deterministic simulation and domain invariants
pnpm build                # strict TypeScript check and production frontend build
pnpm test:integration     # run while pnpm dev:server is active
pnpm test:events          # per-player quotas, multiple tabs, private budgets; about 90 seconds
pnpm exec wrangler deploy --env "" --dry-run --outdir /tmp/kinarium-worker
```

Integration tests exercise actual HTTP/WebSocket/SQLite/alarm behavior, including two-player synchronization, concurrent population enforcement, away/return, invalid origins, passwords, protected history, event cooldowns, and both time modes. They take about 80 seconds because they verify an unoccupied persistent world really advances. They only accept localhost targets, create `test-*` worlds, and leave successful fixtures in fast-forward mode.

## Extending Kinarium

Add an event to `EVENTS`; its controls and effects come from that registry. Add advanced behavior with a validated command or a deterministic simulation system. New templates should register a stable ID and versioned data in `TEMPLATES`; the current renderer is purpose-built for the three-floor house, so a template with different geometry also needs a renderer selected by its template ID. For v1 houses, floor 0 gathers residents, floor 1 restores energy, and practical residents on floor 2 replenish resources. Optional floor `activity` text and `initialMetrics` customize daily life and starting conditions; omitted values preserve the original common-house behavior. Furniture is selected by template ID in `Building.tsx`. Creation choices and directory previews come from the template registry. A future template generator should produce validated data and select a renderer, never execute generated code. Preserve old template IDs so existing worlds continue to load.

The initial state is schema version 1. Older snapshots without `elevatorPhase` resume from a stopped landing; the next simulation step writes the phase. Add an explicit load-time state migration before changing persisted fields incompatibly. Add a new Wrangler migration only for Durable Object class/storage migrations. World password changes and owner roles are intentionally absent in this version.
