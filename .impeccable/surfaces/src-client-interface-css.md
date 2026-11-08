---
version: 1
slug: "src-client-interface-css"
primary_target: "src/client/interface.css"
related_targets: ["src/client/design-tokens.css","src/client/main.tsx","src/client/SceneEvents.tsx","src/client/theme.css","src/client/style.css","src/client/event-picker.css","src/client/Building.tsx","src/client/world-widgets.css"]
---

# House and task interfaces / Ensemble playhouse

Mode: Operate. Watch the community, inspect residents and relationships, choose events, configure houses and use existing access controls. Preserve simulation behavior, factual history and saved preferences. House environmental colors may change; resident artwork and colors remain protected.

## Direction contract

THESIS: An ensemble playhouse: a visible cast, central live stage and adjacent story desk make social life understandable and invite participation.

OWN-WORLD: Navy stage and navigation, cool white program sheets, saffron primary actions, Anton program headings and Manrope prose, names and controls. Fine rules and modest corners keep the working surfaces legible. Blue dark surfaces preserve the same hierarchy. DESIGN.md owns shared tokens and reusable rules.

STORY: Enter a house, see its cast, follow recorded moments, inspect a resident and introduce an event without losing the house context. Preserve identity, presence, settings, conversations, history and resident management.

FIRST VIEWPORT: Wide screens use cast/stage/journal columns, with a navy quick-event tray directly beneath the central stage. Cast changes to a horizontal strip at 1100px. At 760px the stage, event tray and journal stack; explicit journal disclosure, observer identity, settings, zoom and fullscreen remain available. The story desk uses short previews with full content reachable by explicit disclosure and conversation actions.

FORM: Ensemble theatre playbill and stage-management desk, first grounded candidate; seed:b12428c0 retained from the direction record. The user selected Cast beside the stage and approved `.impeccable/mocks/decision/model-pick.webp`. The original full redesign chose comp-first; the saved default remains code-first. The subsequent dialog/widget refinement uses that code-first default and introduces no new comp. Original seed-roll output is unavailable; the saved user choice is the authoritative decision. The comp's sample dialogue and altered portraits are not production content. The live SVG and byte-identical Person renderer remain the resident source; authorized architectural recoloring relates the house to the stage.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented layout and controls

The final interface layer follows `base`, `components`, and `theme`. Shared semantic tokens live in design-tokens.css; component modules retain their behavior. world-widgets.css is imported after interface.css in this same layer and owns the subsequent dialog/widget sizing and spacing refinements. Do not restore superseded token files.

The world is capped at 1800px. Above 1250px, its normal view uses 10px gutters, a 20px heading inset and `minmax(168px,15fr) minmax(0,59.6fr) minmax(300px,25.2fr)`, with 14px column gaps and 16px row gaps. The world title is 50px, rail headings 40px, and actual simulation time appears beside the heading. Viewport fitting reserves the quick-event tray and 25px bottom clearance, with a minimum 240px canvas height. Cast and journal span stage plus tray; journal collapse reallocates its column. At 1250px gutters return to 16px and the columns become 150px/flexible/300px with 12px gaps. At 1100px the cast becomes a horizontal scrolling strip and the stage shares a row with a 310px journal bounded to 720px. At 760px the layout becomes a single column with 14px gutters and a 560px internally scrolling journal.

The navy masthead remains 58px. Phones keep one observer avatar trigger and expose world settings beside the view navigation. The stage toolbar has automatic height with a 50px wide minimum, 3px vertical padding and 52px base minimum. Wide world navigation uses 18px/750 type and 26px icons; the stage footer uses 8px vertical padding and the quick tray 20px bottom padding. Above 1250px, time-mode, zoom and fullscreen are separated by vertical rules; introduction uses 20px text with a minimum 50px height and 268px width. Cast rows have 91px minimum height, 10px padding, 22px gaps, top rules and 20px names. Its action group wraps, and zoom/fullscreen controls do not shrink. Phones retain visible zoom and fullscreen controls. Fullscreen removes cast and tray, uses a 330px desktop journal, and stacks on phones. Phones use in-page expansion with the same accessible enter/exit controls; duplicate mobile settings is hidden in that mode. Introduction becomes full width at 420px.

