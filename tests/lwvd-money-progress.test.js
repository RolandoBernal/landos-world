import {test} from 'node:test';
import assert from 'node:assert/strict';
import {awardMoneyProgress, moneyProgress, progressLevel, currentBalance, availableBalance, dailyGuide, validState} from '../violet-dineros/model.js';
const now = new Date(2026, 9, 26, 12);
const base = () => ({onboarded:true, firstName:'Violet', balanceCents:100000, payday:'', frequency:'', transactions:[], goals:[]});
const expense = (id, amountCents = 100) => ({id, type:'expense', amountCents, label:'Food', description:id, createdAt:now.toISOString()});
const add = (s, t, date = now) => awardMoneyProgress(s, {...s, transactions:[...s.transactions, t]}, date);
test('new expenses earn once, independent of amount; edits, income and reopen earn none', () => {
  const a = add(base(), expense('a', 1)), b = add(base(), expense('a', 90000));
  assert.equal(a.moneyProgress.xp, 10); assert.equal(b.moneyProgress.xp, 10);
  const edit = awardMoneyProgress(a, {...a, transactions:[{...a.transactions[0],amountCents:500}]}, now);
  assert.equal(edit.moneyProgress.xp, 10);
  assert.equal(awardMoneyProgress(edit, edit, now).moneyProgress.xp, 10);
  assert.equal(add(base(), {...expense('income'),type:'income',label:'Gift'}).moneyProgress.xp, 0);
});
test('deleted records and edited signatures cannot be rewarded again that week', () => {
  let s = add(base(), expense('a'));
  s = awardMoneyProgress(s, {...s,transactions:[]}, now);
  s = add(s, {...expense('new-id'),description:'a'});
  assert.equal(s.moneyProgress.xp, 10);
});
test('challenge pays exactly once, daily cap and persistence survive reload', () => {
  let s = base(); for (let i=0;i<4;i++) s = add(s,expense(String(i)));
  assert.equal(s.moneyProgress.xp,55); assert.equal(s.moneyProgress.count,3);
  s = JSON.parse(JSON.stringify(s)); assert.equal(moneyProgress(s,now).xp,55);
  assert.equal(awardMoneyProgress(s,s,now).moneyProgress.xp,55);
  assert.deepEqual(progressLevel(140),{level:2,title:'Budget Builder',earned:40,next:200});
});
test('local Monday rollover resets challenge and clock rollback cannot reopen bonuses', () => {
  let s = base(); for(let i=0;i<3;i++) s=add(s,expense(String(i)));
  const next = new Date(2026,10,2,12);
  assert.equal(moneyProgress(s,next).count,0);
  s=add(s,{...expense('next'),createdAt:next.toISOString()},next);
  assert.equal(s.moneyProgress.xp,65); assert.equal(s.moneyProgress.count,1);
  assert.equal(add(s,expense('back'),now).moneyProgress.xp,65);
});
test('goal contributions reward new high water only, once daily; financial figures unchanged', () => {
  let s=base(); s.goals=[{id:'g',name:'Bike',emoji:'',targetCents:10000,reservedCents:1000,archived:false}];
  const next={...s,goals:[{...s.goals[0],reservedCents:2000}]};
  let awarded=awardMoneyProgress(s,next,now);
  assert.equal(awarded.moneyProgress.xp,10);
  const released=awardMoneyProgress(awarded,{...awarded,goals:s.goals},now);
  awarded=awardMoneyProgress(released,{...released,goals:next.goals},new Date(2026,9,27,12));
  assert.equal(awarded.moneyProgress.xp,10);
  assert.equal(currentBalance(awarded),currentBalance(next));
  assert.equal(availableBalance(awarded),availableBalance(next));
  assert.equal(dailyGuide(availableBalance(awarded),7),dailyGuide(availableBalance(next),7));
  assert.ok(validState(awarded));
});
test('historical actions start at zero; first genuinely new action earns', () => {
  const s=base();s.transactions=[expense('old')];
  assert.equal(moneyProgress(s,now).xp,0);
  assert.equal(add(s,expense('fresh')).moneyProgress.xp,10);
  assert.equal(awardMoneyProgress(null,s,now).moneyProgress.xp,0);
});
test('new week can complete once again, identical previous-week purchases are eligible', () => {
  let s=base(); for(let i=0;i<3;i++) s=add(s,expense(String(i)));
  const monday=new Date(2026,10,2,12);
  for(let i=0;i<3;i++) s=add(s,{...expense(`new-${i}`),description:String(i),createdAt:monday.toISOString()},monday);
  assert.equal(s.moneyProgress.xp,110);assert.equal(s.moneyProgress.rewarded,true);
  assert.equal(awardMoneyProgress(s,s,monday).moneyProgress.xp,110);
});

test('optional malformed progress cannot block financial data or change calculations', () => {
  const s={...base(),moneyProgress:{xp:'broken'}};
  assert.ok(validState(s));assert.equal(currentBalance(s),100000);
  assert.equal(moneyProgress(s,now).xp,0);
});
