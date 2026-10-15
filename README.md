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
- World settings include editable house names (1–60 characters) and optional descriptions (up to 240). Saving preserves the address and simulation history. Everyone admitted can edit; concurrent house edits require loading the latest details, while time mode and population settings remain independent.
- Fullscreen world viewing from the stage toolbar, with Escape to exit and a page-filling fallback when browser fullscreen is unavailable. Resident profiles, settings, and events remain available.
- Worlds start open by default; optionally protect entry with a password. Their names and descriptions remain public; snapshots, WebSockets, history, and commands require entry.
- Three World v1 templates selectable at creation, with illustrated previews: the common house, the makers’ house, and the harbor house. Each has themed rooms, colors, furnishings, and initial residents. The makers’ house starts with more supplies and creative tension; the harbor house starts with stronger cohesion and modest supplies. All share three floors, an elevator, and vector residents. Travel and stopped ticks alternate; residents board and leave only while stopped. The renderer uses one eased cabin trajectory for all passengers and waits for arrival plus a pause before showing an exit, including when snapshots arrive close together.
- Autonomous movement, energy/rest, mood, belonging, conversations, conflict, friendship, shared resources, evening rituals, and community degradation/recovery.
- Conversation headings use saved titles grounded in revealed dialogue, with nearby titles considered to reduce repetition. A title stays fixed while the exchange unfolds and is finalized once it ends or is interrupted. Procedural exchanges work without AI; old saves retain their topic heading. Identical exchanges can still share a title rather than inventing differences.
- Procedural conversations choose complete 4–6 turn arcs about company, curiosity, rest, play, decisions, help, fairness, recent events, or a grounded callback. Personality, energy, belonging, supplies and trust affect selection and voice; recent pair and neighborhood topics discourage repetition. Active arcs survive saves and only revealed lines become memories. Existing AI requests use the configured provider, with a local guard against replayed exchanges.
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

### Starter residents

Each of the three house templates has 12 authored resident profiles in `src/simulation/residents.ts`. New worlds draw six profiles without replacement (or fewer when the population cap is below six), using the simulation’s seeded RNG. The server already supplies a fresh random seed for each new world; an explicit seed reproduces the selection and simulation. Names, existing traits, and backgrounds stay together. Background details add fictional texture, not new behavior rules or fabricated memories.

Selection runs only in `createWorld`. The selected residents keep the existing per-world `c1`, `c2`, … IDs and are stored in the ordinary version-1 snapshot; loading a house never selects them again. Existing saves, personal histories, and relationship references are unchanged. Automatic later introductions avoid names already used by active or away residents; explicitly entered names remain user-controlled. To extend a roster, add a complete profile and keep names unique within its template. Changing roster contents can change future seed-to-roster results, but cannot change saved residents.

### State and history

SQLite stores a versioned state snapshot and a separate history table. A synchronous transaction atomically persists the current state and new log records. The live snapshot carries the most recent 80 records; all older events are available through the history cursor. Each resident retains up to 64 event-grounded memories, balancing eight salient moments with recent experience. The profile separates fictional background from a dated personal history. Its default view uses a deterministic, display-only summary: at most two sentences/40 words, three distinct defining moments, and one recent recorded tension. Similar consecutive same-day encounters are grouped, with source event IDs and original memories behind native disclosures. Retained history starts collapsed and dialogue is one level deeper. This projection does not delete records, alter simulation recall, infer reconciliation or promises, or treat the retained window as a complete lifetime. Memories carry optional event IDs, kinds, other participant IDs, tone, and salience; old text/time-only saves remain readable without inferred provenance. Only actual participants remember new events; skipped catch-up intervals are never backfilled. `recallMemories(character, { participantIds, minute, limit, beforeEventId })` in `src/simulation/memories.ts` selects relevant context for dialogue. Recent shared social memories provide a fading, capped ±7.5 percentage-point influence on encounter outcomes and can inform procedural dialogue. AI context excludes the current event and future memories. Memory summaries describe encounters without copying dialogue that may later be enriched. Relationship affinity decays toward neutral after long periods without contact, including time away.

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

### If editing reports “Unknown action.”

The house-details form sends `type: "house-details"` to the world's command API.
That command was added in PR #26 to both the Worker validator and simulation
engine. A newer frontend paired with the earlier backend rejects it with HTTP
400 `Unknown action.`; this is not an empty-name, password, or revision error.
The form keeps the draft so it can be retried after the server update.

The deployment must include the Worker and its Durable Object implementation
as well as the built frontend assets from the same checkout. Publishing only
assets cannot add server commands. Follow the normal deployment process above;
do not recreate worlds, change their slugs, or clear stored data. Old snapshots
without `detailsRevision` start at revision zero and can be renamed in place.
A merged PR alone does not deploy this repository: Cloudflare deployment is
managed separately.

For a local reproduction, build the current frontend and run
`node scripts/test-house-details-upgrade.mjs` with an available Playwright
installation (`PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` may select existing tools).
It starts a pre-edit Worker on port 8791, verifies the rejection, upgrades the
Worker over the same isolated SQLite state, and retries the retained draft.
It never contacts the deployed site.

