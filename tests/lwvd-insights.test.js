import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spendingPeriod,spendingSummary,smallPurchaseCost} from '../violet-dineros/model.js';
test('budget follows local recurring boundaries including payday, future anchor and month clamping',()=>{
 for(const [payday,frequency,today,start] of [['2026-10-30','weekly','2026-10-25','2026-10-23'],['2026-10-30','biweekly','2026-10-30','2026-10-30'],['2026-01-31','monthly','2026-02-28','2026-02-28'],['2026-01-31','monthly','2026-03-30','2026-02-28'],['2024-01-31','monthly','2024-02-29','2024-02-29'],['2026-01-31','monthly','2027-01-01','2026-12-31']])assert.deepEqual(spendingPeriod({payday,frequency},'budget',today),{start,end:today});
 assert.equal(spendingPeriod({payday:'2026-10-30',frequency:''}),null);
 assert.equal(spendingPeriod({payday:'',frequency:'weekly'}),null);
});
test('summaries include only expenses in local inclusive dates, exact categories, no mutation',()=>{
 const data={payday:'2026-10-30',frequency:'weekly',transactions:[['a','expense','Food',100,'2026-10-23'],['b','expense','Shopping',250,'2026-10-25'],['c','income','Gift',999,'2026-10-25'],['d','expense','Food',50,'2026-10-01'],['e','expense','Fun',10,'2026-09-30'],['f','expense','Gas',900,'2026-10-26']].map(([id,type,label,amountCents,date])=>({id,type,label,amountCents,createdAt:date+'T12:00:00',description:''}))};
 const before=JSON.stringify(data);
 assert.equal(spendingSummary(data,'budget','2026-10-25').total,350n);
 assert.equal(spendingSummary(data,'month','2026-10-25').total,400n);
 assert.equal(spendingSummary(data,'all','2026-10-25').total,1310n);
 assert.deepEqual(spendingSummary(data,'budget','2026-10-25').categories,[{label:'Food',cents:100n},{label:'Shopping',cents:250n}]);
 assert.equal(JSON.stringify(data),before);
 assert.equal(spendingSummary({},'budget').period,null);
 assert.equal(spendingSummary({},'all').count,0);
});
test('what-if uses exact cents, validates input and remains independent of state',()=>{
 assert.equal(smallPurchaseCost('2.50','weekly'),13000n);
 assert.equal(smallPurchaseCost('0.01','daily'),365n);
 assert.equal(smallPurchaseCost('5','monthly'),6000n);
 for(const input of ['', '0','-1','1.001','no','1,000'])assert.equal(smallPurchaseCost(input,'daily'),null);
 assert.equal(smallPurchaseCost('2','other'),null);
 assert.equal(smallPurchaseCost('90071992547409.91','daily'),9007199254740991n*365n);
});
