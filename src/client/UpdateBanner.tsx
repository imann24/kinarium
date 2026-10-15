import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BuildVersion } from '../build-version';
import { HEARTBEAT_MS } from './heartbeat';
import { createVersionCheck, refreshToUpdate } from './version-check';
import './update-banner.css';

declare const __BUILD_VERSION__: BuildVersion;
export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [host, setHost] = useState<Element>(document.body);
  useEffect(() => {
    const changed = () => setHost(document.fullscreenElement ?? document.body);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const check = createVersionCheck(__BUILD_VERSION__, setAvailable, {
      eligible: () => document.visibilityState === 'visible' && navigator.onLine,
    });
    const timer = setInterval(() => void check.tick(), HEARTBEAT_MS);
    return () => { clearInterval(timer); check.stop(); };
  }, []);
  return available ? createPortal(<aside className="update-banner" aria-label="Site update"><span role="status">A new version of Kinarium is ready.</span><button type="button" onClick={() => refreshToUpdate(message => window.confirm(message), () => window.location.reload())}>Refresh to update</button></aside>, host) : null;
}
