---
version: 1
slug: "src-client-interface-css"
primary_target: "src/client/interface.css"
related_targets: ["src/client/design-tokens.css","src/client/main.tsx","src/client/theme.css","src/client/style.css","src/client/event-picker.css"]
---

# House and task interfaces

Mode: Operate. Watch the community, inspect residents and relationships, choose events, configure houses and use existing access controls. Preserve simulation behavior and saved preferences.

## Direction contract

THESIS: A quiet frame for a living miniature. The house supplies the personality; navigation and actions support it without a competing poster palette.

OWN-WORLD: Natural-history diorama framing: ivory and oat grounds, olive text, forest actions, sage selections and semantic clay. Manrope carries working headings and controls; Dela belongs to the wordmark and landing. Related olive-charcoal surfaces support dark mode.

STORY: See the house, find its residents, choose an event and inspect what happened. Keep existing facts and operations available.

FIRST VIEWPORT: A compact neutral header and house title frame the scene and quiet view tabs. The journal stays adjacent on desktop. Phones show a journal disclosure and a nearby event jump; metrics become readable rows.

FORM: Natural-history diorama frame, seventh grounded candidate; seed:f4adad7f5187bf7e. Alternatives included community fieldbook, shared-kitchen enamel, civic garden signs, woven linen, library catalogue and hillside neighborhood map. The user explicitly confirmed retaining the artwork and rebuilding the UI around it. This implementation direction preserves familiar controls; no separate user-approved board is claimed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implementation boundaries

The shared source of truth is design-tokens.css. The CSS cascade explicitly orders base, components, theme and interface; this surface owns the final common interface layer. Component structure and behavior stay with their source modules. Do not restore the deleted festival-tokens.css or app-chrome.css.

The world header is (56px) on desktop and a single row with (60px) minimum height on phones. Scene and journal stack at (900px). Below (760px), the journal disclosure sits above its panel, which is sized to (75dvh), bounded between (480px) and (600px) below (900px), and scene actions include an event jump. Saved journal preference remains authoritative. The event list changes from four columns through three and two to one at (1100px), (760px), and (540px); the deck retains its separate horizontal interaction.

Dialogs use semantic surfaces, soft elevation and a blurred translucent backdrop; Manrope titles, labeled native inputs and visible focus remain. Ordinary event items, metrics and reading panels use rules and space. No new raster assets or simulation artwork replacements were introduced.

## Journal refinement

The sidebar uses a (320–400px) desktop reading column, two-column filters with pressed states, (13px) body copy, explicit conversation disclosure labels, and a keyboard-focusable newest-first scroll region. Empty filters offer a return to Everything. Preserve the native disclosures, conversation modal, archive paging, and resident navigation. The journal-specific interface rules live in src/client/journal-panel.css.
