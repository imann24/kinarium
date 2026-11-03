# Self-hosted typography

The current interface uses Anton Regular for program headings and Manrope for text and controls, under the SIL Open Font License 1.1.

- `Anton-Regular.ttf`: Anton Regular, Google Fonts, https://github.com/google/fonts/blob/main/ofl/anton/Anton-Regular.ttf (license: `Anton-OFL.txt`).
- `DelaGothicOne-Latin.woff2` (retained legacy asset, no longer loaded): Dela Gothic One Regular, Fontsource 5.2.5, https://cdn.jsdelivr.net/npm/@fontsource/dela-gothic-one@5.2.5/files/dela-gothic-one-latin-400-normal.woff2
- `Manrope-Latin.woff2`: Manrope variable weight, Fontsource 5.2.8, https://cdn.jsdelivr.net/npm/@fontsource-variable/manrope@5.2.8/files/manrope-latin-wght-normal.woff2

The adjacent OFL files come from each family's directory in https://github.com/google/fonts/tree/main/ofl. Anton is approximately 167 KB; the legacy Latin subsets total approximately 37 KB. Other scripts fall back to the browser's sans-serif font.
