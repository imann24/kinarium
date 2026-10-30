---
version: 1
slug: "src-client-main-tsx"
primary_target: "src/client/main.tsx"
related_targets: ["src/client/landing.css","src/client/design-tokens.css","src/client/interface.css"]
---

# Landing / public directory

Mode: Persuade. Discover and enter a house; creation, search, filters, field guide and themes remain available. The existing Building SVG is the authoritative product preview.

## Direction contract

THESIS: Introduce a living miniature through its real house artwork, framed by quiet earth tones and open directory rows.

OWN-WORLD: Warm ivory and oat grounds, olive text, forest entry actions and sage selections. Dela belongs to the brand and landing; Manrope carries listings and controls. DESIGN.md owns the shared tokens.

STORY: Understand the shared simulation, see an actual listed house, then enter it or browse the neighborhood. A template fallback remains explicitly labeled.

FIRST VIEWPORT: A two-line display title and brief introduction sit above the arched featured-house scene, with the house name and entry invitation attached. The native selector changes the preview. Phones stack the scene and invitation while preserving entry access.

FORM: Natural-history diorama framing, seventh grounded candidate; seed:f4adad7f5187bf7e. This implementation direction replaces the rejected festival palette while retaining the working landing composition. The user explicitly confirmed keeping the artwork and rebuilding the UI around it; no separate mood-board approval is claimed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Composition and responsive detail

The opening and footer are capped at (1504px), including gutters. Desktop opening gutters are (32px); mobile gutters become (22px), then (18px). The directory uses `205px minmax(0,1fr) 185px 115px` columns with (30px) gaps. At (1100px), the decorative stage note disappears and directory previews narrow. At (760px), the title and introduction stack, the house stage becomes one column, search fills the width, and directory metadata moves below the preview and copy. At (450px), the entry invitation becomes a single column. Preview widths reduce through (205px), (170px), (120px), and (90px).

The landing retains its fluid Dela roles and broad artwork arch; working screens use Manrope headings. The house arrival is (420ms) and disabled for reduced motion. No raster assets were added. The final source uses semantic tokens from design-tokens.css and the explicit interface layer.
