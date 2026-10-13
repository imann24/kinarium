import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type ThemePreference = 'system' | 'light' | 'dark';
declare global {
  interface Window {
    kinariumTheme: { getPreference: () => ThemePreference; setPreference: (value: ThemePreference) => void };
  }
}
const subscribe = (notify: () => void) => {
  window.addEventListener('kinarium-theme-change', notify);
  return () => window.removeEventListener('kinarium-theme-change', notify);
};
const getPreference = () => window.kinariumTheme.getPreference();

export default function ThemeControl() {
  const preference = useSyncExternalStore(subscribe, getPreference);
  const Icon = preference === 'system' ? Monitor : preference === 'dark' ? Moon : Sun;
  return <label className="theme-control"><Icon size={15} aria-hidden="true"/><span className="sr-only">Color theme</span><select value={preference} onChange={event => window.kinariumTheme.setPreference(event.target.value as ThemePreference)}>
    <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
  </select></label>;
}
