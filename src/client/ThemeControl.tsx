import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type ThemePreference = 'light' | 'dark';
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
  const nextTheme = preference === 'dark' ? 'light' : 'dark';
  const Icon = nextTheme === 'light' ? Sun : Moon;
  const label = `Switch to ${nextTheme} mode`;
  return <button type="button" className="theme-control" aria-label={label} title={label} onClick={() => window.kinariumTheme.setPreference(nextTheme)}>
    <Icon size={18} aria-hidden="true"/>
  </button>;
}
