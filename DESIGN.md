---
name: "Kinarium — Neighborhood festival"
description: "A shared neighborhood festival identity: plum landmarks, mint surfaces, pale yellow invitations, and legible everyday controls."
colors:
  festival-plum: "#43274f"
  festival-ink: "#35233d"
  festival-yellow: "#f2f3a6"
  festival-mint: "#dce9cc"
  festival-ground: "#eef3e7"
  festival-subtle: "#536047"
  festival-rule: "#b7c6aa"
  festival-lilac: "#dacbe3"
  festival-plum-dark: "#2a1933"
  festival-ink-dark: "#e5edda"
  festival-mint-dark: "#303f34"
  festival-ground-dark: "#222c27"
  festival-subtle-dark: "#c3cfb9"
  festival-rule-dark: "#5e705e"
  festival-action-hover: "#fffec9"
  festival-stage-rule: "#a38baf"
  festival-header-rule: "#795d85"
  control-border: "#748168"
  control-border-dark: "#829578"
typography:
  display:
    fontFamily: "Dela Gothic One, sans-serif"
    fontSize: "clamp(42px, 5.65vw, 84px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.04em"
  headline:
    fontFamily: "Dela Gothic One, sans-serif"
    fontSize: "clamp(27px,3vw,42px)"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-.035em"
  app-page:
    fontFamily: "Dela Gothic One, sans-serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-.025em"
  world-title:
    fontFamily: "Dela Gothic One, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-.025em"
  app-heading:
    fontFamily: "Dela Gothic One, sans-serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-.025em"
  app-subheading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-.025em"
  app-copy:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12px"
    lineHeight: 1.7
  journal-copy:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12px"
    lineHeight: 1.8
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-.025em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  invitation:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.8
  action:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.5
  filter:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  control: "6px"
  action: "7px"
  preview: "12px"
  panel: "12px"
  inset: "8px"
  stage: "48% 48% 0 0"
  count: "50%"
spacing:
  inline-small: "12px"
  inline-medium: "20px"
  section-gap: "30px"
  gutter-desktop: "32px"
  gutter-mobile: "22px"
  gutter-small-phone: "18px"
components:
  stage-action:
    backgroundColor: "{colors.festival-yellow}"
    textColor: "{colors.festival-plum}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "15px 20px"
  button-primary:
    backgroundColor: "{colors.festival-yellow}"
    textColor: "{colors.festival-plum}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "12px 18px"
  button-outline:
    backgroundColor: "{colors.festival-ground}"
    textColor: "{colors.festival-ink}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
  app-filter-selected:
    backgroundColor: "{colors.festival-plum}"
    textColor: "{colors.festival-yellow}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.festival-ground}"
    textColor: "{colors.festival-ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  panel:
    backgroundColor: "{colors.festival-ground}"
    textColor: "{colors.festival-ink}"
    rounded: "{rounded.panel}"
  app-navigation:
    backgroundColor: "{colors.festival-plum}"
    textColor: "{colors.festival-lilac}"
    height: "64px"
  button-primary-hover:
    backgroundColor: "{colors.festival-action-hover}"
  button-neighborhood:
    backgroundColor: "{colors.festival-ink}"
    textColor: "{colors.festival-mint}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "15px 20px"
  filter:
    backgroundColor: "transparent"
    textColor: "{colors.festival-subtle}"
    typography: "{typography.filter}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  filter-selected:
    backgroundColor: "{colors.festival-ink}"
    textColor: "{colors.festival-mint}"
  search:
    backgroundColor: "transparent"
    textColor: "{colors.festival-ink}"
    padding: "14px 0"
    width: "280px"
  house-row:
    textColor: "{colors.festival-ink}"
    padding: "23px 0"
  house-row-hover:
    backgroundColor: "{colors.festival-ground}"
  navigation:
    backgroundColor: "{colors.festival-plum}"
    textColor: "{colors.festival-lilac}"
    height: "86px"
  house-picker:
    backgroundColor: "{colors.festival-plum}"
    textColor: "{colors.festival-yellow}"
    rounded: "{rounded.control}"
    padding: "10px 34px 10px 12px"
    width: "240px"
