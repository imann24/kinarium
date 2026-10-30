---
name: "Kinarium — Natural-history diorama"
description: "A quiet frame for a living miniature: ivory and olive grounds, forest actions, sage selections, and readable Manrope controls."
colors:
  page: "#f4f3ec"
  surface: "#fffef8"
  surface-soft: "#e9ecdf"
  surface-hover: "#dfe6d6"
  text: "#29382e"
  secondary: "#52604e"
  muted: "#596550"
  line: "#c9d0be"
  control-border: "#748168"
  accent: "#3e5b43"
  focus: "#3e5b43"
  action: "#3e5b43"
  action-hover: "#2d4733"
  action-ink: "#fffef8"
  selected: "#dfe8d4"
  selected-ink: "#2c4a34"
  hero: "#e7e9dc"
  hero-ink: "#29382e"
  hero-muted: "#52604e"
  danger: "#943f2c"
  danger-soft: "#f5e8df"
  warning: "#75601f"
  warning-soft: "#f1ead4"
  good: "#38633d"
  good-soft: "#e4eddc"
  page-dark: "#1d251f"
  surface-dark: "#252f27"
  surface-soft-dark: "#2e3a2e"
  surface-hover-dark: "#394636"
  text-dark: "#edf0e2"
  secondary-dark: "#c5cdb8"
  muted-dark: "#b7c3aa"
  line-dark: "#4b5846"
  control-border-dark: "#8b997e"
  accent-dark: "#b9cda4"
  focus-dark: "#d9e7bf"
  action-dark: "#c2d2ac"
  action-hover-dark: "#dbe6c9"
  action-ink-dark: "#233424"
  selected-dark: "#394935"
  selected-ink-dark: "#e1ebcd"
  hero-dark: "#283326"
  hero-ink-dark: "#edf0e2"
  hero-muted-dark: "#c5cdb8"
  danger-dark: "#f0b69a"
  danger-soft-dark: "#46342b"
  warning-dark: "#decd8d"
  warning-soft-dark: "#3c3928"
  good-dark: "#b6d49f"
  good-soft-dark: "#30402d"
typography:
  display:
    fontFamily: "Dela Gothic One, sans-serif"
    fontSize: "clamp(42px, 5.65vw, 84px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.04em"
  headline:
    fontFamily: "Dela Gothic One, sans-serif"
    fontSize: "clamp(27px, 3vw, 42px)"
    lineHeight: 1.25
    letterSpacing: "-.035em"
  world-title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "28px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-.035em"
  insights-title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "30px"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-.035em"
  dialog-title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "26px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-.025em"
  section-title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "24px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-.025em"
  listing-title:
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
  journal-copy:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  narrative:
    fontFamily: "Manrope, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.8
  action:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  filter:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  control: "7px"
  filter: "6px"
  panel: "12px"
  dialog: "16px"
  deck: "14px"
  stage: "48% 48% 0 0"
spacing:
  inline-small: "12px"
  inline-medium: "20px"
  section-gap: "24px"
  column-gap: "36px"
  gutter-desktop: "32px"
  gutter-mobile: "18px"
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
  filter:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.filter}"
    rounded: "{rounded.filter}"
    padding: "10px 16px"
  filter-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-ink}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "32px"
  event-list-item:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    padding: "20px 32px 20px 0"
  house-narrative:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "28px"
  world-navigation:
    backgroundColor: "{colors.page}"
    textColor: "{colors.secondary}"
    height: "56px"
---

# Design System: Kinarium

## Overview

**Creative North Star: "Natural-history diorama"**

Kinarium frames a living miniature with warm ivory, oat and olive surfaces. Forest actions and pale sage selections relate the working interface to the existing house artwork. The house supplies the detail and personality; controls, navigation and reading surfaces remain calm and legible.

This system records the implemented overhaul after the user rejected the previous plum, mint and yellow combination. The natural-history framing is the implementation direction, not a separately user-approved mood board. The user explicitly confirmed retaining the existing artwork and rebuilding the UI around it; the Building SVG remains the product illustration. Dela Gothic One belongs to the wordmark and landing; Manrope carries the working application.

`src/client/design-tokens.css` owns the shared fonts, semantic palette, primary radii and dialog shadow. Component structure lives in the ordered `base`, `components`, `theme`, and `interface` layers. `theme.css` supplies theme mappings and scene treatment; `interface.css` owns the final shared working-surface treatment; `landing.css` owns the landing composition. PRODUCT.md remains the source for durable product behavior.

**Key Characteristics:**
- Warm neutral grounds, olive text, forest actions, and sage selections.
- Manrope for operational headings and reading; Dela for the brand and landing.
- Fine rules and open rows, with bounded panels where containment helps.
- Related olive-charcoal dark surfaces and explicit semantic state colors.

## Colors

The palette follows the house’s earth tones. Frontmatter is the normative sampled palette; suffix `-dark` records the alternative value for the matching semantic role under the explicit dark theme, not a second simultaneous palette.

### Primary

