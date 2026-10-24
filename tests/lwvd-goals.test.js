import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validState, currentBalance, availableBalance, reservedBalance, updateGoal, purchaseGoal, dailyGuide} from '../violet-dineros/model.js';
const base = {firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true};
const goal = (id, reservedCents=0) => ({id,name:'Bike',emoji:'🚲',targetCents:8000,reservedCents,archived:false});
const expense = amountCents => ({id:'purchase',type:'expense',amountCents,label:'Shopping',description:'Bike',createdAt:'2026-10-24T12:00:00Z'});
test('legacy records load without goals or storage changes; reservation changes only spendable and guide',()=>{
 const raw=JSON.stringify(base); assert.equal(validState(base),true); assert.equal(JSON.stringify(base),raw);
 const next=updateGoal(base,goal('a',6000)); assert.equal(currentBalance(next),10000);assert.equal(availableBalance(next),4000);assert.equal(dailyGuide(availableBalance(next),4),1000);assert.equal(reservedBalance(next),6000n);assert.equal(next.transactions,undefined);
});
test('Option A limits combined reservations, target reductions and releases in exact cents',()=>{
 const state=updateGoal(base,goal('a',6000));
 assert.throws(()=>updateGoal(state,goal('b',4001)));assert.throws(()=>updateGoal(state,goal('a',8001)));assert.throws(()=>updateGoal(state,{...goal('a',6000),targetCents:5999}));assert.throws(()=>updateGoal(state,goal('a',-1)));
 const full=updateGoal(state,goal('b',4000)); assert.equal(availableBalance(full),0);
 assert.equal(availableBalance(updateGoal(full,goal('a',0))),6000);
});
test('purchase creates exactly one expense, releases remainder and preserves other reservations',()=>{
 const state={...base,goals:[goal('a',6000),goal('b',2000)]};
 const next=purchaseGoal(state,'a',expense(5000));assert.equal(next.transactions.length,1);assert.equal(currentBalance(next),5000);assert.equal(availableBalance(next),3000);assert.deepEqual(next.goals[0],{...goal('a'),archived:true});assert.deepEqual(next.goals[1],state.goals[1]);assert.equal(state.goals[0].reservedCents,6000);
 assert.throws(()=>purchaseGoal(next,'a',{...expense(1),id:'again'}));assert.throws(()=>purchaseGoal(state,'a',expense(8001)));
 const usesAvailable=purchaseGoal(state,'a',expense(8000));assert.equal(availableBalance(usesAvailable),0);assert.equal(currentBalance(usesAvailable),2000);
});
test('archiving/deleting releases funds without changing transactions or total; invalid stored goals fail closed',()=>{
 const state={...base,goals:[goal('a',8000)]}; const archived=updateGoal(state,{...goal('a'),archived:true});assert.equal(availableBalance(archived),10000);assert.equal(currentBalance(archived),10000);assert.equal(archived.transactions,undefined);
 for(const goals of [null,{},[goal('a'),goal('a')],[{...goal('a'),targetCents:0}],[{...goal('a',1),archived:true}],[goal('a',8001)],[{...goal('a'),emoji:1}],[{...goal('a'),reservedCents:0.5}]]) assert.equal(validState({...base,goals}),false);
 assert.equal(validState({...base,goals:[goal('a',6000),goal('b',6000)]}),false);
});
test('reserved funds are protected from ordinary expenses, income deletion and starting-balance reduction',()=>{
 const state={...base,goals:[goal('a',6000)]};assert.equal(validState({...state,transactions:[expense(4001)]}),false);assert.equal(validState({...state,balanceCents:5999}),false);assert.equal(validState({...state,transactions:[expense(4000)]}),true);
 assert.equal(validState({...base,transactions:[expense(20000)]}),true);
});
