(() => {
  const root = document.documentElement;
  const standalone = matchMedia('(display-mode: standalone)');
  // Presentation adapters only; the existing router continues to own navigation.
  const apps = new Map([
    ['', 'home'], ['/', 'home'], ['/settings', 'settings'],
    ['/daily-chief-briefing', 'briefing'], ['/weather', 'weather'],
    ['/lee-lees-tracker', 'llt'], ['/digital-clock', 'clock'],
    ['/violet-sprints', 'sprints'], ['/violet-futbol-game-tracker', 'vfgt'],
    ['/road-bike-checklist', 'checklist'], ['/maintenance-total', 'imt'],
  ]);
  // iOS can pan the visual viewport independently when an editable field gains
  // focus. Keep LLT's existing scrim at that visible top, without moving the page.
  function updateLLTViewport() {
    if (root.dataset.statusApp === 'llt') {
      root.style.setProperty('--status-viewport-top', `${Math.max(0, globalThis.visualViewport?.offsetTop || 0)}px`);
    } else {
      root.style.removeProperty('--status-viewport-top');
    }
  }
  function update() {
    const installed = standalone.matches || navigator.standalone === true;
    const app = location.pathname.includes('/violet-dineros/') ? 'lwvd'
      : apps.get(location.hash.slice(1)) || '';
    if (installed && app) root.dataset.statusApp = app;
    else delete root.dataset.statusApp;
    updateLLTViewport();
  }
  globalThis.visualViewport?.addEventListener('resize', updateLLTViewport, { passive: true });
  globalThis.visualViewport?.addEventListener('scroll', updateLLTViewport, { passive: true });
  addEventListener('hashchange', update);
  addEventListener('pageshow', update);
  standalone.addEventListener('change', update);
  update();
})();
