export const STORAGE_KEY = 'lando-world:lwvd:v1';
export const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
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
