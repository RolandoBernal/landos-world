import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validState, validTransactions, currentBalance, dailyGuide, activityGroups } from '../violet-dineros/model.js';
const state = {firstName:'Max',balanceCents:15000,payday:'2026-10-25',frequency:'monthly',onboarded:true};
const tx = (id, type, amountCents, label, description = '', createdAt = '2026-10-22T12:00:00.000Z') => ({id,type,amountCents,label,description,createdAt});
test('Sprint 1.2 records remain valid and unchanged with no fabricated transactions',()=>{
  const raw = JSON.stringify(state); assert.equal(validState(state),true); assert.equal(currentBalance(state),15000); assert.equal(JSON.stringify(state),raw); assert.equal(Object.hasOwn(state,'transactions'),false);
});
test('integer-cent current balance supports income, expenses and negative balances',()=>{
  const transactions=[tx('1','income',3000,'Allowance'),tx('2','expense',600,'Food')];
  assert.equal(currentBalance({...state,transactions}),17400); assert.equal(state.balanceCents,15000);
  assert.equal(currentBalance({...state,transactions:[tx('3','expense',20000,'Shopping')]}),-5000);
  assert.equal(currentBalance({...state,balanceCents:0,transactions:[tx('1','income',10,'Gift'),tx('2','income',20,'Gift'),tx('3','expense',30,'Other')]}),0);
  assert.equal(currentBalance({...state,balanceCents:17500,transactions}),19900);
});
test('daily guide clamps negative money and retains calendar fallback',()=>{
  assert.equal(dailyGuide(-5000,3),0);assert.equal(dailyGuide(18000,3),6000);assert.equal(dailyGuide(100,3),33);assert.equal(dailyGuide(15000,0),null);assert.equal(dailyGuide(15000,null),null);
});
test('stored transactions reject invalid types, labels, amounts, dates and duplicate identities',()=>{
  const original=tx('1','income',100,'Gift'); assert.equal(validTransactions([original]),true);
  for (const patch of [{type:'transfer'},{amountCents:0},{amountCents:-1},{amountCents:1.2},{amountCents:Number.MAX_SAFE_INTEGER+1},{label:'Food'},{createdAt:'bad'},{id:''},{description:'x'.repeat(121)}]) assert.equal(validTransactions([{...original,...patch}]),false);
  assert.equal(validTransactions([original,original]),false);assert.equal(validState({...state,transactions:{}}),false);assert.equal(validState({...state,transactions:null}),false);
});
test('balance overflow is rejected while large cancelling amounts retain exact cents',()=>{
  assert.equal(currentBalance({...state,transactions:[tx('1','income',Number.MAX_SAFE_INTEGER,'Other')]}),null);
  assert.equal(currentBalance({...state,transactions:[tx('1','income',Number.MAX_SAFE_INTEGER,'Other'),tx('2','expense',Number.MAX_SAFE_INTEGER,'Other')]}),15000);
});
test('Activity groups local dates, sorts newest first with stable ties, searches and filters',()=>{
  const now=new Date(2026,9,22,12),today=new Date(2026,9,22,11).toISOString(),yesterday=new Date(2026,9,21,11).toISOString(),older=new Date(2026,9,18,11).toISOString();
  const transactions=[tx('a','income',3000,'Allowance','',older),tx('b','expense',600,'Food','Coffee',yesterday),tx('c','expense',2400,'Shopping','New shirt',today),tx('d','income',1000,'Gift','Birthday',today)];
  const groups=activityGroups(transactions,{now});assert.deepEqual(groups.map(g=>g.label).slice(0,2),['Today','Yesterday']);assert.deepEqual(groups[0].transactions.map(t=>t.id),['d','c']);assert.equal(groups.length,3);
  assert.equal(activityGroups(transactions,{search:' COFFEE ',now})[0].transactions[0].id,'b');assert.equal(activityGroups(transactions,{search:'Allowance',now})[0].transactions[0].id,'a');
  assert.deepEqual(activityGroups(transactions,{filter:'expense',now}).flatMap(g=>g.transactions).map(t=>t.id),['c','b']);assert.equal(activityGroups(transactions,{search:'missing',now}).length,0);
});
