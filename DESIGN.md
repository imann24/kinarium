---
name: "Kinarium — Ensemble playhouse"
description: "A navy live stage, white program sheets, saffron invitations, and an enduring cast of residents."
colors:
  stage: "#17284d"
  stage-ink: "#f6f7fa"
  stage-muted: "#c6d3e8"
  stage-line: "#536582"
  saffron: "#f4c455"
  page: "#f6f7fa"
  surface: "#ffffff"
  surface-soft: "#e8edf5"
  surface-hover: "#dce5f2"
  text: "#17284d"
  secondary: "#41516e"
  muted: "#4b5c78"
  line: "#cbd4e2"
  control-border: "#6b7b96"
  accent: "#284e80"
  focus: "#284e80"
  action: "#f4c455"
  action-hover: "#e5ab33"
  action-ink: "#17284d"
  selected: "#dce7f7"
  selected-ink: "#203f70"
  hero: "#f6f7fa"
  hero-ink: "#17284d"
  hero-muted: "#41516e"
  footer: "#17284d"
  footer-ink: "#f6f7fa"
  warm: "#f4c455"
  danger: "#943f2c"
  danger-soft: "#f5e8df"
  warning: "#75601f"
  warning-soft: "#f1ead4"
  good: "#38633d"
  good-soft: "#e4eddc"
  overlay: "#101d38b3"
  page-dark: "#101a2d"
  surface-dark: "#192740"
  surface-soft-dark: "#21324e"
  surface-hover-dark: "#2a3e5c"
  text-dark: "#f3f5fa"
  secondary-dark: "#c9d6eb"
  muted-dark: "#b7c8e2"
  line-dark: "#40526e"
  control-border-dark: "#8a9cba"
  accent-dark: "#c0d5f4"
  focus-dark: "#f4c455"
  action-dark: "#f4c455"
  action-hover-dark: "#ffda80"
  action-ink-dark: "#17284d"
  selected-dark: "#304a6c"
  selected-ink-dark: "#e2edff"
  hero-dark: "#101a2d"
  hero-ink-dark: "#f3f5fa"
  hero-muted-dark: "#c9d6eb"
  footer-dark: "#0b1425"
  footer-ink-dark: "#e2edff"
  warm-dark: "#f4c455"
  danger-dark: "#f0b69a"
  danger-soft-dark: "#46342b"
  warning-dark: "#decd8d"
  warning-soft-dark: "#3c3928"
  good-dark: "#b6d49f"
  good-soft-dark: "#30402d"
  overlay-dark: "#070f20cc"
  event-option: "#dce5f5"
  event-option-hover: "#f6d58a"
typography:
  display:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(50px,6vw,88px)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "0"
  world-title:
    fontFamily: "Anton, sans-serif"
    fontSize: "50px"
    fontWeight: 400
    lineHeight: 1.16
    letterSpacing: "0"
  program-heading:
    fontFamily: "Anton, sans-serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0"
  event-heading:
    fontFamily: "Anton, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0"
  dialog-title:
    fontFamily: "Anton, sans-serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0"
  listing-title:
    fontFamily: "Anton, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0"
  brand:
    fontFamily: "Manrope, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    letterSpacing: "-.035em"
  insights-title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "30px"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-.035em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  journal-copy:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.75
  journal-preview-wide:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  story-title-wide:
    fontFamily: "Manrope, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.35
  narrative:
    fontFamily: "Manrope, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.8
  action:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  dialog-action:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
    fontWeight: 700
  resident-name:
    fontFamily: "Manrope, sans-serif"
    fontSize: "28px"
    fontWeight: 750
    lineHeight: 1.25
  conversation-reading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.8
  filter:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  control: "6px"
  event-card: "8px"
  panel: "12px"
  dialog: "16px"
