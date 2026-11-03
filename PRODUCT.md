# Kinarium

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who enjoy observing emergent social stories and gently influencing a shared community. Returning to follow residents, relationships, and the consequences of earlier events is the core appeal. The audience and appeal were confirmed by the product owner on November 3, 2026; narrower demographics and usage patterns remain unspecified.

## Product Purpose

Kinarium is a persistent, multiplayer community playground. Visitors watch a simulated household unfold, learn about its residents, and introduce changes that become part of its shared story. Product success means supporting that interest in the community and its evolving stories; quantitative success measures have not been defined.

## Positioning

The current experience combines a shared, authoritative simulation with autonomous residents, evolving relationships, conversations, and accumulated history. Visitors influence the conditions of community life through events and resident introductions. This describes the product's mechanism, not a verified competitive or market-uniqueness claim.

## Operating Context

- Visitors browse or search the public neighborhood directory, enter an existing world, or create a house from a template. A password can protect entry while the house name and description remain public.
- Within a world, visitors watch the house, inspect resident profiles, follow conversations, read the journal, and explore bonds and community insights.
- Visitors can introduce residents, edit their names and appearance, arrange reversible time away, trigger bounded house events, and change world settings.
- “Observers” are the people watching; “residents” are simulated characters. Presence currently represents anonymous browser identities, not verified people.
- Time can continue while a world is empty or catch up when someone returns. Detailed replay after long absences is bounded.
- The browser client uses React, TypeScript, and Vite. Cloudflare Workers and SQLite-backed Durable Objects provide shared simulation state, persistence, and WebSockets. See README.md for technical details and current limits.
- Local development uses `pnpm dev` at `http://127.0.0.1:5173`, with the local backend on port 8787 and AI generation disabled by default.

## Capabilities and Constraints

The following are current behavior, explicitly confirmed by the product owner as open to change rather than permanent product commitments:

- No objectives, score, or win state.
- Autonomous residents rather than direct character control.
- Equal influence for everyone admitted to a world, including settings; no accounts or owner-only controls.
- Persistent world history and saved relationships, with bounded resident memories and summaries that may cover only retained records.
- Optional AI dialogue enrichment with procedural fallback. Generated words do not themselves change authoritative simulation state.

The existing simulation renderer remains an explicit implementation constraint from prior product context. A separate protected admin route supports operational house deletion; equal influence describes admitted visitors within a world.

Other implemented capabilities include multiple house templates, resident mood/energy/belonging, distinct affinity and trust, conflict and repair, nearby group conversations, shared resources, and server-enforced event allowances. README.md, the field guide, and implementation remain the detailed references for evolving behavior and limits.

Open decisions: future changes to the mechanics above, narrower audience segments, measurable success criteria, and product-specific accessibility requirements. No additional binding voice or visual commitments were established during initialization.

## Brand Commitments

Kinarium is the existing product name. Prior context requested a less generic landing UI without pinning a specific palette or typeface; the resulting visual system is recorded in DESIGN.md.

## Existing Landing Decisions

Prior confirmed context makes discovering and entering houses the primary landing action, with creation still available. The landing audience is curious visitors exploring a shared simulation, watching residents, and influencing a community together. Surface-specific direction lives in `.impeccable/surfaces/src-client-main-tsx.md`.

## Evidence on Hand

- `README.md`: documented workflows, architecture, operational limits, and validation commands.
- `src/client/FieldGuide.tsx`: user-facing guidance tied to shipped controls.
- `src/client/main.tsx`: directory, world navigation, resident interactions, and settings.
- `src/client/Building.tsx` and `public/favicon.svg`: existing house/resident rendering and identity assets.
- `src/simulation/catalog.ts` and `src/simulation/residents.ts`: authored templates and fictional resident backgrounds. These are product content, not customer evidence or records of simulated events.
- `src/simulation/` and `tests/`: implementation and regression evidence for simulation behavior; not evidence of user demand or commercial outcomes.

No customer testimonials, adoption metrics, or comparative performance claims were established in this initialization. Future copy must not invent them.

## Product Principles

1. Help visitors follow emergent social stories and understand the community they are watching.
2. Make the available ways to influence a community understandable and their recorded consequences discoverable.
3. Treat current mechanics as revisable product decisions; evaluate changes against the confirmed audience and purpose.
