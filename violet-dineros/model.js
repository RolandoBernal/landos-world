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
  return data && data.onboarded === true && typeof data.firstName === 'string' && data.firstName.trim().length > 0 && data.firstName.length <= 40 && Number.isSafeInteger(data.balanceCents) && data.balanceCents >= 0 && (!data.payday || dateParts(data.payday)) && ['', 'weekly', 'biweekly', 'monthly'].includes(data.frequency);
}