spacing:
  tight: "8px"
  compact: "12px"
  gap: "16px"
  reading: "20px"
  section: "24px"
  dialog: "40px"
  dialog-phone: "24px"
  label-gap: "8px"
  field-gap: "24px"
  section-gap: "32px"
  column: "36px"
  landing-section: "48px"
  world-gutter: "16px"
  world-gutter-wide: "10px"
  world-gutter-phone: "14px"
  landing-gutter: "32px"
  landing-gutter-phone: "18px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.action-ink}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  filter:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.filter}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  filter-selected:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.stage-ink}"
  live-chip:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-ink}"
    rounded: "5px"
    padding: "9px 11px"
  program-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  event-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.event-card}"
    padding: "22px"
  event-tray:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.stage-ink}"
    rounded: "{rounded.panel}"
    padding: "18px 16px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "{spacing.dialog}"
    width: "min(620px,calc(100vw - 48px))"
  dialog-settings:
    width: "min(1040px,calc(100vw - 48px))"
  dialog-resident:
    width: "min(1120px,calc(100vw - 48px))"
  dialog-appearance:
    width: "min(800px,calc(100vw - 48px))"
  dialog-conversation:
    width: "min(800px,calc(100vw - 48px))"
  dialog-relationship:
    width: "min(960px,calc(100vw - 48px))"
  dialog-guide:
    width: "min(800px,calc(100vw - 48px))"
  input-dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  button-dialog-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.dialog-action}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  metric-popover:
    width: "min(460px,calc(100vw - 24px))"
    rounded: "{rounded.panel}"
    padding: "28px"
  navigation:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.stage-ink}"
    height: "58px"
---

# Design System: Kinarium

## Overview

**Creative North Star: "Ensemble playhouse"**

Kinarium puts the resident ensemble beside a live house stage. Navy frames the scene and navigation, cool white gives stories a readable program sheet, and saffron marks invitations to participate. Condensed Anton headings supply the playbill character; Manrope carries names, controls and sustained reading.

The user selected this world for the full interface redesign and approved the cast-beside-stage composition. House structure, furnishings and environmental colors may adapt to the interface; resident artwork and resident colors remain protected. The live SVG, actual residents, recorded stories and authoritative availability remain the content source.

`src/client/design-tokens.css` owns semantic colors, fonts, shared radii and dialog shadows. The cascade order is `base`, `components`, `theme`, then `interface`; `interface.css` supplies working-surface rules and `landing.css` supplies discovery composition. `world-widgets.css` is imported after interface.css in the same final `interface` layer; it owns the later dialog and widget refinements and their spacing properties. Frontmatter is normative for the roles recorded here. Component styles and responsive overrides remain the implementation source for local exceptions. PRODUCT.md owns product behavior; surface briefs own composition and provenance.

**Key Characteristics:**
- Navy stage and navigation, cool white reading surfaces, and saffron actions.
- Anton program headings with Manrope identity, names, controls and prose.
- Visible cast, adjacent story desk, and direct access to house events.
- Modest corners, fine rules, flat panels, and related blue dark surfaces.

## Colors

Navy and cool whites establish the stage/program contrast; saffron supplies warm, recognizable participation. Frontmatter names correspond to semantic CSS properties; `-dark` records the explicit dark-theme override. Shared stage colors and saffron remain the same in both themes.

### Primary

- **Saffron action**, **action hover**, and **action ink** mark primary participation and conversation actions. Dark mode retains saffron with navy lettering.
- **Stage navy**, **stage ink**, **stage muted**, and **stage line** frame navigation, the live stage, the featured landing house and the event tray.
- **Accent** and **focus** identify links and keyboard location. Focus on navy navigation, stage controls and event trays uses saffron.
- **Selected blue** and **selected ink** identify journal tabs, working filters and selected residents. Directory filters have a deliberate navy selected variant.

### Neutral

