---
version: 1
slug: "src-client-main-tsx"
primary_target: "src/client/main.tsx"
related_targets: ["src/client/landing.css","src/client/interface.css","src/client/design-tokens.css","src/client/Building.tsx","src/client/theme.css","src/client/CommunityInsights.tsx","src/client/world-widgets.css"]
---

# Kinarium / Ensemble playhouse

Scope: full interface revamp. Discovery and live participation receive equal attention. Landing is Persuade; world, insights and administration are Operate; the field guide and history are Read. Preserve simulation behavior, available controls, content provenance, and resident colors/assets. House environment colors may change to fit the new theme.

## Direction contract

THESIS: An ensemble playhouse: a visible cast, central live stage, and adjacent story desk make social life understandable and invite participation.

OWN-WORLD: Navy stage and navigation, white program sheets, saffron primary actions, condensed program headings, readable sans-serif prose, aligned rules and modest corners. Light and dark themes share the same hierarchy.

STORY: Discover a house and its cast; enter, follow the unfolding story, select a resident, and introduce an event without losing the scene.

FIRST VIEWPORT: At 1536px, a compact header and house title sit over three columns: roughly 15% resident cast, 60% live stage, 25% journal. A navy event tray sits directly under the stage. Cast becomes a horizontal strip on smaller screens; story and event regions stack with explicit navigation. Landing uses a large house stage beside an introduction and a discoverable directory.

FORM: Ensemble theatre playbill and stage-management desk, first grounded candidate; seed:b12428c0, user-selected pick. Approved composition: `.impeccable/mocks/decision/model-pick.webp` (cast beside the stage). Signature interaction: selecting a cast member opens their profile while retaining the house context; event tray opens the full event selection. Motion is brief state feedback, with reduced-motion support. House/resident rendering stays live SVG; comp sample stories, altered portraits and the preview label are not production content. User explicitly permits house environment recoloring and forbids resident recoloring.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Provenance note: seed:b12428c0 is retained from the original direction session, but its original roll output is unavailable. The saved user choice of Ensemble playhouse / Cast beside the stage is the authoritative composition decision. Live content, unchanged resident art and user-authorized environment recoloring are deliberate adaptations; current gate results are recorded below without an overall pass claim.


## Final wide-screen implementation

The additional user-requested fidelity round applies above 1250px. The normal world view uses 10px gutters, 14px column gaps and a 15/59.6/25.2 flexible grid, with the same cast/stage/story topology. The heading is 50px Anton with actual simulation time beside it; cast and journal landmarks are 40px. Ruled cast rows use 91px minimum height and preserve the original resident artwork and colors.

The stage toolbar wraps with automatic height, a 50px wide minimum and 3px vertical padding. Wide world navigation uses 18px/750 type and 26px icons; cast rows use 10px padding and 22px gaps. The stage footer uses 8px vertical padding and the tray 20px bottom padding, leaving modestly more canvas height. Time-mode, zoom and fullscreen groups use vertical separators, and participation uses a larger saffron introduction action. The viewport-fit calculation reserves the quick-event tray and 25px bottom clearance; short screens may scroll once the canvas reaches its 240px minimum.

The wide journal uses underlined filters, a saffron active-tab rule, 14px timestamps, 20px conversation titles and 16px/two-line conversation previews. Status and disclosure share a row above the saffron conversation action. Non-conversation record previews remain 14px/three-line disclosures at wide widths. The 761–1100px compact journal retains 12px/two-line previews, while other responsive layouts retain their earlier behavior. The newest-first label remains accessible when visually hidden on wide screens.

The quick-event tray retains authoritative availability and its three live catalog choices, with 18px labels and a substantial outlined All events link. The landing composition and layouts at 1250px and below retain their established rules. The full redesign used comp-first; the saved workflow default remains code-first. Current gate results and the finish verdict live in the review artifacts; below-threshold comparisons remain open and are not numerical overrides.


## Subsequent code-first task-surface refinement

The user's later request gives world dialogs and widgets more room within the same visual world. world-widgets.css loads after interface.css in its existing layer. Settings separate House details and Life in the house forms; resident details separate identity, narrative/history and settings; appearance uses a portrait-and-choices layout; full conversations use one outer scroll surface. Task-specific widths, the 8/24/32 spacing rhythm, 40px desktop insets, phone reflow and sticky close controls are recorded in `src-client-world-widgets-css.md` and DESIGN.md. Current screenshots and review are in `.impeccable/review/widgets/`.

This refinement is code-first with no new comp or seed. The previous full-revamp 71.33% comparison remains below its 72% threshold; the passing widget review does not claim that historical pixel gate passed. Resident artwork and colors remain unchanged.


## Latest live-stage fidelity round

The authorized fourth round gives the light live stage mineral walls by mixing authored room colors at 8% into #354741, with lighter structure and warm window trim. An 18-scene-unit light floor band keeps the original resident legs readable. The Person renderer, resident colors, preview/dark treatments and widget layouts remain unchanged.

The round-four 1536×1024 hero comparison is 77.32%, above the 72% numerical threshold, but the build phase remains FAIL because of regional vetoes involving live content, crop alignment and scene adaptations. The canonical 1440px full-page comparison is 68.32% and remains below threshold; its different viewport makes it a separate comparison, not a regression measurement against the previous 1536px hero. See `.impeccable/review/diff/hero/report.json`, `.impeccable/review/diff/final/report.json` and `.impeccable/review/fidelity-round4/`. The earlier 71.33% score belongs to the previous round. These results do not establish an overall gate pass or a numerical override.
