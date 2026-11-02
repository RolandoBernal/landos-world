import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/maintenance-total-v2.js',import.meta.url),'utf8');
function engine({records=[],components=[],bikes=[]}={}){
  const context={localStorage:{getItem:()=>JSON.stringify({version:1,records,components,bikes})},window:{},document:{readyState:'loading',addEventListener(){}}};
  vm.runInNewContext(source.replace('window.MaintenanceTotal={init,render}', 'window.MaintenanceTotal={dueState,health,taskList,componentRecords}'),context);
  return context.window.MaintenanceTotal;
}
const asset={id:'a',active:true,currentMileage:1000};
const component={id:'c',assetId:'a',createdAt:'2026-01-31T20:00:00Z',mileageAtCreation:500};
const due=(c,a=asset,records=[])=>engine({records}).dueState({...component,...c},a,'2026-02-01');
test('mileage thresholds include zero and exact edges',()=>{
  for(const [left,status] of [[-1,'Overdue'],[0,'Due'],[100,'Due'],[101,'Soon'],[250,'Soon'],[251,'Current']]){
    const d=due({intervalMiles:500+left});assert.equal(d.status,status);assert.equal(d.milesLeft,left);
  }
});
test('calendar thresholds and local date-only calculations',()=>{
  for(const [date,status,left] of [['2026-01-01','Due',0],['2025-12-31','Overdue',-1],['2026-01-08','Due',7],['2026-01-09','Soon',8],['2026-01-31','Soon',27]]){
    const d=due({intervalMonths:1},asset,[{id:'r',assetId:'a',componentId:'c',date}]);assert.equal(d.status,status);assert.equal(d.daysLeft,left);
  }
  for(const [createdAt,left,status] of [['2025-12-31',30,'Soon'],['2026-01-01',31,'Current']]){const d=engine().dueState({...component,createdAt,intervalMonths:1},asset,'2026-01-01');assert.equal(d.daysLeft,left);assert.equal(d.status,status);}
  assert.equal(due({intervalMonths:2}).dueDate,'2026-03-31');
  assert.equal(engine().dueState({...component,intervalMonths:1},asset,'2026-02-28').status,'Due');
  assert.equal(engine().dueState({...component,createdAt:'2024-01-31',intervalMonths:1},asset,'2024-02-01').dueDate,'2024-02-29');
});
test('whichever known axis fires first wins, with both reasons visible',()=>{
  const d=due({intervalMiles:499,intervalMonths:12});assert.equal(d.status,'Overdue');assert.match(d.reason,/Overdue by 1 mile/);assert.match(d.reason,/Due Jan/);
  const time=due({intervalMiles:9999,intervalMonths:1},asset,[{id:'r',assetId:'a',componentId:'c',date:'2025-12-01',mileage:900}]);assert.equal(time.status,'Overdue');
});
test('newest matching nondeleted record wins; timestamps then ID break date ties',()=>{
  const records=[{id:'old',assetId:'a',componentId:'c',date:'2026-01-01',mileage:600},{id:'new',assetId:'a',componentId:'c',date:'2026-01-31',mileage:900,createdAt:'2026-01-31T10:00:00Z'},{id:'tie',assetId:'a',componentId:'c',date:'2026-01-31',mileage:950,updatedAt:'2026-01-31T11:00:00Z'},{id:'deleted',assetId:'a',componentId:'c',date:'2026-02-01',mileage:1000,deletedAt:'yes'},{id:'wrong',assetId:'b',componentId:'c',date:'2026-02-01',mileage:999}];
  assert.equal(due({intervalMiles:500},asset,records).milesLeft,450);
  records[2].deletedAt='yes';assert.equal(due({intervalMiles:500},asset,records).milesLeft,400);
  records.push({...records[1],id:'aaa',mileage:999});assert.equal(due({intervalMiles:500},asset,records).milesLeft,499);
});
test('unknown historical baselines never use current mileage or older records as substitutes',()=>{
  const no=due({intervalMiles:500,mileageAtCreation:undefined,createdAt:undefined});assert.equal(no.status,'Needs baseline');assert.equal(no.milesLeft,null);
  const noRecordMileage=due({intervalMiles:500},asset,[{id:'old',assetId:'a',componentId:'c',date:'2026-01-01',mileage:800},{id:'new',assetId:'a',componentId:'c',date:'2026-01-31'}]);assert.equal(noRecordMileage.status,'Needs baseline');
  const partial=due({intervalMiles:500,mileageAtCreation:undefined,intervalMonths:1});assert.equal(partial.status,'Soon');assert.equal(partial.complete,false);assert.match(partial.reason,/baseline/);
  assert.equal(due({intervalMiles:500,mileageAtCreation:undefined,intervalMonths:12}).status,'Needs baseline');
});
test('reversed readings, future dates, invalid dates, and zero are handled conservatively',()=>{
  assert.equal(due({intervalMiles:500}, {...asset,currentMileage:499}).status,'Needs baseline');
  assert.equal(due({intervalMonths:1,createdAt:'2026-02-02'}).status,'Needs baseline');
  assert.equal(due({intervalMonths:1,createdAt:'2026-02-30'}).status,'Needs baseline');
  assert.equal(due({intervalMonths:1.5}).status,'Needs baseline');
  assert.equal(due({intervalMiles:500,mileageAtCreation:0},{...asset,currentMileage:0}).milesLeft,500);
  for(const reading of ['','  ',null,undefined,true,[]])assert.equal(due({intervalMiles:500},{...asset,currentMileage:reading}).status,'Needs baseline');
  assert.equal(due({}).status,'Not scheduled');
});
test('asset and overall health exclude unassessed tasks and inactive assets without changing source',()=>{
  const components=[{...component,id:'late',intervalMiles:1},{...component,id:'current',intervalMiles:10000},{...component,id:'unknown'},{...component,id:'other',assetId:'b',intervalMiles:1}];
  const data={components,bikes:[asset,{id:'b',active:false,currentMileage:10000}],records:[]};const raw=JSON.stringify(data),e=engine(data);
  const h=e.health(e.taskList());assert.equal(h.percent,50);assert.equal(h.known,2);assert.equal(h.unknown,1);assert.equal(e.taskList()[0].c.id,'late');assert.equal(JSON.stringify(data),raw);
  assert.equal(e.health([]).percent,null);
});

test('a future service date blocks mileage baseline, and known overdue remains in health',()=>{
  const d=due({intervalMiles:500,createdAt:'2026-02-02'});assert.equal(d.status,'Needs baseline');assert.equal(d.milesLeft,null);
  const e=engine();const h=e.health([{due:{status:'Overdue',complete:false}},{due:{status:'Current',complete:true}},{due:{status:'Needs baseline',complete:false}}]);assert.equal(h.percent,50);assert.equal(h.known,2);assert.equal(h.unknown,1);
});