- **Forest action** and **action ink** define primary actions; the dark theme uses pale sage action surfaces with dark olive lettering. **Action hover** changes the surface without lowering text opacity.
- **Accent** identifies links and active details. **Focus** supplies keyboard outlines and can differ from the action color in dark mode.
- **Selected sage** and **selected ink** identify pressed filters, chosen modes and highlighted journal details. Page navigation also uses an accent underline.

### Neutral

- **Page ivory / olive charcoal** supplies the page canvas. **Surface** holds fields, scene toolbars, journals and dialogs; **surface soft** groups supporting content; **surface hover** supplies interaction feedback.
- **Text**, **secondary** and **muted** express the reading hierarchy. **Line** separates content; **control border** gives controls a stronger visible boundary.
- **Hero**, **hero ink** and **hero muted** are landing-specific material roles. Their darker counterparts retain the same contrast relationships.
- **Danger** uses clay, **warning** uses ochre, and **good** uses green, each with a soft companion surface. Event and chart category colors retain their own meaningful distinctions. Resident and furniture colors remain part of the simulation, not decorative interface accents.

**The House First Rule.** Let the existing house illustration carry the visual detail; use semantic interface colors to frame it.

**The Action and Selection Rule.** Use action and action-ink for primary actions, selected and selected-ink for chosen filters, and danger, warning or good only for meaning.

## Typography

**Display Font:** Dela Gothic One, with sans-serif fallback.

**Body Font:** Manrope, with sans-serif fallback.

Both fonts are self-hosted Latin WOFF2 files with swap rendering. Font provenance and SIL Open Font License files live in `public/fonts/README.md`; other scripts use the browser’s sans-serif fallback. Manrope is a variable face, including the operational (750) heading weight.

### Hierarchy

- **Display / headline:** fluid landing roles recorded in frontmatter. The featured-house title also uses Dela with `clamp(25px, 2.6vw, 37px)`, (1.2) leading and (-.03em) tracking. These are landing roles, not a universal app scale.
- **World / insights / dialog titles:** strong Manrope landmarks. The world title reduces to (23px) at the phone breakpoint, insights to (28px), and dialogs to (24px).
- **Section / listing titles:** Manrope separates tasks and names without a competing display face. Insights sections use (21px), weight (700), while event names use (15px), weight (700).
- **Body / journal copy:** the directory and working reading roles in frontmatter. Directory descriptions have a maximum measure of (62ch). House narrative prose uses its own more open reading role; it reduces to (14px) on narrow screens.
- **Action / filter:** sturdy Manrope for primary actions and directory filters. Sidebar tabs and operational journal filters use (12px). Journal headings use (18px), conversation titles (14px), reading copy (13px), and metadata (10–11px). Fields use (14px). These component differences are observed, not a mandate to reduce all controls to the smallest size.
- **Metrics:** house summary values use (23px), weight (700); insights values use (25px), reducing to (23px) on phones. Time, counts and detailed measurements use tabular numerals where defined by their component.

**The Working Type Rule.** Reserve Dela for the wordmark and landing; use Manrope for operational headings, controls and sustained reading.

The landing display reduces at its own (1100px), (760px), and (450px) breakpoints. Legacy tiny metadata sizes and tracked eyebrow selectors are not a reusable type scale or a recommended new pattern.

## Layout

The world page is capped at (1504px), with (32px) desktop gutters and (18px) phone gutters. Scene and journal share a grid on wide screens, with a (20px) final gap, and stack at (900px). The compact world header is (56px) on desktop; below (760px) it uses a single row with a (60px) minimum height. The general header retains its separate layout. The world’s view navigation sits directly below its title and description.

At (760px), a journal disclosure appears above the stacked panel and an event link appears beside scene actions. The expanded journal below (900px) uses (75dvh), bounded between (480px) and (600px), leaving room for reading beneath the fixed header and filters. Above (900px), the sidebar uses a (320–400px) reading column. The phone default can collapse the journal while retaining the saved preference. House metrics become full-width ruled rows. Event list columns reduce from four to three at (1100px), two at (760px), and one at (540px); the alternative event deck retains horizontal scrolling and paging.

Insights use four summary columns, two at (900px), and one at (540px). On phones each metric places its label and value on one row and its explanation beneath. Reading columns stack at (900px); relationship prose wraps without a decorative left stripe. The house narrative becomes a single column at (700px).

The landing keeps its broad arched house stage and open directory rows, with a (1504px) opening width, (32px) desktop gutters and (22px)/(18px) mobile gutters. Its directory is a preview, copy, metadata and entry grid; mobile moves metadata below preview and copy. The landing brief owns the exact composition and display-size changes.

Spacing tokens record reused dimensions, not a requirement to quantize every existing gap. Dialog content padding is (32px), reducing to (24px 20px) at (760px). Scrolling, wrapping and containment must continue to work when text is enlarged.

## Elevation & Depth

