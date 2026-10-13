import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

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
