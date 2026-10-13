import { useEffect, useState } from 'react';

const storageKey = 'kinarium-journal-collapsed';

export function useJournalPanel() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    // This is a browser preference, independent of shared world state.
    try { localStorage.setItem(storageKey, String(collapsed)); }
    catch { /* Keep the toggle usable when browser storage is unavailable. */ }
  }, [collapsed]);

  return { collapsed, setCollapsed };
}
