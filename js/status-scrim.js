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
    ['/violet-dineros', 'lwvd'],
  ]);
  function update() {
    const installed = standalone.matches || navigator.standalone === true;
    const app = apps.get(location.hash.slice(1)) || '';
    if (installed && app) root.dataset.statusApp = app;
    else delete root.dataset.statusApp;
  }
  addEventListener('hashchange', update);
  addEventListener('pageshow', update);
  standalone.addEventListener('change', update);
  update();
})();