Most working regions are flat: borders, tone and whitespace establish their hierarchy. The live scene, journal and ordinary event list have no shadow. Dialogs deliberately float above an olive translucent backdrop with (3px) blur. Event-deck cards retain subtle elevation and a stronger active treatment on small screens; this is a distinct interaction, not the event list’s appearance. Contextual popovers and the simulation artwork keep their own separation shadows.

### Shadow Vocabulary

- **Dialog:** `var(--shadow)` from design-tokens.css; light and dark values are recorded in the sidecar.
- **Context overlay:** `0 5px 18px #0004` for time-mode tooltips and resident-choice popovers.
- **Deck resting:** `0 1px 2px rgba(60,70,50,.05)` for event-deck cards.
- **Deck active:** `0 10px 26px rgba(60,70,50,.13)` for the active mobile card and draw animation.

**The Containment Rule.** Use rules and space for ordinary reading and metrics; use bounded surfaces for the scene, journal, disclosures and dialogs.

## Shapes

Controls share the control radius; directory filters and the native featured-house selector use the slightly tighter filter radius. Scene frames, journal panels, house narrative and disclosure containers use the panel radius. Dialogs have the larger dialog radius; event-deck cards use the deck radius. Open event lists and metric rows are square and ruled. The landing artwork keeps its broad arch with square lower corners, while thumbnails remain rounded rectangles. Counts and dedicated icon controls can be circular; these roles do not make every container a pill.

## Components

### Buttons

Primary buttons use action/action ink, (12px 18px) padding, strong Manrope and a minimum height of (44px). Hover uses action hover. Secondary buttons use surface/text with a control border and (10px 13px) padding; hover changes the surface and accent border. The landing’s stage action uses (15px 20px) padding, weight (800) and a (49px) minimum height. Its secondary creation action uses selected/selected ink.

The shared focus treatment is a (3px) outline with a (3px) offset. Landing groups use a (5px) offset; component-specific focus treatments remain where defined. Disabled controls keep native behavior and component-specific reduced emphasis.

### Filters and selection

Directory filters are labeled buttons with `aria-pressed`, a (44px) minimum height, transparent resting surfaces and selected-sage pressed states. Journal and connection filters use the same semantic selection pair. Selected native time modes use the related soft surface with accent text and a control border. Sidebar tabs have (48px) minimum height and an accent rule plus selected tone. Journal filters form a two-column grid with (44px) targets and expose their pressed state. The keyboard-focusable journal scroll region identifies its newest-first order; conversation summaries use explicit read/hide labels, with a separate action to open the full conversation. Event-deck tone labels remain semantic category information rather than decorative section headings.

### Inputs / Fields

Native fields use surface/text, a control border, control radius, (11px 12px) padding and a (44px) minimum height. Focus changes the border and keeps a visible outline. Labels remain visible; hints use muted text. The directory search is an intentional variant: transparent, underlined, (280px) wide on desktop, full width on mobile, and focused as a group. The featured-house picker remains a labeled native select on the hero surface.

### Cards / Containers

The live scene and journal use a fine line, panel radius and ordinary surface. The scene toolbar and footer share that surface instead of competing color bands. Insights panels and event list items use open ruled rows. The house narrative uses a soft inset surface without a prose stripe. Event-deck cards retain their semantic top strip, illustrated SVG icon, effects and cooldown states; do not transfer their elevation to ordinary data rows.

### Dialogs and disclosures

Dialogs use the semantic surface, dialog radius and dialog shadow, with a scrollable bounded height and independently locked page scroll. Titles and internal headings use Manrope. Field-guide disclosures remain bordered panel-radius containers with a soft open-state heading and rotating SVG chevron. Their existing (17px) summaries and (13.5px)/(1.75) body copy remain specific reading roles. This is not a flat divider-only list.

### Navigation

The wordmark keeps Dela; navigation uses Manrope and subdued semantic text on a neutral surface. The active world-view link uses an accent underline. On phones the world header retains the brand, field guide and theme control while hiding secondary desktop navigation; the journal control moves next to its content. Theme controls remain accessible icon buttons. Header dimensions are route-specific, not one global height token.

### Motion

The landing house switch uses a single (420ms) `cubic-bezier(.16,1,.3,1)` arrival. Event-deck cards retain their draw animation and paging feedback. Reduced motion disables the house reveal, deck animation and associated transitions where implemented. Ordinary event-list hover changes tone without lifting.

## Do's and Don'ts

### Do:
- Do use the semantic light and dark roles from design-tokens.css across new working surfaces.
- Do preserve visible focus, native field labels, pressed filter states and disabled behavior.
- Do keep long names and descriptions wrapping inside their available columns.
- Do use the existing Building SVG and preserve resident, furniture and semantic chart colors.
- Do honor reduced motion for the house arrival and event-deck animations.

### Don't:
- Don't restore the rejected plum, mint and yellow decorative combination.
- Don't carry the landing’s display typography or arched stage into everyday task screens.
- Don't turn metric rows and open directory listings into an elevated card grid.
- Don't add decorative eyebrows, glyph icons or prose border stripes as new system conventions.
- Don't replace the product’s house renderer with new raster illustrations.
