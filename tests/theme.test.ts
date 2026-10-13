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
  it.each([true, false])('follows system preference before React renders (dark=%s)', dark => {
    const { root, theme, meta } = boot({ dark });
    expect(theme.getPreference()).toBe('system');
    expect(root.dataset.theme).toBe(dark ? 'dark' : 'light');
    expect(root.style.colorScheme).toBe(root.dataset.theme);
    expect(meta.setAttribute).toHaveBeenCalledWith('content', dark ? '#18211d' : '#f8f8f2');
  });
  it('persists explicit choices, survives reload and ignores system changes until reset', () => {
    const app = boot({ dark: true });
    app.theme.setPreference('light');
    expect(app.storage.get('kinarium-theme')).toBe('light');
    expect(boot({ stored: app.storage.get('kinarium-theme'), dark: true }).root.dataset.theme).toBe('light');
    app.listeners.media();
    expect(app.root.dataset.theme).toBe('light');
    app.theme.setPreference('system');
    expect(app.storage.has('kinarium-theme')).toBe(false);
    expect(app.root.dataset.theme).toBe('dark');
    app.media.matches = false; app.listeners.media();
    expect(app.root.dataset.theme).toBe('light');
  });
  it('syncs preference changes and storage clearing from another tab', () => {
    const app = boot();
    app.storage.set('kinarium-theme', 'dark'); app.listeners.storage({ key: 'kinarium-theme' });
    expect(app.root.dataset.theme).toBe('dark');
    app.storage.clear(); app.listeners.storage({ key: null });
    expect(app.theme.getPreference()).toBe('system');
    expect(app.root.dataset.theme).toBe('light');
  });
  it('handles invalid preferences and unavailable storage without breaking the app', () => {
    expect(boot({ stored: 'unexpected', dark: true }).root.dataset.theme).toBe('dark');
    const app = boot({ blocked: true });
    app.theme.setPreference('dark');
    expect(app.root.dataset.theme).toBe('dark');
    expect(app.theme.getPreference()).toBe('dark');
  });
});

// WCAG contrast checks for the shared dark palette and the unchanged semantic meter colors.
const css = readFileSync(new URL('../src/client/theme.css', import.meta.url), 'utf8');
const darkBlock = css.match(/:root\[data-theme='dark'\]\s*\{([^}]+)\}/)![1];
const colors = Object.fromEntries([...darkBlock.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/g)].map(([, key, value]) => [key, value]));
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
it('keeps dark text, controls and scene labels at accessible contrast', () => {
  for (const bg of ['page', 'surface', 'surface-soft', 'surface-hover']) {
    for (const fg of ['text', 'secondary', 'muted', 'accent']) expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.focus, colors[bg])).toBeGreaterThanOrEqual(3);
    expect(contrast(colors['control-border'], colors[bg])).toBeGreaterThanOrEqual(3);
  }
  expect(contrast(colors['scene-text'], colors['scene-bubble'])).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors['scene-caption'], colors['sky-horizon'])).toBeGreaterThanOrEqual(4.5);
  const track = css.match(/\.stat-track,\.bond-meter,\.allowance-meter>span\)\s*\{ background:(#[\da-f]{6})/)! [1];
  for (const fill of ['#7d926e', '#c79b6c', '#8ca8a3', '#99ab83', '#c79782']) expect(contrast(fill, track)).toBeGreaterThanOrEqual(3);
  for (const badge of ['#718564', '#b77b59', '#7396a1', '#ab8299']) expect(contrast('#0b140d', badge)).toBeGreaterThanOrEqual(4.5);
});