## Verification

```sh
pnpm test                 # deterministic simulation and domain invariants
pnpm build                # strict TypeScript check and production frontend build
pnpm test:integration     # run while pnpm dev:server is active
pnpm test:residents       # isolated SQLite runtime restart across all templates (port 8791)
pnpm test:events          # per-player quotas, multiple tabs, private budgets; about 90 seconds
pnpm exec wrangler deploy --env "" --dry-run --outdir /tmp/kinarium-worker
```

Integration tests exercise actual HTTP/WebSocket/SQLite/alarm behavior, including two-player synchronization, concurrent population enforcement, away/return, invalid origins, passwords, protected history, event cooldowns, and both time modes. They take about 80 seconds because they verify an unoccupied persistent world really advances. They only accept localhost targets, create `test-*` worlds, and leave successful fixtures in fast-forward mode.

### Color themes

The header’s sun/moon icon switches between Light and Dark. Its accessible label names the next action (for example, “Switch to dark mode”). Choices persist in `localStorage` under `kinarium-theme` and sync across tabs. Missing, invalid, or legacy System preferences resolve once from the OS preference and are saved as Light or Dark; later OS changes do not override that choice. If storage is unavailable, switching still works for the current page.

`public/theme.js` resolves the theme before the app paints; `ThemeControl.tsx` subscribes to that controller. `theme.css` extends the existing CSS with semantic surface/text tokens and SVG scene colors. New UI surfaces should use `--surface`, `--surface-soft`, `--text`, `--secondary`, `--muted`, `--line`, and `--control-border`. Theme preference is personal and never changes the simulation’s day/night cycle or shared world settings.

Theme tests cover preference migration, persistence, cross-tab sync, unavailable storage, and palette contrast. For browser verification, switch with Enter and Space, reload each choice, verify that OS changes do not override it, then inspect the directory, dialogs, world, profiles, bonds, and fullscreen at desktop and mobile widths.

## Extending Kinarium

Add an event to `EVENTS`; its controls and effects come from that registry. Add advanced behavior with a validated command or a deterministic simulation system. New templates should register a stable ID and versioned data in `TEMPLATES`; the current renderer is purpose-built for the three-floor house, so a template with different geometry also needs a renderer selected by its template ID. For v1 houses, floor 0 gathers residents, floor 1 restores energy, and residents on floor 2 can perform supply upkeep, with a practical-skill bonus. Optional floor `activity` text and `initialMetrics` customize daily life and starting conditions; omitted values preserve the original common-house behavior. Furniture is selected by template ID in `Building.tsx`. Creation choices and directory previews come from the template registry. A future template generator should produce validated data and select a renderer, never execute generated code. Preserve old template IDs so existing worlds continue to load.

The initial state is schema version 1. Older snapshots without `elevatorPhase` resume from a stopped landing; the next simulation step writes the phase. Add an explicit load-time state migration before changing persisted fields incompatibly. Add a new Wrangler migration only for Durable Object class/storage migrations. World password changes and owner roles are intentionally absent in this version.

### Conversation variety evaluation

`pnpm test` includes a deterministic 360-encounter sample: three settings, five personality pairings, warm and tense encounters, and twelve conversations per fixed pair. Against the previous implementation at `5056043`, unique transcripts summed within those sequences increased from 75 to 210; distinct topics from 30 to 150. Adjacent repeated topics fell from 330 to 90, all explicit revisit arcs; no identical arcs occurred consecutively. This finite scripted sample does not prove unlimited novelty or measure live-model quality. Event-specific scenarios, saved-state continuity and provider rejection/fallback have separate tests.

