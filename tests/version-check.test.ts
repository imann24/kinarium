import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVersionCheck, refreshToUpdate } from '../src/client/version-check';
import { deployedVersion } from '../src/server/build-version';
import { HEARTBEAT_MS } from '../src/client/heartbeat';
const current = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', builtAt: 100 };
const newer = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', builtAt: 200 };
afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers(); let version: unknown = current; let failure = false; let eligible = true; let stale = false;
  const changed = vi.fn();
  const fetcher = vi.fn(async (url: RequestInfo | URL) => {
    if (failure) throw new Error('offline');
    return Response.json({ ...(version as object), nonce: stale ? 'stale' : new URL(String(url), 'https://test').searchParams.get('nonce') });
  });
  const check = createVersionCheck(current, changed, { fetch: fetcher, eligible: () => eligible });
  return { check, changed, fetcher, version: (v: unknown) => { version = v; }, fail: (v: boolean) => { failure = v; }, stale: () => { stale = true; }, eligible: (v: boolean) => { eligible = v; }, tick: async () => { vi.advanceTimersByTime(HEARTBEAT_MS); await check.tick(); } };
}
describe('deployment checks', () => {
  it('does not fetch initially, throttles repeated calls, and ignores the same version', async () => {
    const t = setup(); await t.check.tick(); expect(t.fetcher).not.toHaveBeenCalled();
    await t.tick(); await t.check.tick(); expect(t.fetcher).toHaveBeenCalledTimes(1);
    expect(t.changed).toHaveBeenLastCalledWith(false);
    expect(t.fetcher.mock.calls[0][0]).toMatch(/^\/api\/version\?nonce=/);
  });
  it('requires three consecutive newer observations and retracts a rollback', async () => {
    const t = setup(); t.version(newer);
    await t.tick(); await t.tick(); expect(t.changed).not.toHaveBeenCalledWith(true);
    await t.tick(); expect(t.changed).toHaveBeenLastCalledWith(true);
    t.version(current); await t.tick(); expect(t.changed).toHaveBeenLastCalledWith(false);
  });
  it('resets confirmation on errors and rolling deployments', async () => {
    const t = setup(); t.version(newer); await t.tick(); t.fail(true); await t.tick();
    t.fail(false); await t.tick(); t.version(current); await t.tick();
    t.version(newer); await t.tick(); await t.tick(); expect(t.changed).not.toHaveBeenCalledWith(true);
  });
  it('ignores older, malformed and cached responses', async () => {
    const t = setup();
    for (const v of [{ ...newer, builtAt: 50 }, {}, newer]) {
      t.version(v); if (v === newer) t.stale();
      await t.tick(); await t.tick(); await t.tick();
    }
    expect(t.changed).not.toHaveBeenCalledWith(true);
  });
  it('skips hidden/offline checks and stops cleanly', async () => {
    const t = setup(); t.eligible(false); await t.tick(); expect(t.fetcher).not.toHaveBeenCalled();
    t.eligible(true); await t.tick(); t.check.stop(); await t.tick(); expect(t.fetcher).toHaveBeenCalledTimes(1);
  });
  it('prevents overlapping requests and aborts slow requests', async () => {
    vi.useFakeTimers(); const changed = vi.fn(); let signal: AbortSignal | undefined;
    const fetcher = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      signal = init?.signal as AbortSignal; signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const check = createVersionCheck(current, changed, { fetch: fetcher });
    vi.advanceTimersByTime(HEARTBEAT_MS); const pending = check.tick(); await check.tick();
    expect(fetcher).toHaveBeenCalledTimes(1); await vi.advanceTimersByTimeAsync(10_000); await pending;
    expect(signal?.aborted).toBe(true); expect(changed).toHaveBeenLastCalledWith(false); check.stop();
  });
  it('only reloads after explicit confirmation', () => {
    const reload = vi.fn(); const confirm = vi.fn(() => false);
    refreshToUpdate(confirm, reload); expect(reload).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('unsaved changes'));
    confirm.mockReturnValue(true); refreshToUpdate(confirm, reload); expect(reload).toHaveBeenCalledTimes(1);
  });
});
describe('cache-safe deployed identity', () => {
  it('reads the deployment asset, echoes a fresh nonce and prevents response caching', async () => {
    const fetcher = vi.fn(async () => Response.json(newer));
    const response = await deployedVersion(new Request(`https://test/api/version?nonce=${current.id}`), { fetch: fetcher } as unknown as Pick<Fetcher, 'fetch'>);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(await response.json()).toEqual({ ...newer, nonce: current.id });
    expect((fetcher.mock.calls as unknown[][])[0][0]).toHaveProperty('url', 'https://test/build-version.json');
  });
  it('treats missing manifests, SPA fallbacks and asset errors as unavailable', async () => {
    for (const make of [() => new Response('missing', { status: 404 }), () => new Response('<html>'), () => Response.json({}), () => { throw new Error('offline'); }]) {
      const response = await deployedVersion(new Request(`https://test/api/version?nonce=${current.id}`), { fetch: async () => make() } as unknown as Pick<Fetcher, 'fetch'>);
      expect(response.status).toBe(503); expect(response.headers.get('Cache-Control')).toContain('no-store');
    }
  });
});
