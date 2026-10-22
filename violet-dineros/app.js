import { STORAGE_KEY, money, parseMoney, dateParts, localToday, daysUntil, effectivePayday, validState } from './model.js';
const content = document.querySelector('main'), nav = document.querySelector('nav'), gear = document.querySelector('#settings');
let state = null, draft = { firstName: '', balanceCents: 0, payday: '', frequency: '', onboarded: true }, step = 1, tab = 'Home', storageBlocked = false;
try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) { const parsed = JSON.parse(stored); if (!validState(parsed)) throw Error(); state = parsed; } } catch { storageBlocked = true; }
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
 home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
 activity: '<rect x="5" y="3" width="15" height="19" rx="2"/><path d="M10 8h6M10 13h6M10 18h6M8 8h.01M8 13h.01M8 18h.01"/>',
 goals: '<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 10-10m-5 1 4 0v4"/>',
 insights: '<path d="M3 21V13h4v8M10 21V8h4v13M17 21V3h4v18"/>',
 calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18M7 14h2m3 0h2m3 0h1M7 18h2m3 0h2"/>',
 settings: '<path d="m9 3 1-2h4l1 2 3 2 2 0 2 4-2 2v3l2 2-2 4-3-1-2 2h-5l-1-2-3-1-2 0-2-4 2-2V9L2 7l2-4 3 1Z"/><circle cx="12" cy="11" r="3"/>',
 plus: '<path d="M12 5v14M5 12h14"/>',
 expense: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9 6h6m-6 4h6m-6 4h2m2 0h2m-6 4h2m2 0h2"/>',
 afford: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2m4 0h2M8 15h2m4 0h2M8 18h2m4 0h2"/>',
 user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const plant = '<img class="plant" src="../icons/violet-dineros.svg" alt="" aria-hidden="true">';
