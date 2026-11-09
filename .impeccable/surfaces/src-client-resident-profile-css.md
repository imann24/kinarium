---
version: 1
slug: "src-client-resident-profile-css"
primary_target: "src/client/resident-profile.css"
related_targets: ["src/client/main.tsx","src/client/PersonalHistory.tsx","src/client/ResidentNameEditor.tsx","src/client/ResidentState.tsx","src/client/world-widgets.css","src/client/design-tokens.css"]
---

# Resident profile / put their story first

Mode: Read and Operate. The user requested a more appealing, cohesive resident modal and explicitly directed: “Put their story first.” This is a component overhaul inside the established Ensemble playhouse, implemented in code without a new comp or visual world.

## Direction contract

THESIS: Introduce the resident, give their lived story the main reading position, and place present circumstances and management in supporting roles.

OWN-WORLD: Inherit navy, cool white, saffron, semantic light/dark surfaces, Manrope names and reading, and the existing playhouse dialog shell. Preserve the original resident renderer, artwork and colors. Anton remains the wider interface's program type; resident identity and internal reading landmarks remain Manrope.

STORY: Open a resident, recognize their portrait/name/trait/activity, read their story and defining moments, inspect original records when needed, then explore background, wellbeing and connections or reach resident settings below.

FIRST VIEWPORT: A larger original portrait anchors identity with name and appearance edits alongside. On desktop the wider left column begins with Story so far; a single tinted right surface groups Before the house, Wellbeing, influences and Threads of connection. At (900px) and below, the DOM order is identity, story, overview, settings. It remains usable at (320px).

FORM: Code-led refinement using existing assets, semantic roles, modest corners, fine rules and dialog elevation. The supporting overview is one tonal group, not a repeated card grid. Defining moments use a restrained timeline; provenance is available through native disclosures.

FINISH: Independent finish review concluded **Ship**, with no material blockers or required recaptures. Evidence and limits are recorded below; no comp-match or layout-detector pass is claimed.

## Implementation

The resident stylesheet is imported after world-widgets.css in the final `interface` layer. Its modal-scoped rules override the earlier resident composition while inheriting shared dialog width (1120px), viewport bounds, one outer scroll surface, sticky close control, minimum control targets and theme tokens. This brief owns the current modal composition; the world-widgets brief continues to own shared widget conventions and their history.

The identity region uses a flexible name/portrait group and edit area with (16px / 24px) gaps, a (28px) lower inset and (32px) separation from reading content. The portrait is (80px × 92px), names are Manrope (32px)/(750), and trait/activity text stays secondary. Rename and appearance actions retain native buttons and their existing editor behavior. Away residents show “Taking some time away” in this identity group.

The main desktop grid uses `minmax(0,1.15fr) minmax(0,.9fr)` with a (40px) gap. Story so far is a (24px) landmark; story prose is (16px)/(1.85), while defining-moment and retained-history prose inherits the shared (14px)/(1.8) reading treatment. Background and wellbeing headings use (18px)/(750). The supporting surface uses `surface-soft`, panel corners and (24px) insets. Connections retain their actual resident names, away labels and relationship descriptions. Defining moments are connected by a fine vertical rule with small accent markers; factual text is unchanged.

Mood, Energy and Belonging retain visible rounded numbers and named semantic meters with an explicit (0–100) range. Numbers use tabular figures. Values below (30) use danger, values above (65) use good, and the inclusive middle interval uses warning. These are the established theme roles, and labels/numbers convey the values alongside color. Away wellbeing is explicitly marked “Paused while away.”

“What affects these values” is a native, initially collapsed disclosure in the wide profile, preserving all existing ResidentState explanation beneath it. The compact sidebar keeps its existing overview-before-history order and expanded influences. The shared history freshness treatment is also native: “Updated …” or “About this summary” opens the full original refresh explanation, and “Refresh pending” stays visible when applicable. Story sources, per-episode sources, original-memory/revealed-dialogue disclosures and retained-history caveats remain available. No recorded content or retention limit is changed.

Resident settings follow both reading columns beneath a rule, with (32px) preceding space and (24px) inset. Model choice remains separate from the time-away action. The time-away wrapper keeps its explanatory sentence attached to its action through responsive reflow; when it is the only control it spans the grid with a (460px) maximum. Existing busy, population-cap, return and empty-history behavior remains intact.

At (900px), identity and reading become single columns; story stays first through source order, and the reading gap becomes (32px). At (600px), dialog content uses (24px 20px) insets, portrait size becomes (64px × 78px), names become (28px), overview insets become (20px), and controls continue wrapping. The shared sticky close and viewport clearance remain. Modal focus rings, selection, caret and scrollbar colors use existing semantic roles. The influence chevron uses (160ms) rotation; reduced motion removes this transition and meter transitions. The existing resident dialog entrance remains the motion moment.

## Incumbent comparison and documentation boundary

PRODUCT.md establishes following residents and their evolving stories as the core appeal and protects resident artwork/colors. DESIGN.md and the sidecar establish the Ensemble playhouse palette, Manrope resident identity and prose, tonal panel separation and dialog depth. The implementation continues those commitments without adding palette primitives, global typography roles, shared radii or system-wide composition rules.

The previous modal put overview first, history second, with a (1 / 1.15) grid, (48px) gap, (28px) names and shared (14px) narrative reading. This surface deliberately supersedes those local specifics with the story-first grid and identity/reading hierarchy above. DESIGN.md still describes those earlier resident measurements and the older import boundary; its global tokens and `.impeccable/design.json` are preserved. Treat this surface brief and the later stylesheet as authority for the current modal exception. A future authorized global documentation refresh can reconcile those local descriptions without changing the world.

The review identified inherited heading semantics: Story so far remains h4 after the resident h2, with same-level story subsection headings. This pre-existing semantic drift was reported as an optional future cleanup and was not repaired in this task. Fine freshness metadata (10–11px) and a possible (70ch) reading limit at the stacked desktop width were also optional refinements, not blockers. No global token changes are required for this component extension.

## Validation and provenance

The independent verdict and evidence assessment are in `work/resident-finish-review.md`. The reviewer inspected the before image and all 16 current screenshots in `.impeccable/review/resident-modal/`: both themes at (1440px), (900px), (390px) and (320px), plus phone story/settings positions. The report found no clipped controls, horizontal overflow, broken hierarchy or unreadable primary content. The documenter checked source and diff against origin/main, the product/design/sidecar and inherited widget brief, fixture assertions and evidence inventory, and directly inspected light-1440 and dark-320 captures.

The parent verification records a passing production build and all (607) unit tests. Browser checks pass for the modal fixture, resident summary/state/name behavior, appearance editor and model selection. The modal fixture covers keyboard opening/closing of native disclosures, preserved originals, meter values, rename Escape, away and empty states, both themes, and responsive overflow. The complete name suite includes focus return, Cancel/Escape, validation, duplicate submits, server failure/retry, no-op edits, two viewers and reload. These results were supplied by the implementing/reviewing agents; documentation did not rerun those checks.

Launcher context/detector tooling was unavailable; source context was read directly. No detector result is inferred. Captures use synthetic short-story data and do not prove every long/translated name, every loading/error state or every combination of opened nested disclosures. They are review evidence, not product artwork or factual community history. No new shipping raster, generated portrait or illustration was added, so no new raster provenance entry is needed. The earlier full-interface comp gate and unavailable seed output remain historical context in the world-widgets brief and are not claimed as acceptance evidence for this component.
