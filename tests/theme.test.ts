import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { TEMPLATES } from '../src/simulation/catalog';

const script = readFileSync(new URL('../public/theme.js', import.meta.url), 'utf8');
function boot({ stored = null as string | null, dark = false, blocked = false } = {}) {
  const storage = new Map(stored === null ? [] : [['kinarium-theme', stored]]);
  const listeners: Record<string, (event?: { key: string | null }) => void> = {};
  const media = { matches: dark, addEventListener: (_: string, fn: () => void) => { listeners.media = fn; } };
  const root = { dataset: {} as { theme: string }, style: {} as { colorScheme: string } };
  const meta = { setAttribute: vi.fn() };
  const localStorage = {
    getItem: (key: string) => { if (blocked) throw new Error('Blocked'); return storage.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (blocked) throw new Error('Blocked'); storage.set(key, value); },
    removeItem: (key: string) => { if (blocked) throw new Error('Blocked'); storage.delete(key); },
  };
  const window = { matchMedia: () => media, addEventListener: (type: string, fn: () => void) => { listeners[type] = fn; }, dispatchEvent: vi.fn(), kinariumTheme: undefined as unknown as { getPreference: () => string; setPreference: (v: string) => void } };
  runInNewContext(script, { window, document: { documentElement: root, querySelector: () => meta }, localStorage, Event });
  return { root, meta, storage, media, listeners, theme: window.kinariumTheme };
}
describe('theme bootstrap', () => {
  it.each([true, false])('resolves and saves the initial OS choice before React renders (dark=%s)', dark => {
    const { root, theme, meta, storage, listeners } = boot({ dark });
    const expected = dark ? 'dark' : 'light';
    expect(theme.getPreference()).toBe(expected);
    expect(storage.get('kinarium-theme')).toBe(expected);
    expect(root.dataset.theme).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
    expect(meta.setAttribute).toHaveBeenCalledWith('content', dark ? '#1d251f' : '#f4f3ec');
    expect(listeners.media).toBeUndefined();
  });
  it.each(['system', 'unexpected'])('migrates legacy/invalid %s values to a persistent binary choice', stored => {
    for (const dark of [true, false]) {
      const app = boot({ stored, dark });
      const expected = dark ? 'dark' : 'light';
      expect(app.theme.getPreference()).toBe(expected);
      expect(app.storage.get('kinarium-theme')).toBe(expected);
      expect(boot({ stored: app.storage.get('kinarium-theme'), dark: !dark }).root.dataset.theme).toBe(expected);
    }
  });
  it.each(['light', 'dark'])('preserves an existing explicit %s preference over the OS default', stored => {
    const app = boot({ stored, dark: stored === 'light' });
    expect(app.root.dataset.theme).toBe(stored);
    expect(app.theme.getPreference()).toBe(stored);
  });
  it('persists both choices across reloads and ignores later OS changes', () => {
    const app = boot({ dark: true });
    for (const choice of ['light', 'dark']) {
      app.theme.setPreference(choice);
      expect(app.storage.get('kinarium-theme')).toBe(choice);
      expect(boot({ stored: app.storage.get('kinarium-theme'), dark: choice === 'light' }).root.dataset.theme).toBe(choice);
      app.media.matches = !app.media.matches;
      app.listeners.media?.();
      expect(app.root.dataset.theme).toBe(choice);
    }
    app.theme.setPreference('system');
    expect(app.theme.getPreference()).toBe('dark');
    expect(app.storage.get('kinarium-theme')).toBe('dark');
  });
  it('syncs other tabs, migrating cleared or legacy preferences without a third mode', () => {
    const app = boot();
    app.storage.set('kinarium-theme', 'dark'); app.listeners.storage({ key: 'unrelated' });
    expect(app.root.dataset.theme).toBe('light');
    app.listeners.storage({ key: 'kinarium-theme' });
    expect(app.root.dataset.theme).toBe('dark');
    app.storage.clear(); app.listeners.storage({ key: null });
    expect(app.theme.getPreference()).toBe('light');
    expect(app.storage.get('kinarium-theme')).toBe('light');
    app.media.matches = true;
    app.storage.set('kinarium-theme', 'system'); app.listeners.storage({ key: 'kinarium-theme' });
    expect(app.theme.getPreference()).toBe('dark');
    expect(app.storage.get('kinarium-theme')).toBe('dark');
  });
  it('keeps both themes usable when storage is unavailable', () => {
    const app = boot({ blocked: true, dark: true });
    expect(app.root.dataset.theme).toBe('dark');
    for (const choice of ['light', 'dark']) {
      app.theme.setPreference(choice);
      expect(app.root.dataset.theme).toBe(choice);
      expect(app.theme.getPreference()).toBe(choice);
    }
  });
});