function save(next) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); state = next; return true; }
  catch { document.querySelector('#notice').textContent = 'Your changes could not be saved. Check that browser storage is available and try again.'; return false; }
}
function focusHeading() { const h = content.querySelector('h1'); h.tabIndex = -1; h.focus(); }
function onboarding() {
  gear.hidden = nav.hidden = true;
  if (storageBlocked) { content.innerHTML = '<section class="card"><h1>Your saved information needs attention</h1><p>We couldn’t read your local data. Please check browser storage and reload. Your saved information has not been replaced.</p></section>'; return; }
  document.body.dataset.screen = 'onboarding';
  const fields = step === 1 ? `<div class="welcome-brand">${plant}<h2>Violet Dineros</h2><p>Your money. Your goals.</p></div><h1>Hey!</h1><p class="onboarding-question">Let’s make money<br>a little easier. 💜</p><label for="name">What’s your first name?</label><input id="name" name="firstName" autocomplete="given-name" maxlength="40" required value="${escape(draft.firstName)}">` : step === 2 ? `<h1>Your Money</h1><p class="onboarding-question">How much money<br>do you have right now?</p><p>This will be your starting balance.<br>It isn’t recorded as income.</p><label for="balance">Your money ($)</label><input id="balance" name="balance" inputmode="decimal" required placeholder="0.00" value="${escape(draft.balanceInput || '')}">` : `<h1>Next Payday</h1><p class="onboarding-question">When do you get<br>paid again?</p><p>This step is optional.<br>You can set or change it later<br>in Settings.</p><label for="payday">Next payday (optional)</label><input id="payday" name="payday" type="date" value="${draft.payday}">`;
  content.innerHTML = `<section class="welcome">${step > 1 ? `<div class="steps" aria-label="Step ${step} of 3">${[1, 2, 3].map(n => `<span class="${n === step ? 'active' : ''}">${n}</span>`).join('<i></i>')}</div>` : ''}<form>${fields}<p class="error" role="alert"></p>${step === 3 ? '<button class="text-button" type="button" id="skip">Skip for now</button>' : ''}<div class="form-actions">${step > 1 ? '<button class="text-button" type="button" id="back">Back</button>' : ''}<button class="primary">Continue</button></div></form></section>`;
  const finish = () => {
    content.innerHTML = `<section class="welcome complete">${plant}<h1>You’re all set!</h1><p>Your money journey<br>starts now.<br>Let’s do this! ✨</p><button class="primary" id="dashboard">Go to My Dashboard</button></section>`;
    content.querySelector('#dashboard').onclick = () => { if (save({ ...draft, balanceInput: undefined })) { render(); focusHeading(); } };
    focusHeading();
  };
  content.querySelector('form').onsubmit = event => {
    event.preventDefault(); const data = new FormData(event.target);
    if (step === 1) { draft.firstName = data.get('firstName').trim(); if (!draft.firstName) { content.querySelector('.error').textContent = 'Please enter your first name.'; return; } }
    if (step === 2) { const amount = parseMoney(data.get('balance')); if (amount === null) { content.querySelector('.error').textContent = 'Enter a nonnegative dollar amount with up to two decimal places.'; return; } draft.balanceCents = amount; draft.balanceInput = data.get('balance'); }
    if (step === 3) { draft.payday = data.get('payday'); if (draft.payday && !dateParts(draft.payday)) return; finish(); return; }
    step++; onboarding(); focusHeading();
  };
  content.querySelector('#back')?.addEventListener('click', () => { step--; onboarding(); focusHeading(); });
  content.querySelector('#skip')?.addEventListener('click', () => { draft.payday = ''; finish(); });
}
function settings() {
  content.innerHTML = `${launcherBack}<section class="settings-panel"><div class="settings-title"><button type="button" id="settings-back" aria-label="Back to Home">‹</button><h1>Settings</h1></div><form><h2>Personalization</h2><div class="setting-row"><div class="setting-icon">${icon('user')}</div><div><label for="name">First name</label><input id="name" name="firstName" required maxlength="40" autocomplete="given-name" value="${escape(state.firstName)}"></div></div><h2>Your Money</h2><div class="setting-row"><div class="setting-icon">${icon('calendar')}</div><div><label for="payday">Next payday</label><input id="payday" name="payday" type="date" value="${effectivePayday(state.payday, state.frequency)}"></div></div><div class="setting-row"><div class="setting-icon">${icon('calendar')}</div><div><label for="frequency">Pay frequency (optional)</label><select id="frequency" name="frequency">${[['', 'Not set'], ['weekly', 'Weekly'], ['biweekly', 'Every Two Weeks'], ['monthly', 'Monthly']].map(([value, label]) => `<option value="${value}" ${state.frequency === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div><p class="hint">Recurring dates move forward after payday. Monthly dates use the last day of shorter months, then return to your chosen day. Money is never added automatically.</p><p class="error" role="alert"></p><button class="primary">Save settings</button><button type="button" id="cancel">Back to Home</button></form></section>`;
  content.querySelector('form').onsubmit = event => { event.preventDefault(); const data = new FormData(event.target), firstName = data.get('firstName').trim(), payday = data.get('payday'), frequency = data.get('frequency'); if (!firstName) { content.querySelector('.error').textContent = 'Please enter your first name.'; return; }
    // Keep the original monthly anchor when the displayed recurring date is unchanged.
    const anchor = payday === effectivePayday(state.payday, state.frequency) && frequency === state.frequency ? state.payday : payday;
    if (save({ ...state, firstName, payday: anchor, frequency })) { tab = 'Home'; render(); document.querySelector('#notice').textContent = 'Settings saved.'; focusHeading(); }
  };
  content.querySelector('#settings-back').onclick = () => { tab = 'Home'; render(); focusHeading(); };
  content.querySelector('#cancel').onclick = () => { tab = 'Home'; render(); focusHeading(); };
}
const launcherBack = `<a class="ecosystem_nav_back" href="../index.html#/" aria-label="Return to Lando's World home"><span aria-hidden="true">←</span><span>Lando’s World</span></a>`;
function render() {
  if (!state) { onboarding(); return; }
  document.body.dataset.screen = tab.toLowerCase();
  gear.hidden = tab !== 'Home'; nav.hidden = false;
  gear.innerHTML = icon('settings');
  nav.innerHTML = ['Home', 'Activity', 'Goals', 'Insights'].map((label, i) => `<button ${tab === label ? 'aria-current="page"' : ''} data-tab="${label}"><span aria-hidden="true">${icon(['home', 'activity', 'goals', 'insights'][i])}</span>${label}</button>`).join('');
  nav.querySelectorAll('button').forEach(button => button.onclick = () => { tab = button.dataset.tab; render(); focusHeading(); });
  if (tab === 'Settings') { settings(); return; }
  if (tab !== 'Home') {
    const details = {
      Activity: ['Your activity history<br>is coming soon!', 'You’ll be able to see your income, expenses, and savings movements all in one place.'],
      Goals: ['Start saving for<br>what you love!', 'Goal tracking, savings, and milestone celebrations are coming soon.'],
      Insights: ['Your spending insights<br>are coming soon!', 'You’ll see helpful charts and personalized insights to understand your spending and make smarter choices.']
    };
    content.innerHTML = `<section class="empty">${launcherBack}<h1>${tab}</h1><div class="empty-body"><div class="empty-icon">${icon(tab.toLowerCase())}</div><h2>${details[tab][0]}</h2><p>${details[tab][1]}</p></div></section>`; return;
  }
  const payday = effectivePayday(state.payday, state.frequency), days = daysUntil(payday);
  const paydayLabel = dateParts(payday) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${payday}T12:00:00`)) : '';
  content.innerHTML = `<div class="greeting">${launcherBack}<h1>Hey, ${escape(state.firstName)}!</h1><p>Your money. Your goals.</p></div><section class="money-story" aria-labelledby="story-title"><div class="story"><h2 id="story-title">Your Money Story</h2><p class="balance">${money(state.balanceCents)}</p><p>You have ${money(state.balanceCents)} right now.</p></div>${days > 0 ? `<div class="payday-grid"><div class="payday-card"><span class="calendar-icon">${icon('calendar')}</span><div><p>Next paycheck in</p><strong>${days} ${days === 1 ? 'day' : 'days'}</strong><p>${paydayLabel}</p></div></div><div class="daily-card"><p>Aim for about</p><p class="guide">${money(Math.round(state.balanceCents / days))} a day</p><p>to make your money last.</p></div></div><p class="guidance-note">A gentle guide, not a strict spending limit.</p>` : `<div class="payday-prompt ${days !== null ? 'expired' : ''}"><div><span class="calendar-icon">${icon('calendar')}</span><p>${days === null ? 'Set your next payday<br>to see your daily guide.' : days === 0 ? 'Your payday is today.<br>Update your payday to see your daily guide.' : 'Your payday has passed.<br>Update your payday to see your daily guide.'}</p></div><button class="primary" id="set-payday">${days === null ? 'Set Payday' : 'Update Payday'}</button></div>`}</section><section aria-label="Quick actions"><div class="section-title"><h2>Quick Actions</h2><span>Coming soon</span></div><div class="quick">${[['plus', 'Add Money'], ['expense', 'Add Expense'], ['afford', 'Can I Afford This?']].map(([name, label]) => `<button disabled><span>${icon(name)}</span>${label}<small>Coming soon</small></button>`).join('')}</div></section><section class="goal"><span class="goal-star">${icon('goals')}</span><div><h2>Featured Goal <span>(Coming Soon)</span></h2><p>Start saving for something awesome.</p></div></section><section class="motivation"><span aria-hidden="true">✧</span><div><h2>Small steps count.</h2><p>XP, levels, and weekly challenges are coming soon.</p></div></section>`;
  content.querySelector('#set-payday')?.addEventListener('click', openSettings);
}
function openSettings() { tab = 'Settings'; render(); focusHeading(); }
gear.onclick = openSettings;
window.addEventListener('pageshow', event => {
  if (event.persisted) window.LandosTheme?.init();
  render();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state && tab !== 'Settings') render(); });
// Refresh calendar-day guidance while Home remains open across midnight.
setInterval(() => { if (state && tab === 'Home' && !document.hidden && localToday() !== renderedDay) { renderedDay = localToday(); render(); } }, 30000);
let renderedDay = localToday();
render();
