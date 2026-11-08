// Run against pnpm dev:client using Playwright (or PLAYWRIGHT_MODULE /
// CHROMIUM_PATH), as with the browser checks. No production dependency.
// The house and residents are the actual renderer, never generated replacements.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const publicFile = name => new URL(`../public/${name}`, import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--disable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  // Illustration fixture only; never read or mutate a live community.
  await page.route('**/api/worlds', route => route.fulfill({ json: { worlds: [{
    slug: 'the-common-house', name: 'The common house', description: '',
    templateId: 'common-house', population: 6, populationCap: 12,
    protected: false, mode: 'persistent', createdAt: 0, cohesion: 60,
  }] } }));
  await page.goto(origin);
  await page.locator('.featured-scene .building').waitFor();
  await page.evaluate(async () => {
    window.kinariumTheme.setPreference('light');
    await document.fonts.ready;
    const house = document.querySelector('.featured-scene .building').outerHTML;
    document.body.innerHTML = `<main class="share-art">
      <div class="share-brand">kinarium</div>
      <h1 class="share-headline">LITTLE WORLDS.<br><span>A LIFE OF<br>THEIR OWN.</span></h1>
      <p class="share-description">A few neighbors. A shared roof.</p>
      <div class="share-house">${house}</div>
    </main>`;
    const style = document.createElement('style');
    style.textContent = `
      html, body { margin:0; width:1200px; height:630px; overflow:hidden; }
      .share-art { position:relative; width:1200px; height:630px; background:#17284d; color:#f6f7fa; }
      .share-brand { position:absolute; left:48px; top:32px; font:800 44px/1.4 Manrope; letter-spacing:-.035em; }
      .share-headline { position:absolute; left:48px; top:170px; margin:0; font:400 74px/1.12 Anton; letter-spacing:0; }
      .share-headline span { color:#f4c455; }
      .share-description { position:absolute; left:48px; bottom:71px; margin:0; font:400 21px/1.5 Manrope; }
      .share-house { position:absolute; left:568px; top:146px; width:584px; height:400px; border-radius:14px; overflow:hidden; }
      .share-house .building { display:block; width:100%; height:100%; max-height:none; }
    `;
    document.head.append(style);
    await document.fonts.ready;
  });
  await page.screenshot({ path: publicFile('opengraph.png').pathname });

  // Raster fallbacks share the SVG source, including the touch icon.
  const favicon = await readFile(publicFile('favicon.svg'), 'utf8');
  const frames = [];
  for (const size of [16, 32, 48, 180]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${favicon}`);
    const png = await page.screenshot({ omitBackground: true });
    if (size === 180) await writeFile(publicFile('apple-touch-icon.png'), png);
    else frames.push({ size, png });
  }
  // ICO directory with PNG frames, supported by modern browsers and Windows.
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await writeFile(publicFile('favicon.ico'), Buffer.concat([header, ...frames.map(frame => frame.png)]));
  console.log('Rendered opengraph.png (1200×630), favicon.ico (16/32/48), and apple-touch-icon.png (180×180).');
} finally {
  await browser.close();
}
