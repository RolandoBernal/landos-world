import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, daysUntil, effectivePayday, localToday } from '../violet-dineros/model.js';
test('currency accepts nonnegative cents and rejects ambiguous or unsafe amounts', () => {
  for (const [value, expected] of [['0',0],['428.00',42800],['1.2',120],['-1',null],['1.234',null],['1e3',null],['',null],['9999999999999999',null]]) assert.equal(parseMoney(value),expected);
});
test('calendar dates handle missing, today, past, leap dates and DST', () => {
  assert.equal(daysUntil('', '2026-10-21'),null); assert.equal(daysUntil('2026-10-21','2026-10-21'),0); assert.equal(daysUntil('2026-10-20','2026-10-21'),-1);
  assert.equal(daysUntil('2026-03-09','2026-03-07'),2); assert.equal(daysUntil('2026-02-30'),null); assert.equal(daysUntil('2028-03-01','2028-02-28'),2);
  assert.equal(localToday(new Date(2026,9,21,23,59)),'2026-10-21');
});
test('recurrence retains today and advances expired weekly and biweekly dates', () => {
  assert.equal(effectivePayday('2026-10-21','weekly','2026-10-21'),'2026-10-21');
  assert.equal(effectivePayday('2026-10-01','weekly','2026-10-21'),'2026-10-22');
  assert.equal(effectivePayday('2026-10-01','biweekly','2026-10-21'),'2026-10-29');
  assert.equal(effectivePayday('2026-10-01','','2026-10-21'),'2026-10-01');
});
test('monthly recurrence clamps shorter months without losing original day', () => {
  assert.equal(effectivePayday('2026-01-31','monthly','2026-02-01'),'2026-02-28');
  assert.equal(effectivePayday('2026-01-31','monthly','2026-03-01'),'2026-03-31');
  assert.equal(effectivePayday('2028-01-31','monthly','2028-02-01'),'2028-02-29');
  assert.equal(effectivePayday('2025-12-31','monthly','2026-01-01'),'2026-01-31');
});