---

# Design System: Kinarium

## Overview

**Creative North Star: "Neighborhood festival"**

Kinarium uses the neighborhood festival as its shared visual world: broad plum fields, pale yellow invitations, mint surfaces, and substantial display lettering. It feels sociable and curious, with real house illustrations providing the detail and personality.

The user-approved expansion carries the landing hero’s identity through world screens, resident details, events, insights, creation and settings dialogs, the field guide, locked states, and administration. `src/client/festival-tokens.css` owns the shared fonts and palette; `theme.css` maps them to semantic interface roles; `app-chrome.css` applies the common navigation, controls, and surface treatments. `landing.css` retains the landing’s particular composition. Existing layouts, task behavior, and simulation artwork remain the foundation.

**Key Characteristics:**
- Plum landmarks, yellow invitations, and mint tonal surfaces.
- Dela Gothic One major headings paired with Manrope reading and controls.
- Flat panels and fine rules, with recognizable house illustrations.
- The same color relationships in light and dark themes.

## Colors

Pale yellow and lilac sit against plum; mint and ink make the neighborhood readable. Frontmatter values are normative and mirror the shared festival palette, semantic border roles, and landing stage accents.

### Primary

- **Festival yellow** supplies entry actions, the brand, title emphasis, and focus on plum. Its primary-action text stays the light-theme plum even in dark mode.
- **Festival plum** supplies stage toolbars, navigation, selected app controls, and the landing surround. The dark variant deepens the field.

### Secondary

- **Festival mint** supplies the directory ground, soft panels, tab rails, statistics, and reversed neighborhood action text.
- **Festival lilac** supplies stage supporting copy and the second headline line; yellow and lilac remain unchanged in dark mode.

### Neutral

- **Festival ink** supplies interface titles, body text, and light-theme focus. It becomes pale in dark mode.
- **Festival subtle** supplies descriptions, access labels, and metadata; its dark counterpart preserves the same hierarchy.
- **Festival rule** supplies directory dividers. **Festival ground** supplies page backgrounds, ordinary panels and fields, and directory row hover.
- **Festival stage rule** and **Festival header rule** supply fine borders on plum.
- The six `-dark` tokens replace the matching light values under the explicit dark theme. They are alternate theme values, not an additional palette for simultaneous use.

- **Control border** supplies field and secondary-action outlines, with an alternate dark value. Semantic accent and focus use plum in light mode; dark mode uses lilac for accent and yellow for focus.
- Event meanings, errors, resident colors, furnishings, and theme-aware scene colors retain their established semantic palettes. They are not recolored to match decorative chrome.

**The Shared Identity Rule.** Use the shared festival palette across interface surfaces; preserve semantic state colors and the simulation’s own scene palette.

## Typography

**Display Font:** Dela Gothic One, with sans-serif fallback.
**Body Font:** Manrope, with sans-serif fallback.

Dela’s broad forms give major landmarks the character of a festival program. Manrope carries resident names, explanations, detailed headings, metadata, and controls. Both are self-hosted Latin WOFF2 fonts with swap rendering; source and SIL Open Font License files are recorded in public/fonts/README.md. Other scripts use the browser’s sans-serif fallback.

### Hierarchy

- **Display:** the two-line landing title; its desktop clamp, weight, tracking, and leading are in frontmatter.
- **Headline:** the neighborhood heading; featured house headings use the same face with a smaller `clamp(25px, 2.6vw, 37px)`, (1.2) leading and (-.03em) tracking.
- **Title:** listing house names. The desktop title reduces to (21px), (19px), and (18px) at the successive responsive breakpoints.
- **Body:** directory descriptions, with a maximum measure of (62ch); invitation copy has its separate, more open role.
- **App page / world title / app heading:** fixed-size Dela roles for page landmarks, the house title, and event/dialog headings. At (760px), the world title and event/dialog headings become (23px), and the insights heading becomes (28px); the ordinary world title becomes (21px) below (450px).
- **App subheading:** strong Manrope for sidebar introductions and resident headings. Form and resident-detail section labels use (13px), weight (800). App copy and journal copy retain their separate leading.
- **Action / filter:** sturdy Manrope controls. App journal filters and sidebar tabs use (11px); resident and event names use (13px). Counts and needs use tabular numerals. Metadata remains subordinate to readable body text.

