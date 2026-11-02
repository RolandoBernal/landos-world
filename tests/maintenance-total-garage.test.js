import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/maintenance-total-v2.js',import.meta.url),'utf8');
function engine(data){const context={localStorage:{getItem:()=>JSON.stringify(data)},window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(source.replace('window.MaintenanceTotal={init,render}','window.MaintenanceTotal={starterTasks,assetRecords,lifetimeCost,assetCategory}'),context);return context.window.MaintenanceTotal;}
const data={version:1,bikes:[],components:[],records:[]};
test('all category templates carry real creation baselines and no invented records or estimates',()=>{
 const api=engine(data);for(const [category,count] of [['bikes',7],['cars',7],['household',6]]){const tasks=api.starterTasks({id:'actual',category,currentMileage:0},'2026-11-02T12:00:00Z');assert.equal(tasks.length,count);assert.equal(new Set(tasks.map(t=>t.id)).size,count);assert.ok(tasks.every(t=>t.assetId==='actual'&&t.createdAt==='2026-11-02T12:00:00Z'&&t.mileageAtCreation===(category==='household'?'':0)&&!('estCost'in t)&&!('lastService'in t)));}
 assert.deepEqual(JSON.parse(JSON.stringify(api.starterTasks({id:'a',category:'cars'}).slice(0,2).map(t=>[t.intervalMiles,t.intervalMonths]))),[[7500,6],[7500,6]]);
 assert.equal(api.starterTasks({id:'a',category:'bikes',currentMileage:''})[0].mileageAtCreation,'');
});
test('asset history excludes deleted and other-asset records, sorts newest first, totals only real costs',()=>{
 const records=[{id:'old',assetId:'a',date:'2025-01-01',cost:10},{id:'deleted',assetId:'a',date:'2026-11-01',cost:999,deletedAt:'yes'},{id:'other',assetId:'b',date:'2026-11-01',cost:999},{id:'zero',assetId:'a',date:'2026-01-01',cost:0},{id:'missing',assetId:'a',date:'2026-02-01',cost:''},{id:'latest',assetId:'a',date:'2026-03-01',cost:'2.50'}];const api=engine({...data,records}),history=api.assetRecords('a');assert.deepEqual(Array.from(history,r=>r.id),['latest','missing','zero','old']);const total=api.lifetimeCost(history);assert.equal(total.total,12.5);assert.equal(total.missing,1);assert.equal(api.assetCategory({}),'bikes');
});