- **Page** is the cool canvas, **surface** the reading sheet, **surface soft** a supporting group, and **surface hover** interaction feedback. Their dark equivalents are stepped blue surfaces.
- **Text**, **secondary** and **muted** provide readable hierarchy; **line** divides content and **control border** gives fields and secondary controls a stronger edge.
- **Hero**, **footer** and their ink roles remain available semantic aliases. The current landing explicitly uses stage roles for its featured house and footer.
- **Danger**, **warning** and **good**, with their soft companions, retain meaningful states. Existing chart, mood and event category colors are semantic exceptions, not decorative palette replacements.
- **Event option** and **event option hover** record the pale blue and warm hover materials used by the repeated quick-event buttons. These are authored component colors, not currently CSS custom properties.

**The Resident Continuity Rule.** Preserve resident artwork and colors; change environmental materials only within the authorized house renderer.

The live stage sets its sky roles to stage navy. Light room fills mix each authored room color at (30%) into the cool architectural ground; dark room fills mix at (27%) into the dark ground. Furnishings retain their renderer-specific materials. These environmental treatments do not define resident palettes.

## Typography

**Display Font:** Anton, with sans-serif fallback; self-hosted regular TTF, weight (400), swap rendering.

**Body Font:** Manrope, with sans-serif fallback; self-hosted Latin WOFF2, variable weights (400–800), swap rendering. Font provenance and licensing are retained in `public/fonts/`.

### Hierarchy

- **Display / world title:** uppercase Anton with zero tracking; the landing is fluid and the world title follows its frontmatter role above (1250px). Below that threshold, the base world role is `clamp(32px,3.2vw,48px)` before the (1100px), (760px) and (420px) overrides.
- **Program / event / dialog / listing titles:** uppercase Anton creates repeated landmarks. Wide cast and story headings use the program role; the base role below (1251px) is (36px) before narrower overrides. Catalog sections use the event role; the wide quick-event tray uses (36px). Modal titles use the dialog role, with a (28px) direct-title override below (600px). Resident identity uses its separate Manrope name role. Directory house names use the listing role.
- **Brand:** Manrope at (800), not Anton. The wide world masthead uses (34px); the shared base is recorded in frontmatter. It reduces to (22px) on phones; the footer identity has its own (24px) treatment.
- **Insights title:** Manrope at (750), with a (28px) phone override. Insights panel headings are (21px)/(700); narrative headings are (23px)/(700).
- **Body / journal / narrative:** preserve their distinct frontmatter roles. Directory descriptions are bounded to (58ch); world descriptions use (16px) and (62ch), with (1.5) leading above (1250px) and (1.65) below, reducing to (12px) on phones. Narrative prose becomes (14px) below (700px).
- **Names and story titles:** wide cast names are (20px) bold; wide conversation titles and previews use the dedicated frontmatter roles. At widths up to (1250px), the base cast names and conversation titles are (18px), before the smaller layout overrides. Responsive cast names become compact labels inside the scrolling strip.
- **Actions and fields:** primary actions use the action role, fields (14px), and ordinary labels (13px)/(1.6); dialog labels and actions use (14px). Introduction on the live stage is a stronger (20px)/(750) action above (1250px), with a (16px) base below that threshold. Desktop navigation is (16px)/(650), reducing to (13px) below (1250px).

**The Program Type Rule.** Use Anton for program landmarks and Manrope for names, controls and sustained reading.

Small inherited metadata and compact control labels are local implementation details, not a recommended type scale. Existing eyebrow selectors are not promoted into the design system.

## Layout

The working world is capped at (1800px). Above (1250px), its normal view has (10px) side gutters, a (20px) heading inset, and a grid of `minmax(168px,15fr) minmax(0,59.6fr) minmax(300px,25.2fr)` with (14px) column gaps and (16px) row gaps: cast left, stage center, journal right. Cast and journal span the stage and event-tray rows. The tray sits directly beneath the stage. Closing the journal reallocates its column to the stage. The journal and cast use the measured stage-height variable with a (650px) fallback plus (196px); these are actual CSS bounds, not a guarantee that every story fits above the fold. The viewport fit reserves the tray height plus (16px) above (1100px), then leaves (25px) bottom clearance above (1250px) or (17px) otherwise. A (240px) minimum canvas height allows short screens to scroll instead of crushing the scene.

