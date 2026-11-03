---
version: 1
slug: "src-client-world-widgets-css"
primary_target: "src/client/world-widgets.css"
related_targets: ["src/client/main.tsx","src/client/ConversationModal.tsx","src/client/AppearanceEditor.tsx","src/client/RelationshipModal.tsx","src/client/interface.css","src/client/design-tokens.css"]
---

# World dialogs and widgets / room to read and act

Mode: Operate and Read. This is the user's code-first refinement of the existing Ensemble playhouse world: give settings, resident stories, appearance choices, conversations, relationships and smaller widgets deeper layouts and room to breathe. Preserve current behavior, native semantics, artwork, resident colors and factual story content.

## Direction contract

THESIS: Give each task enough space to understand its content and act without competing scroll regions or compressed controls.

OWN-WORLD: Preserve navy, cool white, saffron, Anton task titles and Manrope reading. Use the existing modest corners, rules, semantic colors and dialog elevation; the change is task-specific width, grouping and reading rhythm.

STORY: Open a task from the world, identify its sections, read or edit comfortably, save the relevant form, and return to the same house context. Resident identity and life story precede management controls; conversation text reads as one continuous scroll surface.

FIRST VIEWPORT: A clear title or resident identity, generous inset and persistent close control frame the task. Settings show separate details and simulation forms; resident stories show narrative beside history; appearance shows the original portrait beside choices. Narrow screens stack the same content in reading order with viewport gutters.

FORM: Code-first refinement of the established Ensemble playhouse. No new comp, seed roll, visual world or illustration is introduced. The earlier full-revamp comp and its unpassed gate remain historical evidence, not acceptance criteria newly claimed for this task.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented system

world-widgets.css is imported after interface.css and participates in the same final `interface` cascade layer. Its reusable rhythm is 8px from label to control, 24px between fields and 32px between sections. Dialog inset is 40px on desktop; at 600px and below it is 24px with 32px top padding. It preserves the existing palette and renderer.

The default dialog is capped at 620px; settings at 1040px; resident stories at 1120px; appearance, conversations and field guide at 800px; relationships at 960px. All are additionally capped to `100vw - 48px`, with height bounded by `100dvh - 48px`. Phones use `100vw - 24px` and `100dvh - 24px`. The outer dialog owns scrolling, stable scrollbar space and 24px scroll padding. Close controls are sticky 44px squares, offset 16px from the top on desktop and 12px on phones.

Dialog text inputs and selects have 48px minimum height, and text areas have 112px minimum height. Primary and outline dialog actions use 48px minimum height and 14px text. Appearance choices, close controls, resident edit controls and reading disclosures have 44px targets. This is scoped task-surface guidance, not a claim that every compact world control shares those dimensions.

Settings have two equal columns with a 40px gap and a vertical rule before the simulation form. Each form keeps its own heading and save action. At 900px the dialog caps at 680px, columns stack and the divider becomes horizontal.

Resident identity and edits form a separate top region. Background, wellbeing, influences and connections occupy the first reading column; history occupies the second, with a 1/1.15 proportion and 48px gap. Resident settings follow both columns beneath a rule. At 900px the reading and control grids stack. Resident names use 28px Manrope; reading uses 14px/1.8. No resident art or colors are changed.

Appearance places a 160px-wide sticky preview beside choices separated by 24px. At 600px the preview is static, centered and 120px wide above a single choices column. Swatches and hair controls remain 44px, with 12px gaps. Save/cancel actions follow a rule and share the phone row.

Conversations remove the redundant eyebrow and nested transcript scroll: turns use 16px/1.8 copy, 24px vertical spacing and fine rules. Relationships retain distinct portraits, meters, perspectives and history with 24–32px grouping and wrapping labels. Identity separates its form from the presence list; on phones status moves beneath the observer name.

Metric popovers cap at 460px or viewport minus 24px, with 28px padding reduced to 24px on phones. Sidebar resident and bond lists use 20px insets, readable wrapped labels and spaced rows. Time-away confirmation retains consequence text before its actions.

## Validation and provenance

Current evidence is in `.impeccable/review/widgets/`. Independent review passed the 20 captures and source with no material regression reported. The parent validation records 605 passing tests, a passing production build, an empty scoped layout-detector result and a clean whitespace check; the resident renderer matches the PR base. These results validate this refinement, not a new comp comparison.

The earlier full-interface composition gate was 71.33% against a 72% threshold and remains unpassed historical context. Its seed:b12428c0 original roll output remains unavailable; saved user selection of Ensemble playhouse / Cast beside the stage remains authoritative. No raster artwork is added by this task, and no pixel-gate pass is claimed.
