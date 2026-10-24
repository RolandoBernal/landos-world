import {test} from 'node:test';
import assert from 'node:assert/strict';
import {affordability,money} from '../violet-dineros/model.js';
const state={balanceCents:10000,transactions:[],goals:[{reservedCents:6000}]};
test('preview excludes reserved savings, uses cents and never mutates state',()=>{
 const before=JSON.stringify(state);
 for(const [input,remaining] of [['0.01',3999],['39.99',1],['40',0],['40.00',0]]){
  assert.deepEqual(affordability(state,input),{status:'affordable',affordable:true,priceCents:Math.round(Number(input)*100),remainingCents:remaining,shortageCents:null});
 }
 assert.equal(affordability(state,'40.01').shortageCents,1n);
 assert.equal(affordability(state,'60').affordable,false);
 assert.equal(JSON.stringify(state),before);
});
test('blank, zero, negatives, malformed and unsafe amounts cannot buy',()=>{
 for(const input of ['','  ']) assert.equal(affordability(state,input).status,'blank');
 for(const input of ['0','0.00','-1','NaN','Infinity','abc','1e2','1,000','$10','1.001','9007199254740992']) assert.equal(affordability(state,input).status,'invalid',input);
 assert.equal(affordability({...state,balanceCents:6000},'.01').affordable,false);
 assert.equal(affordability({...state,balanceCents:6000},'0.01').shortageCents,1n);
});
test('transaction-adjusted balance and extreme negative legacy balances remain exact',()=>{
 assert.equal(affordability({...state,transactions:[{type:'expense',amountCents:1000}]},'30').remainingCents,0);
 const result=affordability({balanceCents:0,transactions:[{type:'expense',amountCents:Number.MAX_SAFE_INTEGER}]},'90071992547409.91');
 assert.equal(result.shortageCents,18014398509481982n);
 assert.equal(money(result.shortageCents),'$180,143,985,094,819.82');
 assert.equal(money(-1n),'-$0.01');assert.equal(money(1n),'$0.01');assert.equal(money(101n),'$1.01');assert.equal(money(101),'$1.01');
});
