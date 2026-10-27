import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/maintenance-total-v2.js',import.meta.url),'utf8');
const KEY='lando-world:maintenance-total:v1';
function app(raw,{readError=false}={}){
  const nodes=new Map();
  const root={innerHTML:'',querySelector(selector){
    if(selector==='.imt_header'||selector.includes('lando_settings_link'))return null;
    if(!nodes.has(selector))nodes.set(selector,{textContent:'',hidden:true});
    return nodes.get(selector);
  },querySelectorAll(){return []}};
  let stored=raw;const writes=[],downloads=[],revoked=[],timers=[];
  const context={window:{},Blob,URL:{createObjectURL(blob){downloads.push({blob});return 'blob:export';},revokeObjectURL(url){revoked.push(url);}},
    localStorage:{getItem(key){assert.equal(key,KEY);if(readError)throw Error('denied');return stored;},setItem(key,value){assert.equal(key,KEY);writes.push(value);stored=value;}},
    document:{readyState:'complete',getElementById(id){return id==='maintenance-total-root'?root:null;},body:{append(){}},createElement(tag){assert.equal(tag,'a');return {click(){Object.assign(downloads.at(-1),{filename:this.download,href:this.href});},remove(){}};}},
    setTimeout(fn){timers.push(fn);},FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key]??'';}}};
  vm.runInNewContext(source,context);
  return {root,nodes,writes,downloads,revoked,timers,api:context.window.MaintenanceTotal,stored:()=>stored,replace(value){stored=value;},
    export(){root.querySelector('[data-action="export"]').onclick();},
    addBike(){root.querySelector('[data-action="add-bike"]').onclick();root.querySelector('#imt-form').onsubmit({preventDefault(){},target:{values:{name:'New bike'}}});}};
}
const valid={version:1,bikes:[],components:[],records:[],extra:{unknown:'preserve'}};
test('downloads the current raw string exactly, including unknown fields, IDs and whitespace',async()=>{
  const raw=' {"version":1,"bikes":[{"id":"original","active":false,"extra":42}],"components":[],"records":[{"id":"deleted","deletedAt":"2026-01-01"}],"future":{"x":1}}\n';
  const a=app(JSON.stringify(valid));a.api.render('more');a.replace(raw);a.export();
  assert.equal(await a.downloads[0].blob.text(),raw);
  assert.match(a.downloads[0].filename,/^maintenance-total-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(a.downloads[0].blob.type,'application/json');assert.deepEqual(a.writes,[]);
  a.timers.forEach(fn=>fn());assert.deepEqual(a.revoked,['blob:export']);
});
for(const raw of ['{broken','', 'null','[]','{"version":2}', '{"version":1}',JSON.stringify({...valid,bikes:{}}),JSON.stringify({...valid,records:[null]})]){
  test(`protects and exports unsupported/malformed storage: ${raw}`,async()=>{
    const a=app(raw);
    for(const page of ['home','add','history','assets','more']){a.api.render(page);assert.match(a.root.innerHTML,/Editing is disabled/);assert.doesNotMatch(a.root.innerHTML,/Madone|<form/);}
    a.export();assert.equal(await a.downloads[0].blob.text(),raw);assert.equal(a.stored(),raw);assert.deepEqual(a.writes,[]);
  });
}
test('missing storage retains initial behavior, export does not persist samples',()=>{
  const a=app(null);assert.match(a.root.innerHTML,/Madone/);a.api.render('more');a.export();
  assert.equal(a.downloads.length,0);assert.match(a.root.querySelector('[data-export-status]').textContent,/No saved/);assert.deepEqual(a.writes,[]);
  a.api.render('home');a.addBike();assert.equal(JSON.parse(a.stored()).bikes.at(-1).name,'New bike');
});
test('valid saves preserve existing IDs and unknown fields',()=>{
  const data={...valid,bikes:[{id:'keep-id',active:true,name:'Bike',custom:42}],components:[{id:'keep-component',assetId:'keep-id',custom:true}],records:[{id:'keep-record',assetId:'keep-id',date:'2026-01-01',custom:'yes'}]};
  const a=app(JSON.stringify(data));a.addBike();const saved=JSON.parse(a.stored());
  assert.deepEqual(saved.bikes[0],data.bikes[0]);assert.deepEqual(saved.components,data.components);assert.deepEqual(saved.records,data.records);assert.deepEqual(saved.extra,data.extra);
});
test('unreadable storage blocks editing and reports export failure without writes',()=>{
  const a=app(null,{readError:true});assert.match(a.root.innerHTML,/Editing is disabled/);a.export();
  assert.match(a.root.querySelector('[data-export-status]').textContent,/Unable to export/);assert.deepEqual(a.writes,[]);
});