// WCAG contrast checks for the shared dark palette and the unchanged semantic meter colors.
const css = readFileSync(new URL('../src/client/theme.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/client/design-tokens.css', import.meta.url), 'utf8');
function palette(theme: 'light' | 'dark') {
  const declarations: Record<string, string> = {};
  for (const source of [tokens, css]) {
    for (const [, selector, block] of source.matchAll(/(:root(?:\[data-theme='dark'\])?)\s*\{([^}]+)\}/g)) {
      if (selector.includes('dark') && theme !== 'dark') continue;
      for (const [, key, value] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) declarations[key] = value.trim();
    }
  }
  const resolve = (key: string): string => {
    const value = declarations[key];
    if (!value) throw new Error(`Missing color token: ${key}`);
    const alias = value.match(/^var\(--([\w-]+)\)$/);
    return alias ? resolve(alias[1]) : value;
  };
  return Object.fromEntries(Object.keys(declarations).map(key => [key, resolve(key)]));
}
const colors = palette('dark');
function luminance(hex: string) {
  return hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
it('keeps the resident leg silhouette visible against every dark room wall', () => {
  // Use the actual theme mix and template colors so new rooms/palette changes
  // cannot silently reintroduce the disappearing-leg effect.
  const [, percent, base] = css.match(/\.building-room\s*\{\s*fill:color-mix\(in srgb,var\(--room-color\)\s+(\d+)%,(#[\da-f]{6})\)/)!;
  const weight = Number(percent) / 100;
  const rgb = (hex: string) => hex.slice(1).match(/../g)!.map(v => parseInt(v, 16));
  for (const template of Object.values(TEMPLATES)) {
    for (const floor of template.floors) {
      const room = `#${rgb(floor.color).map((v, i) => Math.round(v * weight + rgb(base)[i] * (1 - weight)).toString(16).padStart(2, '0')).join('')}`;
      expect(contrast(colors['resident-leg-outline'], room), `${template.id}: ${floor.name}`).toBeGreaterThanOrEqual(3);
    }
  }
});
it.each(['light', 'dark'] as const)('keeps %s interface text and controls at accessible contrast', theme => {
  const colors = palette(theme);
  for (const bg of ['page', 'surface', 'surface-soft', 'surface-hover']) {
    for (const fg of ['text', 'secondary', 'muted', 'accent']) expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.focus, colors[bg])).toBeGreaterThanOrEqual(3);
    expect(contrast(colors['control-border'], colors[bg])).toBeGreaterThanOrEqual(3);
  }
});
it('keeps dark scene labels and semantic meter colors at accessible contrast', () => {
  expect(contrast(colors['scene-text'], colors['scene-bubble'])).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors['scene-caption'], colors['sky-horizon'])).toBeGreaterThanOrEqual(4.5);
  const track = css.match(/\.stat-track,\.bond-meter,\.allowance-meter>span\)\s*\{ background:(#[\da-f]{6})/)! [1];
  for (const fill of ['#7d926e', '#c79b6c', '#8ca8a3', '#99ab83', '#c79782']) expect(contrast(fill, track)).toBeGreaterThanOrEqual(3);
  for (const badge of ['#718564', '#b77b59', '#7396a1', '#ab8299']) expect(contrast('#0b140d', badge)).toBeGreaterThanOrEqual(4.5);
});