At (1250px), normal-view gutters return to (16px) and columns become (150px), flexible stage, and (300px), with a (12px) gap. At (1100px), the cast becomes a horizontal scrolling strip above a flexible stage and a (310px) journal; the journal is bounded to (720px). At (760px), the page becomes one column with (14px) gutters: cast, stage, event tray, journal disclosure, and journal. The journal is (560px) tall with internal scrolling. The phone heading is (34px), reducing to (29px) at (420px). The preserved journal preference still controls visibility.

The shared masthead is (58px) tall. Phone navigation keeps the brand, field guide, theme control and a single observer presence trigger; world settings moves beside the view links. The stage toolbar has automatic height with a (58px) wide minimum and a (52px) base minimum; its action group wraps and zoom/fullscreen controls do not shrink. Wide controls use vertical separators between time mode, zoom and fullscreen; actual simulated time moves to the heading in the normal wide view. Phone controls retain zoom and fullscreen access. Fullscreen hides the cast and event tray and uses stage plus a (330px) journal on desktop; at the phone breakpoint it becomes a single column and uses in-page expansion with the same accessible enter/exit controls. These are intentional responsive variants, not missing desktop features.

Event catalog cards use four columns, three at (1100px), two at (760px), and one at (420px). The alternative event deck preserves horizontal paging. The three quick-event choices remain three columns on phones. World metrics become full-width ruled rows at (760px).

Insights use four summary columns, two below (900px), and one below (760px); phone metrics put label and value together with explanation below. Reading columns stack at (900px), narrative columns at (700px), and the activity chart at (540px). Tables retain horizontal overflow containers.

Discovery has a (1480px) maximum opening and directory width, (32px) desktop gutters, and (18px) phone gutters. The title and introduction are adjacent, followed by a navy house stage and invitation. Below (760px), those regions stack. Directory rows arrange preview, copy, details and entry control; phones move details beneath preview and copy. At (360px), previews shrink again. Surface briefs carry further composition detail.

Dialog content follows an (8px) label gap, (24px) field gap and (32px) section gap. Desktop insets use the dialog spacing token; at (600px) and below the inset becomes (24px), with (32px) top padding. Dialog widths vary by task as recorded in frontmatter. They are capped to the viewport minus (48px), and height is capped to `calc(100dvh - 48px)`; phones use (24px) total viewport clearance in both dimensions. The dialog itself owns scrolling with a stable scrollbar gutter and (24px) scroll padding. The close control stays sticky inside that scroll surface rather than scrolling out of reach.

Settings use two equal columns with a (40px) gap and a ruled second column, each form retaining its own heading and save action. At (900px), they stack with a top rule and the dialog caps at (680px). The resident dialog places identity above a (1fr / 1.15fr) narrative/history grid with a (48px) gap, then a separate settings section; these grids stack at (900px). Appearance uses a (160px) sticky portrait column beside choices; at (600px), the portrait becomes a centered (120px) preview above the choices. These layouts create reading and task separation within the established world, without a new visual identity.

## Elevation & Depth

The ordinary interface is flat. Borders, tonal surfaces and whitespace separate cast, stage, journal, event cards, insights and directory rows. Final interface overrides remove event-deck resting and active shadows. Dialogs float over a translucent backdrop with (3px) blur; contextual overlays retain a smaller shadow. The live SVG supplies its own illustrated depth.

### Shadow Vocabulary

- **Dialog light / dark:** `var(--shadow)`; exact values are recorded in the sidecar from design-tokens.css.
- **Context overlay:** `0 5px 18px #0004`, used by time-mode and resident-name popovers.
- **Resident arrival start:** `0 6px 20px #14284b18`, transitioning to the dialog shadow only when reduced motion is not requested.