With Vite running and Playwright installed, `node tests/conversation-variety.browser.mjs` checks procedural threads and stable headings at 1440/390/320px. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` for an external installation. AI tests use mocked responses; no new provider or additional inference calls are added.

### Character influence on dialogue

Dialogue snapshots each speaker’s state at encounter creation. Trait changes can alter the selected subject and topic-specific replies (including each event), while low energy or mood can change the ending. Low belonging introduces cautious inclusion questions. Trust and affinity are separate: a candid exchange need not imply affection or agreement. Neither speaker can assert the other’s private feelings.

Memory callbacks require participant/event metadata, reject future or contradictory/active source records, and quote only a short complete excerpt in its owner’s voice. Archived source records may be absent; legacy prose remains readable but does not gain invented attribution. Unrevealed scripted lines remain outside memory and title evidence.

`tests/dialogue-influence.test.ts` holds seeds and unrelated inputs fixed while independently varying both speakers’ traits, energy, mood, belonging, relationships and memory content. Both configured AI paths receive derived delivery cues and simulated energy (no added raw history/backstory or provider); exhausted multi-turn responses are capped at three replies, with procedural fallback on rejection. Prompt tests use mocks, so they verify instructions/data and enforced pacing, not live-model semantic obedience. State is a tendency, not a guarantee that every changed value changes every line.

After these influence changes, the existing 360-encounter variety sample yields 246 distinct transcripts summed within fixed-pair sequences and 66 adjacent repeated topics (intentional callbacks), versus 210 and 90 in PR #28.

### Resident state explanations

Resident profiles show ongoing mood, energy and belonging factors separately from recorded direct changes. `residentDrift` in `src/simulation/resident-state.ts` is shared by the engine and display: it preserves the existing step order (clock, drift, movement, encounters), including post-decay belonging in the mood calculation. The display projects the next drift step under current conditions, not future encounters. It distinguishes downward/upward pressure from actual changes at 0 or 100. Energy has no direct mood effect.

`Character.stateChanges` is optional version-1 data: at most eight actual discrete-effect deltas, each with simulation minute, factual cause label and source event ID. The profile shows up to three from the past simulated day. No history, memory text, dialogue or fictional background is used to invent attribution for old saves; older journal entries may be archived independently. Routine drift is calculated, not accumulated into this event list.

Integration contract for new behavior: capture `residentStats(character)` before a discrete stat effect, apply the effect using the engine's bounds, then call `recordResidentChange(character, before, world.minute, factualCause, sourceEvent.id)`. Record only actual participants, once per event per resident. The helper records deltas only; it does not apply effects, draw randomness or infer repair. A successful repair should receive its own factual label and real event ID rather than be inferred from a warm conversation. Any new ongoing stat factors must be added to the shared drift calculation and its UI labels together.

With Vite running, `PLAYWRIGHT_MODULE=<path-to-playwright/index.mjs> node tests/resident-state.browser.mjs` checks the resident sidebar and insights modal, legacy saves, away residents, limit behavior, keyboard disclosures and light/dark layouts at 1440/390/320px using local mocked transport and real simulation fixtures. It never contacts the live world.
### Avoidance and repair

Trust weights both nearby partner selection and willingness to start an encounter.
At trust 0, willingness is 12%; at 30 it is 64.8%; at 50 or more it is 100%.
These are conditional on the existing location, travel and conversation checks,
not per-tick encounter rates. The nonzero floor leaves opportunities to reconnect.

Finished disagreements retain their topic and source event on the relationship,
even when the snapshot's recent history is archived. After at least 120 simulated
minutes, rested residents can offer to listen. The response depends on the other
resident's temperament, mood, trust and community tension. A refusal is respected,
gives no trust, and starts another cooling period. An accepted offer earns only
one trust point; the same resident must later follow through by asking for and
respecting a choice before earning seven more. Affinity remains separate, so this
need not make them friends. Another conflict cancels the pending commitment.
Interrupted repair earns nothing; saved arcs resume normally. Repair dialogue is
procedural so AI cannot replace the action or response that earns the outcome.
Only revealed dialogue enters memories, and the completed history entry explains
the consequence. All new persisted fields are optional for existing worlds.

`tests/repair.test.ts` compares 30 seeded low/high-trust runs and exercises refusal,
interruption, delayed follow-through, new conflict, archival and save continuity.
Twenty seeded kind pairs can complete repair over three simulated days; this is
an achievable path, not a guarantee for every temperament or distressed world.
`tests/repair.browser.mjs` checks the local journal at 1440/390/320px without live
world requests, using the same Playwright configuration as other browser tests.

Repair integration: completed repair currently changes relationship scores and house tension, not resident mood, energy or belonging directly. It therefore adds no direct resident-stat record; the new tension value is reflected in ongoing mood pressure. Ordinary encounter and house-event records retain their existing effects.

### Supplies and simulation consistency

Residents can replenish supplies autonomously at an energy and time cost. The supply panel visualizes shortage pressure, reserve thresholds, current work and recorded results; profiles include the real energy cost and mood's ongoing recovery factor. Relationship labels now distinguish familiarity, trust and unresolved history across all views. See [the diagnosis, rules, compatibility notes and seeded evaluation](docs/simulation-recovery.md) for the actual formulas and their limits.
### Resident memory summaries

The existing **Story so far**, defining moments, recent tension and retained-history
projection is deterministic and display-only. No model/provider requests are made;
memories, archived history and dialogue recall/influence remain unchanged.
Each resident's projection and input fingerprint are saved with the world. Missing
legacy caches initialize on the next save. At persistence boundaries, a changed
projection refreshes no more than once per **60,000 milliseconds of real time**.
Unchanged inputs do not regenerate or advance the freshness timestamp. Inputs are
retained memories, referenced participants' names, referenced event provenance and
topic/status, plus memory visibility and one-simulated-day tension expiry boundaries.
Movement, needs, presence, unrelated events and planned dialogue do not invalidate it.
Away residents use the same policy. Inactive catch-up worlds do no background work;
changes refresh on the first eligible save after resuming. Existing occupied ticks
and unoccupied persistent-world alarms supply the cadence; no new timer is created.
Profiles show the simulated time of the last summary and flag pending input changes.
During the throttle window disclosures show the last summarized records; authoritative
original memories and archived history are never rewritten. Legacy/offline snapshots
without a cache use a memoized local projection until a server save supplies one.
