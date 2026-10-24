import { STORAGE_KEY, money, parseMoney, dateParts, localToday, daysUntil, effectivePayday, validState, TRANSACTION_LABELS, currentBalance, dailyGuide, activityGroups, availableBalance, reservedBalance, fundedReservations, updateGoal, purchaseGoal, affordability } from './model.js';
const content = document.querySelector('main'), nav = document.querySelector('nav'), gear = document.querySelector('#settings');
let state = null, draft = { firstName: '', balanceCents: 0, payday: '', frequency: '', onboarded: true }, step = 1, tab = 'Home', storageBlocked = false, lastRaw = null;
let noticeTimer = null, sheetOpener = null, sheetScroll = null;
let activitySearch = '', activityFilter = 'all', affordabilityInput = '';
let affordabilityRaw = null;
try { const stored = localStorage.getItem(STORAGE_KEY); lastRaw = stored; if (stored) { const parsed = JSON.parse(stored); if (!validState(parsed)) throw Error(); state = parsed; } } catch { storageBlocked = true; }
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
 home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
 activity: '<rect x="5" y="3" width="15" height="19" rx="2"/><path d="M10 8h6M10 13h6M10 18h6M8 8h.01M8 13h.01M8 18h.01"/>',
 goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 chevron: '<path d="m9 5 7 7-7 7"/>',
 search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
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
function announce(message) {
  clearTimeout(noticeTimer);
  const notice = document.querySelector('#notice'); notice.dataset.kind = 'success'; notice.textContent = message;
  noticeTimer = setTimeout(() => { notice.textContent = ''; }, 2500);
}
function showSaveError(message) {
  clearTimeout(noticeTimer);
  document.querySelector('#notice').dataset.kind = 'error';
  const dialog = document.querySelector('#transaction-sheet');
  if (dialog?.open) {
    let error = dialog.querySelector('.error');
    if (!error) { error = document.createElement('p'); error.className = 'error'; error.setAttribute('role', 'alert'); (dialog.querySelector('.sheet-body') || dialog).appendChild(error); }
    error.textContent = message;
  }
  document.querySelector('#notice').textContent = message;
}
function save(next) {
  if (reservedBalance(next) > 0n && !fundedReservations(next)) { showSaveError('Release goal funds first. This change would spend money reserved for your goals.'); return false; }
  if (!validState(next)) { showSaveError('This amount would make your balance too large to save. Try a smaller amount.'); return false; }
  try {
    if (localStorage.getItem(STORAGE_KEY) !== lastRaw) {
      showSaveError('Your information changed in another tab. Reload before saving so those changes stay safe.'); return false;
    }
    const raw = JSON.stringify(next);
    localStorage.setItem(STORAGE_KEY, raw);
    state = next; lastRaw = raw; clearTimeout(noticeTimer); document.querySelector('#notice').textContent = ''; return true;
  } catch {
    showSaveError('Your changes could not be saved. Check that browser storage is available and try again.');
    return false;
  }
}
function focusFirstField(root) {
  const field = root.querySelector('form input:enabled:not([type=hidden]):not([readonly]), form select:enabled, form textarea:enabled:not([readonly])');
  if (!field) return false;
  field.focus({preventScroll:root !== content}); return true;
}
function focusPageStart() {
  if (focusFirstField(content)) return;
  const h = content.querySelector('h1'); h.tabIndex = -1; h.focus();
}
function onboarding() {
  gear.hidden = nav.hidden = true;
  if (storageBlocked) { content.innerHTML = '<section class="card"><h1>Your saved information needs attention</h1><p>We couldn’t read your local data. Please check browser storage and reload. Your saved information has not been replaced.</p></section>'; return; }
  document.body.dataset.screen = 'onboarding';
  const fields = step === 1 ? `<div class="welcome-brand">${plant}<h2>Violet Dineros</h2><p>Your money. Your goals.</p></div><h1>Hey!</h1><p class="onboarding-question">Let’s make money<br>a little easier. 💜</p><label for="name">What’s your first name?</label><input id="name" name="firstName" autocomplete="given-name" maxlength="40" required value="${escape(draft.firstName)}">` : step === 2 ? `<h1>Your Money</h1><p class="onboarding-question">How much money<br>do you have right now?</p><p>This will be your starting balance.<br>It isn’t recorded as income.</p><label for="balance">Your money ($)</label><div class="currency-input"><span aria-hidden="true">$</span><input id="balance" name="balance" inputmode="decimal" required placeholder="0.00" value="${escape(draft.balanceInput || '')}"></div>` : `<h1>Next Payday</h1><p class="onboarding-question">When do you get<br>paid again?</p><p>This step is optional.<br>You can set or change it later<br>in Settings.</p><label for="payday">Next payday (optional)</label><input id="payday" name="payday" type="date" value="${draft.payday}">`;
  content.innerHTML = `<section class="welcome">${step > 1 ? `<div class="steps" aria-label="Step ${step} of 3">${[1, 2, 3].map(n => `<span class="${n === step ? 'active' : ''}">${n}</span>`).join('<i></i>')}</div>` : ''}<form>${fields}<p class="error" role="alert"></p>${step === 3 ? '<button class="text-button" type="button" id="skip">Skip for now</button>' : ''}<div class="form-actions">${step > 1 ? '<button class="text-button" type="button" id="back">Back</button>' : ''}<button class="primary">Continue</button></div></form></section>`;
  const finish = () => {
    content.innerHTML = `<section class="welcome complete">${plant}<h1>You’re all set!</h1><p>Your money journey<br>starts now.<br>Let’s do this! ✨</p><button class="primary" id="dashboard">Go to My Dashboard</button></section>`;
    content.querySelector('#dashboard').onclick = () => { if (save({ ...draft, balanceInput: undefined })) { render(); focusPageStart(); } };
    focusPageStart();
  };
  content.querySelector('form').onsubmit = event => {
    event.preventDefault(); const data = new FormData(event.target);
    if (step === 1) { draft.firstName = data.get('firstName').trim(); if (!draft.firstName) { content.querySelector('.error').textContent = 'Please enter your first name.'; return; } }
    if (step === 2) { const amount = parseMoney(data.get('balance')); if (amount === null) { content.querySelector('.error').textContent = 'Enter a nonnegative dollar amount with up to two decimal places.'; return; } draft.balanceCents = amount; draft.balanceInput = data.get('balance'); }
    if (step === 3) { draft.payday = data.get('payday'); if (draft.payday && !dateParts(draft.payday)) return; finish(); return; }
    step++; onboarding(); focusPageStart();
  };
  content.querySelector('#back')?.addEventListener('click', () => { step--; onboarding(); focusPageStart(); });
  content.querySelector('#skip')?.addEventListener('click', () => { draft.payday = ''; finish(); });
  focusPageStart();
}
function settings() {
  content.innerHTML = `${launcherBack}<section class="settings-panel"><div class="settings-title"><button type="button" id="settings-back" class="back-circle" aria-label="Back to Home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><h1>Settings</h1></div><form><h2>Personalization</h2><div class="setting-row"><div class="setting-icon">${icon('user')}</div><div><label for="name">First name</label><input id="name" name="firstName" required maxlength="40" autocomplete="given-name" value="${escape(state.firstName)}"></div></div><h2>Your Money</h2><button type="button" id="edit-starting-balance" class="setting-row balance-setting"><span class="setting-icon"><img src="../icons/violet-dineros.svg" alt=""></span><div><span class="setting-label">Starting Balance</span><strong>${money(state.balanceCents)}</strong></div><span class="navigation-chevron" aria-hidden="true">${icon('chevron')}</span></button><div class="setting-row"><div class="setting-icon">${icon('calendar')}</div><div><label for="payday">Next payday</label><input id="payday" name="payday" type="date" value="${effectivePayday(state.payday, state.frequency)}"></div></div><div class="setting-row"><div class="setting-icon">${icon('calendar')}</div><div><label for="frequency">Pay frequency (optional)</label><select id="frequency" name="frequency">${[['', 'Not set'], ['weekly', 'Weekly'], ['biweekly', 'Every Two Weeks'], ['monthly', 'Monthly']].map(([value, label]) => `<option value="${value}" ${state.frequency === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div><p class="hint">Recurring dates move forward after payday. Monthly dates use the last day of shorter months, then return to your chosen day. Money is never added automatically.</p><p class="error" role="alert"></p><div class="settings-actions"><button class="primary">Save Settings</button><button type="button" id="cancel">Back to Home</button></div></form></section>`;
  content.querySelector('form').onsubmit = event => { event.preventDefault(); const data = new FormData(event.target), firstName = data.get('firstName').trim(), payday = data.get('payday'), frequency = data.get('frequency'); if (!firstName) { content.querySelector('.error').textContent = 'Please enter your first name.'; return; }
    // Keep the original monthly anchor when the displayed recurring date is unchanged.
    const anchor = payday === effectivePayday(state.payday, state.frequency) && frequency === state.frequency ? state.payday : payday;
    if (save({ ...state, firstName, payday: anchor, frequency })) { tab = 'Home'; render(); announce('Settings saved.'); focusPageStart(); }
  };
  content.querySelector('#edit-starting-balance').onclick = () => { tab = 'Balance'; render(); focusPageStart(); };
  content.querySelector('#settings-back').onclick = () => { tab = 'Home'; render(); focusPageStart(); };
  content.querySelector('#cancel').onclick = () => { tab = 'Home'; render(); focusPageStart(); };
}
function editStartingBalance() {
  content.innerHTML = `${launcherBack}<section class="settings-panel"><div class="settings-title"><button type="button" id="balance-back" class="back-circle" aria-label="Back to Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><h1>Edit Starting Balance</h1></div><form><p>How much money did you start with?</p><label for="starting-balance">Starting Balance ($)</label><div class="currency-input"><span aria-hidden="true">$</span><input id="starting-balance" name="startingBalance" inputmode="decimal" value="${(state.balanceCents / 100).toFixed(2)}" aria-describedby="balance-error"></div><p class="error" id="balance-error" role="alert"></p><button class="primary">Save</button><button type="button" id="balance-cancel">Cancel</button></form></section>`;
  const back = () => { tab = 'Settings'; render(); focusPageStart(); };
  content.querySelector('#balance-back').onclick = back;
  content.querySelector('#balance-cancel').onclick = back;
  content.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const amount = parseMoney(new FormData(event.target).get('startingBalance'));
    const input = content.querySelector('#starting-balance');
    if (amount === null) {
      content.querySelector('#balance-error').textContent = 'Enter zero or a positive dollar amount with up to two decimal places.';
      input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    input.removeAttribute('aria-invalid');
    if (amount === state.balanceCents) { back(); return; }
    if (save({ ...state, balanceCents: amount })) {
      back(); announce('Starting Balance saved.');
    }
  };
}
const launcherBack = `<a class="ecosystem_nav_back" href="../index.html#/" aria-label="Return to Lando's World home"><span aria-hidden="true">←</span><span>Lando’s World</span></a>`;
function render() {
  if (!state) { onboarding(); return; }
  document.body.dataset.screen = tab.toLowerCase();
  gear.hidden = tab !== 'Home'; nav.hidden = false;
  gear.innerHTML = icon('settings');
  nav.innerHTML = ['Home', 'Activity', 'Goals', 'Insights'].map((label, i) => `<button ${tab === label ? 'aria-current="page"' : ''} data-tab="${label}"><span aria-hidden="true">${icon(['home', 'activity', 'goals', 'insights'][i])}</span>${label}</button>`).join('');
  nav.querySelectorAll('button').forEach(button => button.onclick = () => { tab = button.dataset.tab; render(); focusPageStart(); });
  if (tab === 'Afford') { renderAffordability(); return; }
  if (tab === 'Activity') { renderActivity(); return; }
  if (tab === 'Goals') { renderGoals(); return; }
  if (tab === 'Balance') { editStartingBalance(); return; }
  if (tab === 'Settings') { settings(); return; }
  if (tab !== 'Home') {
    const details = {
      Activity: ['Your activity history<br>is coming soon!', 'You’ll be able to see your income, expenses, and savings movements all in one place.'],
      Goals: ['Start saving for<br>what you love!', 'Goal tracking, savings, and milestone celebrations are coming soon.'],
      Insights: ['Your spending insights<br>are coming soon!', 'You’ll see helpful charts and personalized insights to understand your spending and make smarter choices.']
    };
    content.innerHTML = `<section class="empty">${launcherBack}<h1>${tab}</h1><div class="empty-body"><div class="empty-icon">${icon(tab.toLowerCase())}</div><h2>${details[tab][0]}</h2><p>${details[tab][1]}</p></div></section>`; return;
  }
  const payday = effectivePayday(state.payday, state.frequency), days = daysUntil(payday), available = availableBalance(state);
  const paydayLabel = dateParts(payday) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${payday}T12:00:00`)) : '';
  content.innerHTML = `<div class="greeting">${launcherBack}<h1>Hey, ${escape(state.firstName)}!</h1><p>Your money. Your goals.</p></div><section class="money-story" aria-label="Available to spend"><div class="story"><p>You have</p><p class="balance">${money(available)}</p><p>available to spend right now.</p>${reservedBalance(state) > 0n ? `<p>Plus <span class="numeric">${money(Number(reservedBalance(state)))}</span> saved for your goals.</p>` : ''}</div>${days > 0 ? `<div class="payday-grid"><div class="payday-card"><span class="calendar-icon">${icon('calendar')}</span><div><p>Next paycheck in</p><strong><span class="numeric">${days}</span> ${days === 1 ? 'day' : 'days'}</strong><p class="numeric">${paydayLabel}</p></div></div><div class="daily-card"><p>Aim for about</p><p class="guide"><span class="numeric">${money(dailyGuide(available, days))}</span> a day</p><p>to make your money last.</p></div></div>` : `<div class="payday-prompt ${days !== null ? 'expired' : ''}"><div><span class="calendar-icon">${icon('calendar')}</span><p>${days === null ? 'Set your next payday<br>to see your daily guide.' : days === 0 ? 'Your payday is today.<br>Update your payday to see your daily guide.' : 'Your payday has passed.<br>Update your payday to see your daily guide.'}</p></div><button class="primary" id="set-payday">${days === null ? 'Set Payday' : 'Update Payday'}</button></div>`}</section><section aria-label="Quick actions"><div class="section-title"><h2>Quick Actions</h2></div><div class="quick">${[['plus', 'Add Money'], ['expense', 'Add Expense'], ['afford', 'Can I Afford This?']].map(([name, label]) => `<button ${name === 'afford' ? 'id="check-affordability"' : `data-transaction-type="${name === 'plus' ? 'income' : 'expense'}"`}><span>${icon(name)}</span>${label}</button>`).join('')}</div></section>${featuredGoal()}<section class="motivation"><span aria-hidden="true">✧</span><div><h2>Small steps count.</h2><p>XP, levels, and weekly challenges are coming soon.</p></div></section>`;
  content.querySelector('#featured-goal')?.addEventListener('click', () => { const goal = (state.goals || []).find(g => !g.archived); if (goal) showGoal(goal.id); else { tab = 'Goals'; render(); focusPageStart(); } });
  content.querySelector('#check-affordability').onclick = () => { affordabilityInput = ''; tab = 'Afford'; render(); window.scrollTo(0, 0); focusPageStart(); };
  content.querySelector('#set-payday')?.addEventListener('click', openSettings);
  content.querySelectorAll('[data-transaction-type]').forEach(button => button.onclick = () => { button.focus({preventScroll:true}); openTransactionForm(button.dataset.transactionType); });
}
function renderAffordability() {
  affordabilityRaw = lastRaw;
  content.innerHTML = `${launcherBack}<section class="settings-panel affordability"><div class="settings-title"><button type="button" id="afford-back" class="back-circle" aria-label="Back to Home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><h1>Can I Afford This?</h1></div><div class="story"><p>Available to spend</p><p class="afford-available numeric">${money(availableBalance(state))}</p><p>Money saved for your goals stays set aside.</p></div><form novalidate><label for="afford-price">How much does it cost?</label><div class="currency-input"><span aria-hidden="true">$</span><input id="afford-price" name="price" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${escape(affordabilityInput)}" aria-describedby="afford-hint"></div><p class="hint" id="afford-hint">Enter a price like 25 or 25.50, without commas or a $ sign.</p><div id="afford-result" class="afford-result" role="status" aria-live="polite" aria-atomic="true"></div><button type="submit" class="primary" id="afford-buy" disabled>Buy It</button><p class="hint">Just a preview. Buy It opens Add Expense; only Save Expense records a purchase.</p></form></section>`;
  const input = content.querySelector('#afford-price'), result = content.querySelector('#afford-result'), buy = content.querySelector('#afford-buy');
  const update = () => {
    affordabilityInput = input.value;
    const check = affordability(state, input.value);
    buy.disabled = !check.affordable;
    result.dataset.kind = check.status;
    input.setAttribute('aria-invalid', String(check.status === 'invalid'));
    result.innerHTML = check.status === 'blank' ? '<h2>Something caught your eye?</h2><p>Enter its price to see how it fits.</p>' : check.status === 'invalid' ? '<h2>Let’s check that price.</h2><p>Use an amount greater than zero with up to two decimal places.</p>' : check.affordable ? `<h2>Yes, it fits!</h2><p>You’d have <span class="numeric">${money(check.remainingCents)}</span> left to spend.${check.remainingCents === 0 ? ' That uses all your available spending money.' : ''}</p>` : `<h2>Not quite yet.</h2><p>You’d need <span class="numeric">${money(check.shortageCents)}</span> more, keeping your goal savings safe.</p>`;
  };
  input.oninput = update; update();
  content.querySelector('#afford-back').onclick = () => { affordabilityInput = ''; tab = 'Home'; render(); window.scrollTo(0, 0); content.querySelector('#check-affordability').focus({preventScroll:true}); };
  content.querySelector('form').onsubmit = event => {
    event.preventDefault();
    if (transactionSheet.open) return;
    if (!affordabilityIsCurrent(affordabilityRaw)) return;
    const check = affordability(state, input.value); update();
    if (check.affordable) { buy.focus({preventScroll:true}); openTransactionForm('expense', null, check.priceCents); }
  };
}
function affordabilityIsCurrent(expectedRaw) {
  try { if (localStorage.getItem(STORAGE_KEY) === expectedRaw) return true; } catch { /* Keep the preview read-only if storage is unavailable. */ }
  showSaveError('Your money information changed or is unavailable. Reload to check the current available funds.');
  return false;
}
function goalProgress(goal) {
  return `<p><span class="numeric">${money(goal.reservedCents)}</span> of <span class="numeric">${money(goal.targetCents)}</span> reserved${goal.reservedCents === goal.targetCents ? ' · Fully Funded' : ''}</p><progress class="goal-progress" max="${goal.targetCents}" value="${goal.reservedCents}" aria-label="${escape(goal.name)} funding progress"></progress>`;
}
function featuredGoal() {
  const goal = (state.goals || []).find(g => !g.archived);
  return `<section class="goal featured"><span class="goal-star" aria-hidden="true">${icon('goals')}</span><div><h2>Featured Goal</h2>${goal ? `<h3>${escape(goal.emoji)} ${escape(goal.name)}</h3>${goalProgress(goal)}` : '<p>Start saving for something awesome.</p>'}</div><button type="button" id="featured-goal" aria-label="${goal ? `View Goal: ${escape(goal.name)}` : 'Create a Goal'}"><span class="navigation-chevron" aria-hidden="true">${icon('chevron')}</span></button></section>`;
}
function renderGoals() {
  const goals = state.goals || [];
  content.innerHTML = `${launcherBack}<section class="goals"><h1>Goals</h1><p><span class="numeric">${money(availableBalance(state))}</span> available to reserve</p><p>Reserved money stays in your total balance. Your Daily Guide uses what’s available to spend.</p><button class="primary" id="create-goal">Create Goal</button><div class="goal-list">${goals.length ? goals.map(g => `<article class="card goal-card"><h2>${escape(g.emoji)} ${escape(g.name)}</h2>${g.archived ? '<p>Archived</p>' : goalProgress(g)}<button type="button" data-goal="${escape(g.id)}" aria-label="${g.archived ? 'Manage Archived Goal' : 'Manage Goal'}: ${escape(g.name)}">${g.archived ? 'Manage Archived Goal' : 'Manage Goal'}</button></article>`).join('') : `<div class="empty-icon">${icon('goals')}</div><p>No goals yet. Create your first goal to start setting money aside.</p>`}</div></section>`;
  content.querySelector('#create-goal').onclick = () => openGoalForm();
  content.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => showGoal(b.dataset.goal));
}
function newId() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); }
function commitGoal(next, message) {
  if (!save(next)) return false;
  render(); closeSheet(); announce(message); return true;
}
function goalForm(title, fields, button, submit) {
  openSheet(`${sheetHeading(title)}<form id="transaction-form" class="goal-form" novalidate><div class="sheet-body sheet-fields">${fields}<p class="error" role="alert"></p></div><div class="sheet-actions"><button class="primary">${button}</button><button type="button" data-cancel>Cancel</button></div></form>`);
  bindSheetClose(); transactionSheet.querySelector('[data-cancel]').onclick = closeSheet;
  let submitted = false;
  transactionSheet.querySelector('form').onsubmit = event => {
    event.preventDefault(); if (submitted) return;
    try { submitted = true; if (!submit(new FormData(event.target))) submitted = false; }
    catch (error) { submitted = false; transactionSheet.querySelector('.error').textContent = error.message; }
  };
}
function openGoalForm(goal = null) {
  goalForm(goal ? 'Edit Goal' : 'Create Goal', `<label for="goal-name">Goal name</label><input id="goal-name" name="name" maxlength="80" value="${escape(goal?.name || '')}"><label for="goal-emoji">Emoji (optional)</label><input id="goal-emoji" name="emoji" value="${escape(goal?.emoji || '')}"><label for="goal-target">Target amount ($)</label><div class="currency-input"><span aria-hidden="true">$</span><input id="goal-target" name="target" inputmode="decimal" placeholder="1500.00" aria-describedby="goal-target-hint" value="${goal ? (goal.targetCents / 100).toFixed(2) : ''}"></div><p id="goal-target-hint" class="hint">Enter 1500 or 1500.50, without commas or a $ sign. Use a period for cents.</p>`, 'Save Goal', data => {
    const name = data.get('name').trim(), emoji = data.get('emoji').trim(), targetCents = parseMoney(data.get('target'));
    if (!name || name.length > 80) throw Error('Enter a goal name of 80 characters or fewer.');
    if ([...emoji].length > 16) throw Error('Use a short emoji, up to 16 characters.');
    const target = transactionSheet.querySelector('#goal-target');
    target.removeAttribute('aria-invalid');
    if (!targetCents) {
      target.setAttribute('aria-invalid', 'true'); target.focus();
      throw Error('Enter a positive amount like 1500 or 1500.50. Do not include commas or a $ sign; use a period and up to two digits for cents.');
    }
    return commitGoal(updateGoal(state, { ...(goal || {id: newId(), reservedCents: 0, archived: false}), name, emoji, targetCents }), 'Goal saved.');
  });
}
function showGoal(id) {
  const goal = (state.goals || []).find(g => g.id === id); if (!goal) return;
  openSheet(`${sheetHeading('Goal Details')}<div class="sheet-body goal-details-body"><h3>${escape(goal.emoji)} ${escape(goal.name)}</h3>${goalProgress(goal)}${goal.archived ? '<p>Archived. No funds are reserved.</p>' : '<p>Reservations are not expenses. Complete a purchase to record one expense and archive this goal, releasing any unused funds.</p>'}<div class="goal-actions"><button id="goal-edit">Edit Goal</button>${goal.archived ? '' : '<button id="goal-reserve">Reserve Funds</button><button id="goal-release">Release Funds</button><button id="goal-buy">Record Goal Purchase</button><button id="goal-archive">Archive Goal</button>'}<button id="goal-delete">Delete Goal</button></div></div>`, '#sheet-title', 'details');
  bindSheetClose(); transactionSheet.querySelector('#goal-edit').onclick = () => openGoalForm(goal);
  for (const action of ['reserve','release']) {
    transactionSheet.querySelector(`#goal-${action}`)?.addEventListener('click', () => {
      goalForm(action === 'reserve' ? 'Reserve Funds' : 'Release Funds', `<p>${action === 'reserve' ? `${money(availableBalance(state))} available; ${money(goal.targetCents - goal.reservedCents)} left to fund.` : `${money(goal.reservedCents)} reserved.`}</p><label for="goal-amount">Amount ($)</label><div class="currency-input"><span aria-hidden="true">$</span><input id="goal-amount" name="amount" inputmode="decimal"></div>`, action === 'reserve' ? 'Reserve' : 'Release', data => {
        const amount = parseMoney(data.get('amount'));
        if (!amount) throw Error('Enter an amount greater than zero with up to two decimal places.');
        return commitGoal(updateGoal(state, {...goal, reservedCents: goal.reservedCents + (action === 'reserve' ? amount : -amount)}), action === 'reserve' ? 'Funds reserved.' : 'Funds released.');
      });
    });
  }
  transactionSheet.querySelector('#goal-buy')?.addEventListener('click', () => {
    goalForm('Record Goal Purchase', `<p>Record one expense, archive this goal, and release any unused reservation. You can use up to ${money(availableBalance(state) + goal.reservedCents)} without using other goals’ funds.</p><label for="goal-amount">Purchase amount ($)</label><div class="currency-input"><span aria-hidden="true">$</span><input id="goal-amount" name="amount" inputmode="decimal" value="${(goal.targetCents / 100).toFixed(2)}"></div><label for="goal-category">Category</label><select id="goal-category" name="label">${TRANSACTION_LABELS.expense.map(label => `<option ${label === 'Shopping' ? 'selected' : ''}>${label}</option>`).join('')}</select>`, 'Save Purchase', data => {
      const amountCents = parseMoney(data.get('amount'));
      if (!amountCents) throw Error('Enter a purchase amount greater than zero with up to two decimal places.');
      return commitGoal(purchaseGoal(state, id, {id: newId(), type:'expense', amountCents, label:data.get('label'), description:goal.name, createdAt:new Date().toISOString()}), 'Purchase saved. Goal archived and unused funds released.');
    });
  });
  for (const action of ['archive','delete']) transactionSheet.querySelector(`#goal-${action}`)?.addEventListener('click', () => {
    openSheet(`${sheetHeading(action === 'archive' ? 'Archive Goal?' : 'Delete Goal?')}<div class="sheet-body"><p>${action === 'archive' ? 'Archive' : 'Permanently delete'} ${escape(goal.name)} and release ${money(goal.reservedCents)}? Your total balance and existing expenses stay the same.</p></div><div class="sheet-actions"><button class="primary" id="confirm-goal">${action === 'archive' ? 'Archive' : 'Delete'}</button><button id="cancel-goal">Cancel</button></div>`);
    bindSheetClose(); transactionSheet.querySelector('#cancel-goal').onclick = () => showGoal(id);
    let submitted = false;
    transactionSheet.querySelector('#confirm-goal').onclick = () => {
      if (submitted) return; submitted = true;
      const next = action === 'delete' ? {...state, goals:state.goals.filter(g => g.id !== id)} : updateGoal(state, {...goal, archived:true, reservedCents:0});
      if (!commitGoal(next, action === 'delete' ? 'Goal deleted. Funds released.' : 'Goal archived. Funds released.')) submitted = false;
    };
  });
}