**The Reading Surface Rule.** Use tone, borders and space for ordinary panels; reserve floating depth for dialogs and contextual overlays.

## Shapes

Controls use the shared control radius; cast, stage, journal, featured landing house and tray use the panel radius. Catalog and deck cards use the event-card radius, and dialogs use the larger dialog radius. Listing thumbnails have the event-card radius. Wide participation and conversation actions use local (9px) corners, quick-event options use (7px), and the wide live-state chip uses (10px); these do not replace the shared control radius. Observer dots and status indicators remain circular. Directory listings and insights metrics are open, ruled rows. The former arched landing stage is superseded by a rounded rectangular navy stage.

## Components

### Buttons

Primary buttons use action/action ink, the frontmatter padding, a (44px) minimum height and a background hover change. Secondary buttons use surface/text, a control border and their frontmatter padding. Introduction on the stage uses (22px) inline padding; above (1250px) it is at least (50px) tall and (268px) wide, with a (48px) minimum height below that threshold. The landing action uses (14px 18px) padding and a (48px) minimum height. Icon buttons normally occupy (44px) squares; compact header and stage variants retain their authored sizes. Inside dialogs, primary and outline actions have (48px) minimum height, (14px) type and (12px 18px) padding. Close buttons, appearance swatches, hair choices and resident edit actions retain at least (44px) targets.

Shared keyboard focus is a (3px) outline offset by (3px). Stage, tray and masthead focus use saffron. Component-specific focus rules remain, including the search group's outline. Disabled actions keep their native state and never imply available event capacity when the server disallows it.

### Inputs / Fields

Native inputs, text areas and selects use surface/text, a control border, control radius, (11px 12px) padding and a (44px) minimum height. Dialog text inputs and selects use (48px) minimum height; dialog text areas use (112px) minimum height, (12px) padding and (1.65) leading. Dialog form labels have an (8px) gap and fields are separated by (24px). Focus changes the border and retains a visible outline. Labels remain visible. Directory search is an underlined transparent variant, (290px) wide on desktop and full-width on phones. The featured-house select is native, (250px) on desktop and (60%) of its phone row.

### Navigation and selection

The navy masthead uses Manrope links and a saffron active rule. World view links are compact underlined tabs on the page canvas. Directory filters expose `aria-pressed`, have (44px) minimum height, and select to navy/white. Sidebar tabs normally use selected blue and an active underline. Above (1250px), they use a transparent selected surface and a (4px) saffron underline; journal filters are compact, transparent and text-underlined when selected. Narrower layouts retain the selected-blue filters. Live state is a labeled chip; visual selection never replaces the corresponding accessible state.

### Cast and resident detail

The desktop cast panel contains full-body resident SVGs, names and actual activities; names wrap. Above (1250px), the rows have (91px) minimum height, square corners and a top rule, with (20px) names and (11px) activity labels. Hover and selection use the selected surface. Choosing a resident opens the resident detail experience while the house remains in context. Identity and edit actions sit above background, wellbeing, influences, connections and retained history; model choice and time-away controls sit in a separate Resident settings section after the story. Resident names use the Manrope name role, narrative/history copy uses (14px)/(1.8), and section headings use (16px)/(750). The strip scrolls horizontally on narrower layouts. Full resident management and time-away navigation remain reachable even where the desktop rail footer is hidden.

### Journal

The white or dark reading sheet has an Anton heading, tabs, filters and a keyboard-focusable newest-first scroll region. Above (1250px), conversation previews use the wide frontmatter role and two visible lines, story titles use the wide title role, and timestamps use (14px). Status and conversation disclosure share a row; Open conversation uses (16px) text, (7px 16px) padding, (9px) corners and a (40px) minimum height. Journal entries have bottom rules with (16px 0 20px) padding. The newest-first label remains available to assistive technology while being visually hidden in this wide layout.