**The Landmark Type Rule.** Reserve Dela for major landmarks; use Manrope for task controls, resident names, detail sections, and sustained reading.

The title uses `clamp(40px,5.4vw,62px)` at the medium breakpoint, `clamp(34px,7.1vw,54px)` and (1.13) leading at mobile, and `clamp(28px,7.8vw,35px)` on small phones. These are source-specific responsive roles, not a universal mathematical type scale.

**The House First Rule.** Use the existing Building SVG for product illustrations; keep names, access conditions, and actions as readable interface text.

## Layout

The landing uses full-width color regions with a centered opening and footer capped at (1504px), including desktop gutters. The header and neighborhood use `max(32px, calc((100vw - 1440px) / 2))` horizontal padding. Gutters reduce to (22px) and then (18px).

The opening title and introduction occupy two unequal columns. The featured house sits in an arched stage, with an adjacent invitation; the decorative note drops away below (1100px). The directory uses open horizontal rows with preview, copy, metadata, and entry affordance in columns of `205px minmax(0,1fr) 185px 115px`, separated by (30px) gaps.

Responsive thresholds are (1100px), (760px), and (450px), all max-width queries. At mobile, title and introduction stack, the stage becomes a single column, search fills the available width, and metadata moves below row previews and copy. The entry affordance remains at the right. The featured action sits beside its text above the small-phone threshold and becomes a full available-width action below it. Listing previews reduce from (205px) through (170px), (120px), and (90px).

The header is (86px) tall on desktop and (74px) at mobile. Mobile hides the active directory link and brand descriptor while preserving the field guide and theme controls. Spacing entries in frontmatter are recurring dimensions extracted from the build, not a mandate to quantize every gap.

The app retains its existing content grid and responsive stacking; it does not reuse the hero’s oversized title or arched stage as a page template. The common app header is compact (64px), with the same plum ground, brand, navigation, and theme controls. Dialog padding is (36px), reducing to (28px 24px) at mobile and (26px 20px) on small phones. World-specific layout and reading arrangements are recorded in their surface briefs.

## Elevation & Depth

The shared interface is flat at rest. Color regions, fine borders, and the SVG’s own drawing supply depth. Primary actions, dialogs, and event-deck cards have no box shadow. Dialogs use an opaque semantic surface, a fine control border, and a plum translucent backdrop without blur. Event-card hover changes tone and border without lifting.

Small contextual overlays retain the existing shadow (`0 5px 18px #0004`) to separate tooltips and resident-choice popovers from their anchor. The simulation’s existing illustration shadows remain part of its artwork.

**The Flat Program Rule.** Separate interface regions through color, space, and fine rules; use tonal change for hover and reserve overlay shadows for contextual information.

## Shapes

Controls have gently rounded corners; primary actions are slightly rounder than filter buttons and the native house selector. House thumbnails use soft rectangular corners, while the featured illustration has a broad arch with square lower corners. Panels, dialogs, world frames, and event cards use the panel radius; template previews use the inset radius. The neighborhood count is circular. Keep these roles distinct rather than rounding every region into a container.

## Components

### Buttons

Primary stage actions use yellow with fixed plum text, the action radius, (15px 20px) padding, and a minimum height of (49px). Hover uses the brighter action-hover token. Neighborhood actions invert ink and mint and reduce opacity to (.85) on hover. Both use strong text with a supporting SVG icon. The understated create link is a text button, not a second large stage action.

