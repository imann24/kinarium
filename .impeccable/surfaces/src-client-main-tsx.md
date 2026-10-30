---
version: 1
slug: "src-client-main-tsx"
primary_target: "src/client/main.tsx"
related_targets: ["src/client/landing.css", "src/client/festival-tokens.css", "src/client/app-chrome.css"]
---

# Landing / public directory

Mode: Persuade. Discovering and entering a house is the confirmed primary action; create, search, filters, field guide and themes remain. Code-first, chosen by the user. Existing Building is product artwork and stays the authoritative preview.

## Direction contract

THESIS: A neighborhood festival program inviting visitors into persistent little communities, replacing the muted split hero and equal card grid.

OWN-WORLD: Plum fields, mint listing ground, pale yellow actions, Dela Gothic One display lettering and Manrope reading text. Broad open surfaces, arched house stage, simple clearly named controls. Dark mode deepens the same colors.

STORY: Understand a shared simulation without a win state; see a real listed house and its residents; enter it or browse/search the neighborhood. Demo fallback explicitly labeled as a template.

FIRST VIEWPORT: Oversized two-line title across the upper program; a panoramic featured-house stage beneath, its entry invitation attached directly. Short explanatory copy above the stage. Mobile retains the house and entry action. A house selector switches actual directory previews with one brief reveal; reduced motion keeps the switch immediate.

FORM: Neighborhood festival program, grounded candidate 3; seed:d6e9954a2408e5e3. Other candidates: communal noticeboard, dollhouse exhibition, public-pool mosaic, paper theatre, woven community patchwork, neighborhood wayfinding. Papercut raises full-color commitment; consumer app raises action clarity. Character catalog was competitive for identification but weaker on explaining the simulation; the user selected the festival. Industrial labels, ASCII, and VU instruments were declined on identification and clarity, contributing literal labels, recognizable preview detail, and synchronized interaction respectively.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance


## Shared identity expansion

The user subsequently requested that the rest of the UI align with this hero. Palette and font authority now lives in the shared festival tokens and DESIGN.md; the landing’s particular oversized title, arched stage, and open neighborhood rows remain this surface’s composition. App surfaces use compact landmarks and task controls within their existing layouts.

## Composition and responsive detail

The opening and footer are centered within (1504px), including desktop gutters. Header and neighborhood padding is `max(32px, calc((100vw - 1440px) / 2))`; gutters become (22px) and (18px) at the mobile and small-phone breakpoints. The landing header is (86px), becoming (74px) on mobile.

The title and introduction form unequal columns above the featured house. The stage uses the existing Building SVG inside a broad arch, with its invitation adjacent. Directory rows use `205px minmax(0,1fr) 185px 115px` columns and (30px) gaps. At (1100px), the stage note disappears; below (760px), the title, introduction, and stage stack and search fills the width. Metadata moves below preview and copy while the entry affordance remains at the right. Preview widths reduce through (205px), (170px), (120px), and (90px). Below (450px), the featured action fills its available width.

The hero’s fluid Dela display roles belong here. App headings use fixed sizes; they do not inherit this page’s hero scale. One (420ms) house-arrival reveal remains, disabled under reduced motion. No new raster assets were introduced.
