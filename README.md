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
- Relationship stories saved with each pair, independent of the retained journal: how they first met, when they became friends, the subjects and shared events that drew them closer or pushed them apart (up to five each, ranked by how far they moved affinity, with mended disagreements marked), and each resident’s side: who reaches out, who offered repair, kept their word or asked for space, and the words they remember hearing. Insights reads a selected connection as a story built only from these records. AI dialogue receives the subject names, not the stored story.
- Six extensible events with a shared 45-second world cooldown and a separate allowance of 3 events per player per world in any rolling 5-minute window: shared meal, gift, story night, common project, outage, rumor.
- Adjustable active population cap (1–40), new residents, reversible time away. Away residents retain memories and relationships and do not count against the cap. Maximum 200 total archived/active residents per world for this first version.
- Persistent or fast-forward time, configurable for each world.
- Optional, budget-limited AI dialogue, using Cloudflare Workers AI by default.

There are deliberately no accounts, ownership privileges, direct NPC controls, or objectives. Everyone admitted to a world has the same influence, including settings. Presence represents browser identities, not verified people; multiple tabs with the same identity are grouped.

Event allowances are enforced on the server and saved in SQLite, atomically with successful events. A per-world, HttpOnly anonymous player cookie shares the allowance across tabs and refreshes; changing an observer name does not reset it. Failed events do not spend an allowance. The UI shows remaining events, refill progress, and separate personal/world countdowns using server time. Without accounts, clearing cookies or switching browsers creates a new anonymous player. Change the limits in `src/simulation/event-budget.ts`.

On touch screens an event card triggers on a single tap: the hover lift only applies where a fine pointer can hover, so iOS never spends the first tap on hover. The allowance, the shared cooldown and the disabled state while a request is pending are the safeguards against accidental triggers; there is no confirm step. `tests/one-tap-events.browser.mjs` checks this with local snapshots on an emulated phone at 390/320px in light and dark.

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

Set `LLM_PROVIDER=disabled` to use only procedural dialogue. Errors, quota exhaustion, and malformed responses also preserve procedural dialogue. There is no cross-provider fallback. Models in the registry (`src/simulation/dialogue-models.ts`) retry once on the default model when the request errors or returns nothing; each such request reserves a second call from the daily budget up front. Malformed JSON is not retried.