function renderActivity() {
  content.innerHTML = `${launcherBack}<section class="activity"><h1>Activity</h1><label for="activity-search">Search activity</label><div class="activity-search">${icon('search')}<input id="activity-search" type="search" placeholder="Search descriptions or categories" value="${escape(activitySearch)}"></div><div class="activity-filters" role="group" aria-label="Activity filters">${[['all', 'All'], ['income', 'Money In'], ['expense', 'Expenses']].map(([value, label]) => `<button type="button" data-filter="${value}" aria-pressed="${activityFilter === value}">${label}</button>`).join('')}</div><div id="activity-list"></div></section>`;
  content.querySelector('#activity-search').oninput = event => { activitySearch = event.target.value; renderActivityRows(); };
  content.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
    activityFilter = button.dataset.filter;
    content.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderActivityRows();
  });
  renderActivityRows();
}
function renderActivityRows() {
  const transactions = state.transactions || [];
  const groups = activityGroups(transactions, { search: activitySearch, filter: activityFilter });
  const list = content.querySelector('#activity-list');
  if (!groups.length) {
    list.innerHTML = `<div class="activity-empty"><div class="empty-icon">${icon('activity')}</div><h2>${transactions.length ? 'No matching activity yet.' : 'Your money activity starts here.'}</h2><p>${transactions.length ? 'Try another search or filter.' : 'Money you add and expenses you record will appear here.'}</p></div>`; return;
  }
  list.innerHTML = groups.map(group => `<section class="activity-group"><h2>${escape(group.label)}</h2><ul>${group.transactions.map(t => `<li><button class="transaction-row" type="button" data-transaction-id="${escape(t.id)}" aria-label="${escape(`View transaction details: ${t.description || t.label}, ${t.type === 'income' ? 'Money In +' : 'Expense −'}${money(t.amountCents)}, ${t.label}`)}"><span class="transaction-icon ${t.type}">${icon(t.type === 'income' ? 'plus' : 'expense')}</span><span class="transaction-text"><strong>${escape(t.description || t.label)}</strong><small>${t.type === 'income' ? 'Money In' : 'Expense'} · ${escape(t.label)}</small></span><strong class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '−'}${money(t.amountCents)}</strong><span class="transaction-chevron navigation-chevron" aria-hidden="true">${icon('chevron')}</span></button></li>`).join('')}</ul></section>`).join('');
  list.querySelectorAll('[data-transaction-id]').forEach(button => button.onclick = () => { button.focus({preventScroll:true}); showTransaction(button.dataset.transactionId); });
}
function openSheet(html, focusSelector = '#sheet-title', view = 'form') {
  const dialog = document.querySelector('#transaction-sheet');
  if (!dialog.open) {
    sheetOpener = document.activeElement;
    sheetScroll = { overflow: document.body.style.overflow, x: window.scrollX, y: window.scrollY };
    document.body.style.overflow = 'hidden';
  }
  dialog.dataset.view = view;
  dialog.innerHTML = `<div class="transaction-frame"><section class="transaction-panel">${html}</section></div>`;
  if (!dialog.open) dialog.showModal();
  fitSheetViewport();
  if (!focusFirstField(dialog)) dialog.querySelector(focusSelector).focus({preventScroll:true});
}
const sheetHeading = title => `<div class="sheet-heading"><h2 id="sheet-title" tabindex="-1">${title}</h2><button type="button" data-sheet-close aria-label="Close">×</button></div>`;
function bindSheetClose() { document.querySelector('#transaction-sheet [data-sheet-close]').onclick = closeSheet; }
function closeSheet() { document.querySelector('#transaction-sheet').close(); }
function commitTransactions(transactions, message) {
  if (!save({ ...state, transactions })) return false;
  render(); closeSheet(); announce(message); return true;
}
function openTransactionForm(type, id = null, affordabilityPrice = null) {
  const original = id ? (state.transactions || []).find(t => t.id === id) : null;
  if (id && !original) return;
  if (original) type = original.type;
  const previewRaw = lastRaw;
  const isIncome = type === 'income', title = original ? `Edit ${isIncome ? 'Money In' : 'Expense'}` : isIncome ? 'Add Money' : 'Add Expense';
  openSheet(`${sheetHeading(title)}<form id="transaction-form" novalidate><div class="sheet-body sheet-fields"><label for="transaction-amount">How much?</label><div class="currency-input"><span aria-hidden="true">$</span><input id="transaction-amount" autofocus name="amount" inputmode="decimal" autocomplete="off" required value="${original ? (original.amountCents / 100).toFixed(2) : affordabilityPrice !== null ? String(Math.floor(affordabilityPrice / 100)) + '.' + String(affordabilityPrice % 100).padStart(2, '0') : ''}" placeholder="0.00" aria-describedby="transaction-error"></div><label for="transaction-label">${isIncome ? 'Where did it come from?' : 'Category'}</label><select id="transaction-label" name="label" required><option value="">Choose ${isIncome ? 'a source' : 'a category'}</option>${TRANSACTION_LABELS[type].map(label => `<option ${original?.label === label ? 'selected' : ''}>${label}</option>`).join('')}</select><label for="transaction-description">${isIncome ? 'Description' : 'What was it?'} (optional)</label><input id="transaction-description" name="description" maxlength="120" value="${escape(original?.description || '')}"><p class="error" id="transaction-error" role="alert"></p></div><div class="sheet-actions"><button class="primary" type="submit">${original ? 'Save Changes' : isIncome ? 'Add Money' : 'Save Expense'}</button><button type="button" id="transaction-cancel">Cancel</button></div></form>`, '#transaction-amount');
  bindSheetClose(); document.querySelector('#transaction-cancel').onclick = closeSheet;
  let submitted = false;
  document.querySelector('#transaction-form').onsubmit = event => {
    event.preventDefault(); if (submitted) return;
    const data = new FormData(event.target), amount = parseMoney(data.get('amount')), label = data.get('label'), description = data.get('description').trim();
    const error = document.querySelector('#transaction-error');
    if (amount === null || amount <= 0) { error.textContent = 'Enter an amount greater than zero with up to two decimal places.'; document.querySelector('#transaction-amount').focus(); return; }
    if (affordabilityPrice !== null && (!affordabilityIsCurrent(previewRaw) || !affordability(state, data.get('amount')).affordable)) { error.textContent = 'This price must fit your current available spending money. Check the amount or cancel to try again.'; return; }
    if (!TRANSACTION_LABELS[type].includes(label)) { error.textContent = `Choose ${isIncome ? 'where the money came from' : 'a category'}.`; document.querySelector('#transaction-label').focus(); return; }
    if (description.length > 120) { error.textContent = 'Keep the description to 120 characters or fewer.'; return; }
    const transaction = original ? { ...original, amountCents: amount, label, description } : {
      id: Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''),
      type, amountCents: amount, label, description, createdAt: new Date().toISOString(),
    };
    if (original && transaction.amountCents === original.amountCents && transaction.label === original.label && transaction.description === original.description) { closeSheet(); return; }
    const transactions = original ? state.transactions.map(t => t.id === id ? transaction : t) : [...(state.transactions || []), transaction];
    submitted = true;
    if (!commitTransactions(transactions, original ? 'Changes saved.' : isIncome ? 'Money added.' : 'Expense saved.')) submitted = false;
  };
}
function showTransaction(id) {
  const transaction = (state.transactions || []).find(t => t.id === id); if (!transaction) return;
  const isIncome = transaction.type === 'income';
  openSheet(`${sheetHeading(isIncome ? 'Money In' : 'Expense')}<div class="sheet-body details-body"><div class="details-centered"><p class="detail-amount ${transaction.type}">${isIncome ? '+' : '−'}${money(transaction.amountCents)}</p><dl class="transaction-details"><dt>Type</dt><dd>${isIncome ? 'Money In' : 'Expense'}</dd><dt>${isIncome ? 'Source' : 'Category'}</dt><dd>${escape(transaction.label)}</dd>${transaction.description ? `<dt>Description</dt><dd>${escape(transaction.description)}</dd>` : ''}<dt>Date</dt><dd class="numeric">${escape(new Intl.DateTimeFormat('en-US', {dateStyle:'medium', timeStyle:'short'}).format(new Date(transaction.createdAt)))}</dd></dl><div class="sheet-actions"><button type="button" class="primary" id="transaction-edit">Edit</button><button type="button" id="transaction-delete">Delete</button></div></div></div>`, '#sheet-title', 'details');
  bindSheetClose(); document.querySelector('#transaction-edit').onclick = () => openTransactionForm(transaction.type, id);
  document.querySelector('#transaction-delete').onclick = () => {
    openSheet(`${sheetHeading('Delete activity?')}<div class="sheet-body"><p>Delete this ${isIncome ? 'money entry' : 'expense'}? Your balance will be updated.</p></div><div class="sheet-actions"><button class="primary" type="button" id="confirm-delete">Delete</button><button type="button" id="cancel-delete">Cancel</button></div>`);
    bindSheetClose(); document.querySelector('#cancel-delete').onclick = () => showTransaction(id);
    let deleted = false;
    document.querySelector('#confirm-delete').onclick = () => {
      if (deleted) return; deleted = true;
      if (!commitTransactions(state.transactions.filter(t => t.id !== id), 'Transaction deleted.')) deleted = false;
    };
  };
}
// The native top-layer host is reset to the layout viewport, like LLT's calculator.
// Its inner frame follows Safari's actual visible rectangle, including keyboard changes.
function fitSheetViewport() {
  const dialog = document.querySelector('#transaction-sheet'); if (!dialog.open) return;
  const viewport = window.visualViewport;
  dialog.style.setProperty('--sheet-top', `${viewport?.offsetTop || 0}px`);
  dialog.style.setProperty('--sheet-left', `${viewport?.offsetLeft || 0}px`);
  dialog.style.setProperty('--sheet-width', `${viewport?.width || window.innerWidth}px`);
  dialog.style.setProperty('--sheet-height', `${viewport?.height || window.innerHeight}px`);
  dialog.querySelector('input:focus')?.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
}
window.visualViewport?.addEventListener('resize', fitSheetViewport);
window.visualViewport?.addEventListener('scroll', fitSheetViewport);
window.addEventListener('resize', fitSheetViewport);
document.documentElement.dataset.focusMode = 'pointer';
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' || event.key === 'Escape' || (['Enter', ' '].includes(event.key) && event.target.matches('button, a'))) document.documentElement.dataset.focusMode = 'keyboard';
}, true);
document.addEventListener('pointerdown', () => { document.documentElement.dataset.focusMode = 'pointer'; }, true);
const transactionSheet = document.querySelector('#transaction-sheet');
transactionSheet.addEventListener('focusin', event => {
  if (event.target.matches('input')) event.target.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
});
transactionSheet.addEventListener('cancel', event => { event.preventDefault(); closeSheet(); });
transactionSheet.addEventListener('close', () => {
  // A queued close event can arrive after a rapid reopen or a second close.
  if (transactionSheet.open || !sheetScroll) return;
  for (const property of ['--sheet-height', '--sheet-width', '--sheet-top', '--sheet-left']) transactionSheet.style.removeProperty(property);
  if (sheetScroll) {
    document.body.style.overflow = sheetScroll.overflow;
    window.scrollTo({left: sheetScroll.x, top: sheetScroll.y, behavior:'instant'}); sheetScroll = null;
  }
  const target = sheetOpener?.isConnected ? sheetOpener : content.querySelector('h1');
  if (target?.matches('h1')) target.tabIndex = -1;
  target?.focus({preventScroll:true});
  sheetOpener = null;
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY), next = JSON.parse(raw);
    if (!validState(next)) throw Error();
    state = next; lastRaw = raw;
    if (transactionSheet.open) closeSheet();
    render(); announce('Your money information was updated in another tab.');
  } catch { showSaveError('Your saved information changed in another tab. Reload before making changes.'); }
});
function openSettings() { tab = 'Settings'; render(); focusPageStart(); }
gear.onclick = openSettings;
window.addEventListener('pageshow', event => {
  if (event.persisted) window.LandosTheme?.init();
  render();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state && !['Settings', 'Balance'].includes(tab) && !document.querySelector('#transaction-sheet')?.open) render(); });
// Refresh calendar-day guidance while Home remains open across midnight.
setInterval(() => { if (state && tab === 'Home' && !document.hidden && !document.querySelector('#transaction-sheet')?.open && localToday() !== renderedDay) { renderedDay = localToday(); render(); } }, 30000);
let renderedDay = localToday();
render();