App primary actions use the same yellow and fixed light-theme plum text, a plum border, (12px 18px) padding, and a minimum height of (44px). Secondary actions use the semantic surface and control border with strong Manrope text and the control radius. Disabled buttons retain their native disabled behavior and reduced opacity.

Keyboard focus on stage actions and the native selector uses a (3px) yellow outline offset by (5px); neighborhood links and buttons use ink at the same dimensions. Header and footer focus use yellow with the inherited (4px) offset.

### Filters

Filters are labeled buttons with `aria-pressed`, a minimum height of (44px), and transparent backgrounds at rest. Selection reverses ink and mint. Hover reveals an ink border. These are functional choices, not decorative badges. App journal/event filters, sidebar tabs, and active world navigation instead select plum with yellow text. Journal filters and sidebar tabs have a minimum height of (40px).

### Inputs / Fields

The search field is transparent with an underline and a leading search SVG. Focus outlines the whole search group with (3px) ink and a (5px) offset; the input’s own outline is suppressed because the group supplies it. Its desktop width is (280px), becoming full width on mobile. The featured-house selector remains a native select with a visible label, plum field, yellow text, and a fine stage-rule border.

App fields use the semantic surface and text, control border, control radius, and a minimum height of (44px). Form labels are strong Manrope. Selected time modes use a mint surface with an accent border. App focus uses the semantic focus color, while controls on plum toolbars use yellow.

### Navigation

The plum header pairs a yellow Dela wordmark with lilac navigation. The active desktop directory link has a (3px) yellow underline. The theme control retains its circular hit area; visible labels and SVG icons carry meaning. Footer typography echoes the header without repeating the mark. The compact app header uses the same identity with a smaller wordmark; the fullscreen header stays on the ordinary page ground. App view navigation and sidebar tabs use filled selected states rather than the site header’s underline.

### House listings

Each listing is a single anchor containing the preserved Building miniature, a Manrope house name, access text beneath the name, a description, population and time-mode metadata, and an arrow. Fine rules and whitespace separate rows; ground color signals hover. Names and descriptions wrap anywhere to accommodate user content. At narrower widths the arrow remains while its redundant “Visit house” label hides.

### Featured house stage

The existing Building SVG is the authoritative illustration, reused without new raster assets. A real listed house gets its name, access condition, population, and visit link attached to the illustration. The template fallback is explicitly labeled. House changes use one (420ms) arrival with `cubic-bezier(.16,1,.3,1)`, moving from (7px) below and (.8) opacity. Reduced motion removes that animation. No continuous decorative animation is part of the landing system.

### Panels, dialogs, and reading surfaces

World frames, sidebars, and insight panels use semantic surfaces with fine rules and soft rectangular corners. Mint groups secondary content such as statistics and tab rails. Dialogs share the same fields and yellow primary actions as the app; their major title uses Dela and their inner sections use Manrope. Close controls use a mint surface and the control radius.

Guide disclosures form a flat ruled list with Manrope summaries; open summaries use the accent color. House narratives use horizontal rules instead of an extra raised card. Event cards retain their meanings and descriptions, with quiet icons, strong Manrope titles, and tonal hover feedback.

## Do's and Don'ts

### Do:

- Do keep the house name before its access label in featured invitations and listing copy.
- Do preserve visible keyboard focus, textual control names, and pressed filter states.
- Do keep long house names and descriptions wrapping inside their available columns.
- Do use the existing Building SVG and its theme-aware scene colors; font provenance and licenses live in public/fonts/README.md.
- Do honor reduced motion by disabling the house arrival animation.

### Don't:

- Don't copy the landing’s oversized hero composition into everyday app screens.
- Don't turn the directory rows into a repeated elevated card grid.
- Don't introduce raster illustrations to replace the product’s existing house renderer.
- Don't restore the old serif dialog headings, elevated modal treatment, or tracked decorative eyebrows; the shared interface uses Dela landmarks and ordinary Manrope labels.