`pnpm dev`, `pnpm dev:server`, and `pnpm preview` select the `local` Wrangler environment, which omits the remote AI binding and disables generation. No Cloudflare login or inference charges are required for ordinary development. Wrangler may warn that `env.local` does not inherit `ai`; this omission is intentional. To test real Workers AI, log in with `pnpm exec wrangler login`, then run `pnpm dev:server:ai` and `pnpm dev:client` in separate terminals. This deliberately opts into real Cloudflare inference and metered usage; [Workers AI has no local emulator](https://developers.cloudflare.com/workers/local-development/).

To switch to Vercel AI Gateway or another OpenAI-compatible Chat Completions service, set `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, and `LLM_MODEL`, and store `LLM_API_KEY` with `pnpm exec wrangler secret put LLM_API_KEY`. For local testing, copy `.dev.vars.example` to `.dev.vars.local` and fill in those values. The old `AI_GATEWAY_API_KEY` secret remains supported as an alias, but provider selection is explicit. When deploying with a compatible provider, remove the unused `ai` binding if desired. Secrets and environment-specific `.dev.vars` files are ignored by Git.

Server-side model policy uses `LLM_ALLOWED_MODELS` (comma-separated IDs) and `LLM_DEFAULT_MODEL` (one ID). Entries are trimmed and deduplicated; blank entries and malformed IDs (whitespace, unsupported punctuation, or over 200 characters) are discarded. This validates syntax and allowlist membership, not provider availability. An explicitly empty/entirely invalid list disables inference. If the list is omitted, the legacy `LLM_MODEL` supplies a one-model list (or the existing Cloudflare default if absent). The default must belong to the list. When `LLM_DEFAULT_MODEL` is omitted, the legacy model is preferred if allowed; an empty/invalid/disallowed default resolves to the first allowed entry. No credentials or provider endpoints are exposed in snapshots.

For Cloudflare, model IDs use the `@cf/...` prefix. The server tolerates a missing `@` in `LLM_ALLOWED_MODELS`, `LLM_DEFAULT_MODEL`, and legacy `LLM_MODEL`, canonicalizing before deduplication/default matching; compatible-provider IDs are left untouched. Checked-in production values use the canonical spelling. A previously saved bare resident selection is treated as a removed selection and safely uses the default until the resident is assigned a canonical choice.

If model choices appear stale, inspect `models.allowed` and `models.defaultModel` in the world's HTTP response and latest WebSocket snapshot using browser developer tools. The selector renders these values directly: they come from `modelOptions(this.env)` on the Durable Object, not from the saved world or a client-side environment variable. A legacy-only list indicates the runtime did not supply `LLM_ALLOWED_MODELS` (or the browser retained an older snapshot); missing `@` alone does not collapse a three-entry list. A fresh page/reconnect distinguishes stale browser state from a currently returned list. Verify the deployed Worker version, the environment serving the URL, and its deployed variable bindings; `env.local` deliberately has separate disabled-AI settings. The existing `/api/version?nonce=<UUID>` reports the asset build, not the bindings or Durable Object version, so it cannot prove model configuration was deployed. Cloudflare documents [environment-specific variables and dashboard deployment](https://developers.cloudflare.com/workers/configuration/environment-variables/). Correcting repository configuration does not itself modify live dashboard values. No environment forwarding or world reset is needed: local restart coverage verifies that existing saved worlds receive updated runtime configuration in HTTP, command responses and WebSocket broadcasts.

Each resident profile offers a labeled native model selector. The selection is saved as optional `Character.model` through the existing durable snapshot and broadcasts. Default selections remain absent rather than freezing today's default into a save. Legacy saves and removed model selections resolve to the current default; the UI explains removed selections without rewriting history. New disallowed selections are rejected server-side. Changing a selection discards unrevealed plans and invalidates in-flight results from the old selection; existing revealed dialogue remains intact. Failed registry models retry once on the default model (see above); other failures keep procedural dialogue.

Conversations remain persistent alternating threads, revealed every six simulation minutes. When all participants resolve to the same model, one request plans 3–7 turns. When models differ, exactly three sequential requests each author only the next speaker's turn using that speaker's resolved model. Every request carries shared context (personality, state, memories, relationships, previous exchanges, recent events) plus the growing transcript. Wrong speakers and malformed/partial plans are rejected. The engine still reveals turns in order and discards stale plans. Mixed-model requests share one six-second cancellation deadline and allocate 300 output tokens each (900 total); same-model requests retain 900 tokens. Input context is repeated, so mixed-model exchanges can cost more and are more likely to time out. There are no retries. The single in-flight exchange, observer-only generation, eight-second spacing between exchanges, and per-world daily budget remain. Each possible provider request is reserved before I/O (three for mixed models, one otherwise); insufficient remaining budget preserves procedural dialogue. Failed or aborted attempts retain their reservation. This is not an account-wide dollar cap.

All current summaries—resident personal-history projections, conversation titles, directory summaries and community insights—are deterministic local code. None invokes a model. `resolveModel(config)` without a resident selection is the default route for any future model-backed summary; no new summary calls were introduced.

The registry in `src/simulation/dialogue-models.ts` lists vetted Workers AI chat models with labels, prices (Workers AI pricing page, 2026-10-17) and per-model request fields (Gemma 4 gets `chat_template_kwargs.enable_thinking=false`). Per-token prices: Llama 3.1 8B $0.152/$0.287, Llama 3.2 3B $0.0509/$0.335, Gemma 4 26B A4B $0.10/$0.30, Mistral Small 3.1 24B $0.351/$0.555, Llama 3.3 70B fast $0.293/$2.253 (input/output per M tokens); Llama 4 Scout was not price-verified. All are pay-as-you-go on Workers AI beyond the free daily allowance. Reasoning-only models (GPT-OSS, GLM, Kimi, Nemotron) and partner-hosted models (Gemini, Grok) are deliberately excluded: they spend the small output budget on thinking or cost much more. The deployed allowlist and the per-resident selector still decide what is usable; any `@cf` ID can be added to `LLM_ALLOWED_MODELS` and shows its raw ID.

Configuration shipped in `wrangler.jsonc`:

```text
LLM_PROVIDER=cloudflare
LLM_ALLOWED_MODELS=@cf/meta/llama-3.1-8b-instruct-fp8,@cf/meta/llama-3.2-3b-instruct,@cf/google/gemma-4-26b-a4b-it,@cf/mistralai/mistral-small-3.1-24b-instruct,@cf/meta/llama-3.3-70b-instruct-fp8-fast,@cf/meta/llama-4-scout-17b-16e-instruct
LLM_DEFAULT_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8
LLM_DAILY_CALL_LIMIT=240
```

Official model pages checked October 15, 2026: [Llama 3.1 8B FP8](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/) ($0.152/M input, $0.287/M output), [Llama 3.2 3B](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/) ($0.0509/M input, $0.335/M output), and [Mistral Small 3.1 24B](https://developers.cloudflare.com/workers-ai/models/mistral-small-3.1-24b-instruct/). These support the existing messages/max_tokens/temperature and response-string interface. Llama 8B is a conservative default; 3B offers lower input cost, while 24B is an optional larger-model comparison, not a measured quality or latency winner. Consult [current pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and account quotas before enabling choices. No paid benchmarking was performed. The existing `fp8-fast` ID remains a legacy fallback: inconsistent catalog/pricing naming is not evidence that the deployed ID fails. Workers AI output also accepts `choices[0].message.content`; reasoning content is never displayed. Reasoning models are not recommended under this small output budget and timeout without separate validation.

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

Add an event to `EVENTS`; its controls and effects come from that registry. Add advanced behavior with a validated command or a deterministic simulation system. New templates should register a stable ID and versioned data in `TEMPLATES`; the current renderer is purpose-built for the three-floor house, so a template with different geometry also needs a renderer selected by its template ID. For v1 houses, floor 0 gathers residents, floor 1 restores energy, and practical residents on floor 2 replenish resources. Optional floor `activity` text and `initialMetrics` customize daily life and starting conditions; omitted values preserve the original common-house behavior. Furniture is selected by template ID in `Building.tsx`. Creation choices and directory previews come from the template registry. A future template generator should produce validated data and select a renderer, never execute generated code. Preserve old template IDs so existing worlds continue to load.

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

### Resident names

Open a resident profile and choose **Edit name** in the sidebar or expanded panel.
Save applies a trimmed 1–30 character name through the existing world command API;
Cancel or Escape leaves it unchanged. Everyone admitted to the house can rename
residents, including those away. Explicit duplicates are allowed, as with manual
introductions; IDs distinguish residents and automatic introductions avoid used names.

Renaming preserves IDs, personalities, backstories, needs, relationships and recorded
history. Current profile, speaker and relationship labels update for all viewers.
Historical prose keeps its original wording. Unspoken AI plans are discarded and
in-flight results based on old names are ignored; subsequent prompts use current
names and explicitly distinguish them from names in older prose. No extra model
calls or schema migration are needed.

`pnpm test` covers validation, authorization, identity/history preservation, isolation,
SQLite reconstruction and stale inference. `pnpm test:residents` checks real local
runtime restarts and broadcasts. With Vite and Playwright available,
`node tests/resident-name.browser.mjs` checks keyboard editing, cancellation, errors,
repeated edits, two-viewer updates and 1440/390/320px light/dark layouts using local
fixtures. Set `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and optionally `SCREENSHOT_DIR`
as with the other browser tests. These checks do not change production residents
or measure live-model adherence to the prompt.

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

### Expanded speech reading time

Expanded speech stays available for **45 seconds of real browser time from expansion**,
independent of simulation speed or paused/stale snapshots. This replaces the usual
roughly 12-second simulation turn window for text the observer has opened. A subtle
remaining-time bar uses the same monotonic deadline as automatic dismissal. The ×
button (or Escape while focused in the bubble) dismisses the utterance, without
collapsing it or showing it again on the next snapshot. A new utterance from the same
resident starts as a fresh preview, including repeated text with a new turn deadline.
Opening the exact conversation modal remains independent: speech expiry never closes
that modal or moves its focus. Unexpanded speech keeps its normal simulation lifetime.

Browser regression: `tests/speech-dismissal.browser.mjs` uses local snapshots and a
controlled browser clock to check progress, expiry, replacement, dismissal, and focus.

### Nearby group conversations

Warm conversations can include **up to four residents**. Every participant must
be present, outside the elevator, settled on the same floor, and within **20 map
x units** of every other participant (not merely connected by a chain). The
initial pair uses the existing trust-weighted encounter choice. Additional
residents need at least 25 energy and 20 mood, and at least 25 trust with each
participant; reserved residents need 40 energy, and any pair involving a reserved
resident needs 30 trust. Defaults for an unrecorded bond are 30 trust.

Residents can join the opening gathering before its first reply, provided AI
planning has not started. Thereafter membership is fixed. Turns cycle through the
participant list every six simulation minutes, with at most eight procedural
turns. Departure, elevator travel, or leaving proximity pauses the whole thread;
residents can form a fresh gathering later. A resident cannot occupy two active
conversations. Old persisted pair threads retain their original distance behavior
and do not recruit new participants.

Groups reserve three AI calls, one per upcoming speaker using that resident's
selected model, even when all models match. Calls share the growing transcript,
participant-specific memories, attendance boundaries, all relevant bonds, and
the existing six-second deadline. Existing daily budgets, cooldowns, output
validation and procedural fallback remain in force. An invalid or failed response
never installs a partial plan. Generated dialogue never changes simulation state.

The initiating pair keeps its existing relationship/state outcome. Joining or
listening alone grants no pairwise affinity, trust, or repair credit. Memories
name the actual participants and contain only dialogue heard after joining;
unrevealed plans are discarded. Disagreements and repair arcs remain private
pairs: a warm group does not forgive or resolve anyone's conflict.

### Community score details

Hover, focus, click or tap Togetherness, Tension or Shared resources to inspect the score. Details distinguish current per-step pressures from up to five recorded discrete changes in the last six simulation hours. Production/consumption/scarcity explanations share the engine formula; records contain actual bounded deltas and event IDs. Old saves are never backfilled from journal prose. Close with Escape, the close control, the trigger or an outside click/tap.

With Vite running, `PLAYWRIGHT_MODULE=<path-to-playwright/index.mjs> node scripts/test-community-metrics.mjs` exercises all three controls using mocked local worlds, including keyboard, hover, touch, dismissal, light/dark and 1440/390/320px layouts. No live world is changed.

### Reconnection and quiet company

Repair reuses the existing offer/follow-through process. Completed offers restore 1 mood/belonging per resident; later respected choices restore 3, with bounded house relief. Both residents’ mood and temperament, trust, affinity and house tension affect acceptance. Refusals, interruptions and stale/replayed plans cannot earn repair rewards. Ordinary warm contact has a two-hour recovery interval and cannot rebuild trust while conflict remains unresolved.

Quiet company requires 12 continuously observed simulation minutes nearby without conversation or travel. Trust, affinity, mood and temperament determine comfort; unresolved conflict permits only a small respite after cooling down. Recovery is limited to once per resident per four simulation hours, preserves conflict/trust, and is recorded in the journal, resident state changes and recallable memories. Skipped catch-up time does not count as observed company.

### Dialogue engagement

Moderate fatigue (energy 10–29) now produces a shorter exchange that retains its concrete topic and opinion; severe exhaustion below 10 can still end it. Pair contact is possible from energy 10, and group listeners need 15 (25 for reserved residents). Low mood can sound candid rather than automatically withdrawing. AI prompts favor specific opinions, playful disagreement, vulnerable admissions and meaningful bids for connection, while preserving refusal and grounded memories. Procedural taste/invitation scenes and varied repair openings add similar options without inference. More contact can also create more disagreement; these changes do not guarantee harmony or improve repair acceptance odds.

## House administration

Open `/admin` to list houses (including password-protected houses), identify them
by name and exact slug, and permanently delete one. Every admin data/mutation
request requires an authenticated server-side session. The sign-in shell is
public; it contains no house data or credentials. Administration fails closed
until the server secret **`KINARIUM_ADMIN_PASSWORD`** is configured.

### Configure the server secret yourself

Use a long, unique, randomly generated password (at least 32 characters). In the
Cloudflare dashboard, select **Workers & Pages → kinarium → Settings → Variables
and Secrets → Add**, choose **Secret**, enter `KINARIUM_ADMIN_PASSWORD` as the name,
and enter your password as its value. Save/deploy the secret using Cloudflare's
prompt. Do not put it in plaintext Wrangler `vars`, a `VITE_*` variable, GitHub
source, a build variable, a URL, or logs.

Alternatively, from this repository, authenticate Wrangler to your Cloudflare
account and run:

```sh
pnpm exec wrangler secret put KINARIUM_ADMIN_PASSWORD --env ""
```

Paste the value at Wrangler's hidden interactive prompt, never in the command
line. The empty environment selects this repository's production `kinarium`
Worker rather than `env.local`. This command updates the deployed Worker; the
owner should run it when ready. See [Cloudflare's secret configuration guide](https://developers.cloudflare.com/workers/configuration/secrets/).
No credential value is included in this repository or configured by the PR.

Production admin access requires HTTPS. Sign-in creates a random, host-only,
Secure, HttpOnly, SameSite=Strict cookie with a 30-minute absolute expiry; only a
secret-bound hash is stored on the server. The password stays out of browser
storage. Sign out revokes the current session. Changing/removing the server
secret invalidates existing sessions once the updated Worker is serving requests.
Writes (including sign-in/sign-out) require an exact same-origin `Origin` header;
cross-site requests are rejected. Persistent limits allow at most 5 sign-in
attempts per connection and 50 globally per 15 minutes, including successful
attempts. A distributed attack can temporarily prevent sign-in; wait for the
window indicated by `Retry-After`. Use the same hostname throughout a session.

### Deletion and retries

Deletion requires typing the **exact slug**, without trimming or case folding,
and pressing the explicitly destructive confirmation button. It cannot be undone.
The directory first permanently retires that slug and removes only its listing.
The room then atomically records a tombstone and erases its state, history,
password/session data, limits, and players; clears cached state; cancels pending
inference; closes sockets; disables automatic socket replies; and deletes its
alarm. Already-issued AI requests may finish at the provider, but their results
are discarded and further turns are not requested. In-flight commands/init are
serialized with deletion; late index/init/seed responses cannot restore listings.

A successful response means room cleanup was acknowledged. If a request fails,
refresh `/admin` before deciding whether to retry. **Cleanup pending** means the
address is retired but cleanup is not confirmed; the room may still be running
if the cleanup call did not reach it. Retry the same slug (with the same typed
confirmation) until it is marked deleted. Repeated requests are safe, including
a lost success response. Nothing automatically restores or silently resets a
house. A small permanent slug/tombstone record is retained in both objects to
prevent resurrection; all house content is erased. Deleted slugs **cannot be
reused**, including `the-common-house`, which will no longer be auto-seeded.
Choose a different slug for a new house. Do not manually clear tombstones or roll
back to code that does not honor them. Cloudflare's platform retention/backups are
outside this application's deletion operation.

### Local admin verification

Use disposable local storage, never production houses. Set a throwaway
`KINARIUM_ADMIN_PASSWORD` in ignored `.dev.vars.local`, run `pnpm build`, then:

```sh
pnpm exec wrangler dev --env local --port 8794 --persist-to .wrangler/admin-test
# In another terminal, with Playwright installed (or PLAYWRIGHT_MODULE set):
node --env-file=.dev.vars.local scripts/test-admin.mjs
```

The browser test only accepts localhost/127.0.0.1 and deletes disposable fixtures
and the local default house. Loopback HTTP uses a distinct HttpOnly local cookie;
remote HTTP admin requests are rejected. For missing-secret behavior, start with
no local secret and verify `/api/admin/houses` returns 503. Unit tests cover
session expiry/rotation, guess limits, failures/retries, in-flight inference,
alarm/index/init races, permanent retirement, default seeding, and isolation.
