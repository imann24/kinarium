import { isBuildVersion, type BuildVersion } from '../build-version';
import { HEARTBEAT_MS } from './heartbeat';

export function createVersionCheck(current: BuildVersion, onChange: (available: boolean) => void, options: {
  fetch?: typeof fetch; now?: () => number; eligible?: () => boolean;
} = {}) {
  const fetchVersion = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let last = now(); // No request or banner on initial load.
  let candidate = ''; let confirmations = 0; let active: AbortController | undefined; let disposed = false;
  return {
    async tick() {
      if (disposed || active || now() - last < HEARTBEAT_MS) return;
      last = now();
      if (options.eligible && !options.eligible()) { candidate = ''; confirmations = 0; return; }
      active = new AbortController();
      const timeout = setTimeout(() => active?.abort(), 10_000);
      const nonce = crypto.randomUUID();
      try {
        const response = await fetchVersion(`/api/version?nonce=${nonce}`, { cache: 'no-store', signal: active.signal });
        if (!response.ok) throw new Error('Version unavailable');
        const value = await response.json();
        if (!value || typeof value !== 'object' || !('nonce' in value) || value.nonce !== nonce || !isBuildVersion(value)) throw new Error('Unverified version');
        if (disposed) return;
        if (value.id === current.id || value.builtAt <= current.builtAt) {
          candidate = ''; confirmations = 0; onChange(false); return;
        }
        const key = `${value.id}:${value.builtAt}`;
        confirmations = candidate === key ? confirmations + 1 : 1;
        candidate = key;
        // Three consecutive observations, 50 seconds apart end-to-end, avoid brief rollouts.
        onChange(confirmations >= 3);
      } catch {
        candidate = ''; confirmations = 0;
        if (!disposed) onChange(false);
      } finally { clearTimeout(timeout); active = undefined; }
    },
    stop() { disposed = true; active?.abort(); },
  };
}

export function refreshToUpdate(confirm: (message: string) => boolean, reload: () => void) {
  if (confirm('Refresh to update? Any unsaved changes will be lost. Cancel to finish or save your edits first.')) reload();
}
