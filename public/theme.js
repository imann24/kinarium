// Run before the app and stylesheet paint; this is also the single theme source of truth.
(() => {
  const key = 'kinarium-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark'].includes(value) ? value : 'system';
  const read = () => { try { return valid(localStorage.getItem(key)); } catch { return 'system'; } };
  let preference = read();
  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18211d' : '#f8f8f2');
    window.dispatchEvent(new Event('kinarium-theme-change'));
  }
  window.kinariumTheme = {
    getPreference: () => preference,
    setPreference(value) {
      preference = valid(value);
      try { if (preference === 'system') localStorage.removeItem(key); else localStorage.setItem(key, preference); } catch { /* Private browsing can disable storage. Keep the in-memory choice. */ }
      apply();
    },
  };
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = read(); apply(); }
  });
  apply();
})();
