# Brand assets

The favicon and sharing image extend the existing Ensemble playhouse identity in
[DESIGN.md](../DESIGN.md): stage navy, saffron, cool white, Anton headings and
Manrope text. They introduce no new design tokens or interface components.

| Asset | Dimensions | Source |
| --- | --- | --- |
| `public/favicon.svg` | 32 × 32 viewBox; scalable | Authored saffron lowercase **k** path on a rounded navy tile |
| `public/favicon.ico` | 16 × 16, 32 × 32, 48 × 48 PNG frames | Browser rasterizations of `favicon.svg` |
| `public/apple-touch-icon.png` | 180 × 180 | Browser rasterization of `favicon.svg` |
| `public/opengraph.png` | 1200 × 630 | Browser-rendered sharing composition |

The Open Graph image combines an authored layout in
[`scripts/render-brand-assets.mjs`](../scripts/render-brand-assets.mjs) with the
actual landing-page SVG from [`Building.tsx`](../src/client/Building.tsx). It keeps
the existing house and resident artwork and uses the self-hosted Anton and
Manrope fonts documented in [`public/fonts/README.md`](../public/fonts/README.md).
No image-generated replacement artwork is shipped. The script intercepts the
local directory request with an illustration fixture; it does not read or change
a live community.

## Regenerate

Install the project dependencies, then run `pnpm dev:client`. In another terminal
at the repository root, with Playwright available, run:

```sh
node scripts/render-brand-assets.mjs
```

As with the browser tests, an external Playwright installation and Chromium binary
can be selected through environment variables:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
CHROMIUM_PATH=/path/to/chromium \
node scripts/render-brand-assets.mjs
```

The default origin is `http://127.0.0.1:5173`; `TEST_ORIGIN` can select another
localhost or `127.0.0.1` origin. The script rewrites the three raster assets in
`public/`; edit `favicon.svg` directly to change the icon source. Review the
generated image and icon sizes before committing.

## Sharing metadata

[`index.html`](../index.html) declares favicon, Apple touch icon, Open Graph and
Twitter card metadata. If the public origin changes from
`https://kinarium.isaiahbmann.workers.dev`, update `og:url`, `og:image`, and
`twitter:image` together. Image URLs must remain absolute public URLs. Keep the
declared image dimensions and both image alt descriptions aligned with the asset.
