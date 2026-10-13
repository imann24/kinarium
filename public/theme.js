// Run before the app and stylesheet paint; this is also the single theme source of truth.
(() => {
  const key = 'kinarium-theme';
  const valid = value => value === 'light' || value === 'dark';
  const read = () => {
    try { const saved = localStorage.getItem(key); if (valid(saved)) return saved; } catch { /* Storage may be unavailable. */ }
    // Resolve missing or legacy System choices once; only light/dark are retained.
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  let preference = read();
  function save() {
    try { localStorage.setItem(key, preference); } catch { /* Keep the in-memory choice when storage is blocked. */ }
  }
  function apply() {
    document.documentElement.dataset.theme = preference;
    document.documentElement.style.colorScheme = preference;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preference === 'dark' ? '#18211d' : '#f8f8f2');
    window.dispatchEvent(new Event('kinarium-theme-change'));
  }
  window.kinariumTheme = {
    getPreference: () => preference,
    setPreference(value) {
      if (!valid(value)) return;
      preference = value;
      save();
      apply();
    },
  };
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = read(); save(); apply(); }
  });
  save();
  apply();
})();