Between (761px) and (1100px), the journal uses compact chrome, a (27px) story heading, (16px)/(1.35) conversation titles, (12px)/(1.6) two-line previews and a (40px) minimum-height Open conversation action. Entries use (14px) vertical padding in this range. At (1101–1250px) and on phones, conversation previews retain the (14px) base and up to three lines.

Non-conversation records longer than (160 characters) keep a native disclosure labeled “Read full moment” / “Close moment.” Their previews remain (14px)/(1.75) with three lines, including above (1250px); only the (761–1100px) compact rule reduces them to (12px)/(1.6) and two lines. Short entries remain direct prose. Full factual text, full conversation reading and the separate conversation dialog remain reachable. Conversation actions use saffron, and journal data never comes from the comp's invented sample stories.

### Event tray and catalog

The navy tray offers the first three server-permitted catalog entries with actual allowance and cooldown status; its “All events” link reaches the full picker. First choice uses saffron, remaining choices pale blue, and hover uses a warm surface. Above (1250px), quick-event labels use (18px), options have a (77px) minimum height, and the outlined All events link has a (141px) minimum width. Allowance is separated from the heading by a vertical rule. Authoritative cooldown disables quick choices. The full catalog remains a grid of bounded flat cards, with the existing paged deck as an alternative. Event icons are drawn SVG, and meaningful kind/mixed/disruptive distinctions remain.

### Insights, dialogs and disclosures

Insights pair ruled summaries and open analysis rows with a soft narrative container. Relationship prose has no decorative stripe. Native explanatory disclosures and factual caveats remain. Dialogs use the semantic surface, dialog radius, locked page scroll and Anton titles; internal reading headings stay Manrope. The larger, task-specific widths and spacing in Layout are final overrides from world-widgets.css. The dialog has one outer scroll surface; conversation lists have no nested maximum height or scrolling, and resident detail content remains overflow-visible within the dialog. Close buttons are sticky, (44px) square, with (16px) desktop and (12px) phone top offsets.

Conversations use the conversation-reading role, ruled turns with (24px) vertical padding, (14px) speakers and (12px) timestamps; the redundant conversation eyebrow is removed. Relationship reading keeps distinct portraits, meters, perspectives, moments and source disclosures, with (24–32px) grouping space and wrapping labels. Observer identity separates the form from a ruled presence list. Field-guide disclosures retain their bordered containers, soft open headings and SVG chevrons inside the wider guide dialog.

Metric popovers use the frontmatter width and inset, reducing to (24px) padding on phones. Titles use (20px)/(750), body uses (14px)/(1.75), and disclosure/close targets remain (44px). The sidebar resident and bond lists use (20px) insets, wrapped resident labels and more space between rows. These compact widgets retain the scene context rather than adopting dialog-scale widths.

### Motion

Cast hover changes background over (160ms); resident dialog arrival uses (220ms) with `cubic-bezier(.16,1,.3,1)` and an (8px) vertical arrival. Both are within `prefers-reduced-motion: no-preference`. Existing event-deck motion and scene movement retain their own reduced-motion handling; do not add motion merely to animate the program panels.

## Do's and Don'ts

### Do:
- Do use the semantic light and dark roles from design-tokens.css for new interface surfaces.
- Do keep the live house renderer and the original resident art and colors.
- Do preserve visible focus, native field labels, pressed states and truthful disabled states.
- Do keep long names wrapping and full journal content reachable behind explicit disclosures.
- Do preserve observer identity, zoom, fullscreen, resident management and event access across responsive layouts.
- Do honor reduced motion for optional arrival and state animations.

### Don't:
- Don't restore the superseded green/tan/Dela interface world.
- Don't recolor resident sprites or replace them with generated portraits.
- Don't copy sample comp dialogue, counts or availability into production history.
- Don't turn directory listings and insights reading rows into elevated card grids.
- Don't introduce decorative eyebrows, glyph icons or prose border stripes as reusable conventions.
