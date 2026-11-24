// A classic script in <head> applies the theme before CSS or the GitHub feed arrives.
(() => {
  const key = 'atlas.appearance.v1';
  const root = document.documentElement;
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const normalize = value => ['light', 'dark'].includes(value) ? value : 'system';
  let preference = 'system';
  let transition;
  let pointerChoice = false;
  try { preference = normalize(localStorage.getItem(key)); } catch { /* Tab-only appearance. */ }

  const effectiveTheme = () => preference === 'system' ? (scheme.matches ? 'dark' : 'light') : preference;
  function apply() {
    const theme = effectiveTheme();
    root.dataset.theme = theme;
    root.dataset.appearance = preference;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0b1519' : '#f3f2e9';
    const radio = document.querySelector('input[name="atlas-appearance"][value="' + preference + '"]');
    if (radio) radio.checked = true;
    document.dispatchEvent(new Event('atlas:appearance'));
  }

  apply();
  document.addEventListener('DOMContentLoaded', apply, {once:true});
  document.addEventListener('pointerdown', event => { pointerChoice = Boolean(event.target.closest('.appearance')); });
  document.addEventListener('keydown', () => { pointerChoice = false; });
  document.addEventListener('change', event => {
    if (event.target.name !== 'atlas-appearance') return;
    preference = normalize(event.target.value);
    try { localStorage.setItem(key, preference); } catch { /* Keep the selection for this tab. */ }
    const changed = root.dataset.theme !== effectiveTheme();
    transition?.skipTransition();
    if (!changed || !pointerChoice || reduced.matches || !document.startViewTransition) {
      apply();
      return;
    }
    transition = document.startViewTransition(apply);
    pointerChoice = false;
  });
  scheme.addEventListener('change', () => { if (preference === 'system') apply(); });
  reduced.addEventListener('change', () => { if (reduced.matches) transition?.skipTransition(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = normalize(event.newValue);
    transition?.skipTransition();
    apply();
  });
})();