The quick tray exposes the first three server-permitted catalog entries, current allowance/cooldown and an outlined All events anchor. It retains three columns on phones. Above 1250px the quick-event labels use 18px, choice buttons have 77px minimum height, and the outlined All events control has a 141px minimum width. The later house-events replacement uses a tone rail and two columns of ruled event rows, one column at 1200px, and horizontal tone choices at 760px. Search and base effects support immediate dispatch with server-confirmed feedback. The full catalog no longer offers the card-grid/deck toggle. Its scoped contract and implementation are recorded in `src-client-eventpicker-tsx.md`; controls share authoritative event availability.

## Story density and reading

Base journal prose uses 14px/1.75, conversation titles 18px/1.4, and saffron conversation actions. Above 1250px, conversation previews use 16px/1.5 and two lines, titles use 20px/1.35, and timestamps use 14px. Status and disclosure share a row; Open conversation uses 16px text and a 40px minimum height. Wide tabs select with a 4px saffron underline; compact journal filters select with text underlining. The newest-first label remains accessible but visually hidden in this wide layout. Non-conversation previews retain 14px/1.75 and three lines at wide widths. Other collapsed descriptions show up to three lines except the compact middle range. Between 761px and 1100px, compact journal chrome uses a 27px story heading, 16px/1.35 conversation titles, 12px/1.6 two-line previews, 14px vertical entry padding and a minimum 40px Open conversation action. Non-conversation text longer than 160 characters is preserved inside a native Read full moment / Close moment disclosure. The keyboard-focusable newest-first region, full conversation dialog, archive paging and resident navigation remain available. Journal-specific base behavior lives in journal-panel.css; interface.css owns the final presentation.

Dialogs use Anton titles, semantic surfaces, 16px corners, soft shadow and a blurred backdrop. Inputs retain native labels, visible focus and semantic control borders. Insights, metrics and the full house-events menu use rules and whitespace. Resident arrival and cast hover motion only run when reduced motion is not requested.

## Live-stage environment

The latest authorized fidelity round changes only the light live-stage environment: room colors mix at 8% into #354741 mineral walls, with lighter trim, warmer windows and an 18-scene-unit floor band that preserves contrast behind the original resident legs. Preview and dark treatments remain unchanged. The Person renderer is unchanged. This is a scoped renderer treatment, not a return to the superseded green/tan interface palette. Widget refinements remain intact.

## Evidence and limitations

The shared system is now recorded in DESIGN.md and `.impeccable/design.json`. Source includes post-review fixes for story truncation, observer controls, phone zoom/fullscreen and stronger desktop hierarchy, including the user-requested additional fidelity round above 1250px. Review captures and the current verdict belong in `.impeccable/review/`; older captures may precede these corrections and do not overrule current source.

The round-four 1536×1024 hero comparison is 77.32%, above the 72% numerical threshold, but the build phase remains FAIL because of regional vetoes involving live content, crop alignment and scene adaptations. The canonical 1440px full-page comparison is 68.32% and remains below threshold; its different viewport makes it a separate comparison, not a regression measurement against the previous 1536px hero. See `.impeccable/review/diff/hero/report.json`, `.impeccable/review/diff/final/report.json` and `.impeccable/review/fidelity-round4/`. The earlier 71.33% score belongs to the previous round. These results do not establish an overall gate pass or a numerical override. Original seed output remains unavailable. These are disclosed delivery limitations, not reusable visual rules. No shipping raster scene replaces the live SVG.


## Subsequent dialog and widget refinement

The user's later request for deeper, more spacious task layouts is documented in `src-client-world-widgets-css.md`. It preserves this world composition while giving dialogs an 8px label / 24px field / 32px section rhythm, 40px desktop insets, task-specific widths and one outer scroll surface with a sticky close control. Settings and resident reading columns stack at 900px; 600px phone rules use 24px insets, 32px top padding and dynamic-viewport bounds. The independent widget review passed; this does not resolve or supersede the full-revamp pixel gate.
