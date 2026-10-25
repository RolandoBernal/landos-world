export const STORAGE_KEY = 'lando-world:lwvd:v1';
export const money = cents => {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  if (typeof cents !== 'bigint') return formatter.format(cents / 100);
  const absolute = cents < 0n ? -cents : cents;
  const formatted = formatter.formatToParts(absolute / 100n).map(part => part.type === 'fraction' ? String(absolute % 100n).padStart(2, '0') : part.value).join('');
  return cents < 0n ? `-${formatted}` : formatted;
};
export function parseMoney(value) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [dollars, fraction = ''] = value.trim().split('.');
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function dateParts(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(y, m - 1, d); date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? { y, m, d, stamp: date.getTime() } : null;
}
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export const daysUntil = (payday, today = localToday()) => dateParts(payday) ? Math.round((dateParts(payday).stamp - dateParts(today).stamp) / 86400000) : null;
export function effectivePayday(anchor, frequency, today = localToday()) {
  if (!dateParts(anchor) || !['weekly', 'biweekly', 'monthly'].includes(frequency) || daysUntil(anchor, today) >= 0) return anchor;
  const start = dateParts(anchor);
  let stamp;
  if (frequency !== 'monthly') {
    const interval = frequency === 'weekly' ? 7 : 14;
    stamp = start.stamp + Math.ceil(-daysUntil(anchor, today) / interval) * interval * 86400000;
  } else {
    const end = dateParts(today);
    let months = (end.y - start.y) * 12 + end.m - start.m;
    const candidate = offset => {
      const date = new Date(start.stamp); date.setUTCDate(1); date.setUTCMonth(start.m - 1 + offset);
      const last = new Date(date.getTime()); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
      date.setUTCDate(Math.min(start.d, last.getUTCDate())); return date.getTime();
    };
    stamp = candidate(months); if (stamp < end.stamp) stamp = candidate(++months);
  }
  return new Date(stamp).toISOString().slice(0, 10);
}
export function validState(data) {
  return data && data.onboarded === true && typeof data.firstName === 'string' && data.firstName.trim().length > 0 && data.firstName.length <= 40 && Number.isSafeInteger(data.balanceCents) && data.balanceCents >= 0 && (!data.payday || dateParts(data.payday)) && ['', 'weekly', 'biweekly', 'monthly'].includes(data.frequency) && (data.transactions === undefined || validTransactions(data.transactions)) && currentBalance(data) !== null && (data.goals === undefined || validGoals(data.goals)) && fundedReservations(data);
}

export const TRANSACTION_LABELS = Object.freeze({
  income: ['Allowance', 'Paycheck', 'Gift', 'Other'],
  expense: ['Food', 'Shopping', 'Fun', 'Gas', 'Other'],
});
export function validTransactions(transactions) {
  return Array.isArray(transactions) && new Set(transactions.map(t => t?.id)).size === transactions.length && transactions.every(t =>
    t && typeof t.id === 'string' && t.id.length > 0 && TRANSACTION_LABELS[t.type]?.includes(t.label) &&
    Number.isSafeInteger(t.amountCents) && t.amountCents > 0 && typeof t.description === 'string' && t.description.length <= 120 &&
    typeof t.createdAt === 'string' && Number.isFinite(Date.parse(t.createdAt)));
}
export function currentBalance(data) {
  const cents = (data.transactions || []).reduce((total, t) => total + BigInt(t.amountCents) * (t.type === 'income' ? 1n : -1n), BigInt(data.balanceCents));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) && cents >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(cents) : null;
}
export function dailyGuide(balance, days) {
  return days > 0 ? Math.round(Math.max(0, balance) / days) : null;
}
export function activityGroups(transactions, { search = '', filter = 'all', now = new Date() } = {}) {
  const query = search.trim().toLocaleLowerCase();
  const today = localToday(now), yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map();
  transactions.map((t, index) => ({t, index})).filter(({t}) => (filter === 'all' || t.type === filter) &&
    `${t.description} ${t.label}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => Date.parse(b.t.createdAt) - Date.parse(a.t.createdAt) || b.index - a.index)
    .forEach(({t}) => {
      const date = new Date(t.createdAt), key = localToday(date);
      if (!groups.has(key)) groups.set(key, {date: key, label: key === today ? 'Today' : key === localToday(yesterday) ? 'Yesterday' : new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric'}).format(date), transactions: []});
      groups.get(key).transactions.push(t);
    });
  return [...groups.values()];
}

// Reservations are allocations, never transactions. Missing goals is legacy data.
export function validGoals(goals) {
  return Array.isArray(goals) && new Set(goals.map(g => g?.id)).size === goals.length && goals.every(g =>
    g && typeof g.id === 'string' && g.id.length > 0 && typeof g.name === 'string' && g.name.trim().length > 0 && g.name.length <= 80 &&
    typeof g.emoji === 'string' && [...g.emoji].length <= 16 && Number.isSafeInteger(g.targetCents) && g.targetCents > 0 &&
    Number.isSafeInteger(g.reservedCents) && g.reservedCents >= 0 && g.reservedCents <= g.targetCents &&
    typeof g.archived === 'boolean' && (!g.archived || g.reservedCents === 0));
}
export const reservedBalance = data => (data.goals || []).reduce((sum, g) => sum + BigInt(g.reservedCents), 0n);
export const availableBalance = data => currentBalance(data) - Number(reservedBalance(data));
export function fundedReservations(data) {
  return reservedBalance(data) <= BigInt(Math.max(0, currentBalance(data)));
}
export function updateGoal(data, goal) {
  const existing = (data.goals || []).find(g => g.id === goal.id);
  const next = { ...data, goals: existing ? data.goals.map(g => g.id === goal.id ? goal : g) : [...(data.goals || []), goal] };
  if (!validGoals(next.goals) || !fundedReservations(next)) throw Error('Keep reservations within the goal target and your available balance. Release funds before lowering a target.');
  return next;
}
export function purchaseGoal(data, id, transaction) {
  const goal = (data.goals || []).find(g => g.id === id && !g.archived);
  if (!goal || transaction.type !== 'expense' || !validTransactions([transaction]) ||
    (data.transactions || []).some(t => t.id === transaction.id) || transaction.amountCents > availableBalance(data) + goal.reservedCents) {
    throw Error('The purchase must fit this goal’s reserved funds plus your available balance.');
  }
  const next = { ...data, goals: data.goals.map(g => g.id === id ? { ...g, archived: true, reservedCents: 0 } : g), transactions: [...(data.transactions || []), transaction] };
  if (!validState(next)) throw Error('This purchase could not be saved. Check the amount.');
  return next;
}

// Preview only: goal reservations never contribute to purchasing power.
export function affordability(data, input) {
  const priceCents = parseMoney(input);
  if (!input.trim()) return {status: 'blank', affordable: false};
  if (priceCents === null || priceCents <= 0) return {status: 'invalid', affordable: false};
  const available = availableBalance(data);
  const affordable = priceCents <= available;
  // BigInt keeps shortages exact even for a legacy negative balance.
  const difference = BigInt(available) - BigInt(priceCents);
  return {status: affordable ? 'affordable' : 'unaffordable', affordable, priceCents,
    remainingCents: affordable ? Number(difference) : null,
    shortageCents: affordable ? null : -difference};
}

// Read-only calendar periods derived from the saved recurring payday anchor.
export function spendingPeriod(data, filter = 'budget', today = localToday()) {
  if (filter === 'all') return {start: null, end: null};
  if (filter === 'month') return {start: today.slice(0, 7) + '-01', end: today};
  if (!dateParts(data.payday) || !['weekly', 'biweekly', 'monthly'].includes(data.frequency)) return null;
  const anchor = dateParts(data.payday), current = dateParts(today);
  let start;
  if (data.frequency === 'monthly') {
    const offset = (current.y - anchor.y) * 12 + current.m - anchor.m;
    const occurrence = months => {
      const date = new Date(anchor.stamp); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
      const last = new Date(date); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
      date.setUTCDate(Math.min(anchor.d, last.getUTCDate())); return date.toISOString().slice(0, 10);
    };
    start = occurrence(offset);
    if (start > today) start = occurrence(offset - 1);
  } else {
    const interval = (data.frequency === 'weekly' ? 7 : 14) * 86400000;
    start = new Date(anchor.stamp + Math.floor((current.stamp - anchor.stamp) / interval) * interval).toISOString().slice(0, 10);
  }
  return {start, end: today};
}
export function spendingSummary(data, filter = 'budget', today = localToday()) {
  const period = spendingPeriod(data, filter, today);
  const expenses = period ? (data.transactions || []).filter(t => {
    const day = localToday(new Date(t.createdAt));
    return t.type === 'expense' && (!period.end || day <= period.end) && (!period.start || day >= period.start);
  }) : [];
  const categories = TRANSACTION_LABELS.expense.map(label => ({label, cents: expenses.filter(t => t.label === label).reduce((sum, t) => sum + BigInt(t.amountCents), 0n)})).filter(c => c.cents > 0n);
  const total = categories.reduce((sum, c) => sum + c.cents, 0n);
  return {period, categories, total, count: expenses.length};
}
export function smallPurchaseCost(input, frequency) {
  const cents = parseMoney(input), yearly = {daily:365, weekly:52, monthly:12}[frequency];
  if (cents === null || cents <= 0 || typeof yearly !== 'number') return null;
  return BigInt(cents) * BigInt(yearly);
}
