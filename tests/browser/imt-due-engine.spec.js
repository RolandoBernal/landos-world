import {test,expect} from '@playwright/test';
const key='lando-world:maintenance-total:v1';
const fixture={version:1,unknown:{preserve:true},bikes:[{id:'a',name:'Actual Bike',category:'bikes',active:true,currentMileage:1000},{id:'b',name:'Other asset',active:true,currentMileage:0}],components:[
  {id:'overdue',assetId:'a',name:'Chain',intervalMiles:500,estCost:12.5,estMinutes:10,currentStatus:'Attention',lastService:'Legacy text',custom:42},
  {id:'due',assetId:'a',name:'Pads',intervalMiles:600},
  {id:'soon',assetId:'a',name:'Tires',intervalMiles:750},
  {id:'current',assetId:'a',name:'Tune',intervalMiles:1000},
  {id:'unknown',assetId:'a',name:'No baseline',intervalMiles:500},
  {id:'unscheduled',assetId:'a',name:'No interval'},
],records:['overdue','due','soon','current'].map((id,i)=>({id:'record-'+id,assetId:'a',componentId:id,date:'2026-01-01',mileage:id==='overdue'?499:500,cost:i,serviceProvider:'Original provider',taskType:'Inspect',custom:'keep'}))};
async function open(page,data=fixture){await page.clock.install({time:new Date('2026-11-02T12:00:00-06:00')});await page.addInitScript(({key,raw})=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(key,raw);sessionStorage.setItem('seeded','yes');}},{key,raw:JSON.stringify(data)});await page.goto('/#/maintenance-total');}
async function garage(page){await page.locator('[data-imt-nav="assets"]').click();await page.getByRole('button',{name:'Open Bikes'}).click();await page.locator('[data-bike="a"]').click();}
for(const theme of ['light','dark','system'])test(`Today, Done, reload, undo, nav geometry and ${theme}`,async({page},info)=>{
  await open(page);await page.emulateMedia({colorScheme:'dark'});await page.evaluate(t=>window.LandosTheme.setPreference(t),theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='system'?'dark':theme);
  const attention=page.locator('.imt_section').filter({has:page.getByRole('heading',{name:'Needs attention',exact:true})});
  await expect(attention.locator('[data-task]')).toHaveCount(2);await expect(attention.locator('[data-task]').first()).toHaveAttribute('data-task','overdue');
  await expect(page.locator('.imt_health')).toContainText('75%');await expect(page.locator('.imt_health')).toContainText('2 unassessed');
  await expect(page.locator('[data-task="unknown"]')).toContainText('Needs baseline');await expect(page.locator('[data-task="unscheduled"]')).toContainText('Not scheduled');
  await page.screenshot({path:info.outputPath(`${theme}-today.png`),fullPage:true});
  const geometry=await page.locator('.imt_floating_controls').evaluate(el=>{const nav=el.querySelector('nav'),add=el.querySelector('.imt_add_button'),n=nav.getBoundingClientRect(),a=add.getBoundingClientRect();return {radius:getComputedStyle(nav).borderRadius,width:a.width,height:a.height,gap:n.top-a.bottom,right:n.right-a.right};});
  expect(geometry).toMatchObject({radius:'36px',width:56,height:56,gap:12,right:0});
  await attention.getByRole('button',{name:'Mark Chain done'}).click();await expect(attention.locator('[data-task="overdue"]')).toHaveCount(0);
  await expect(page.locator('.imt_health')).toContainText('100%');
  const done=page.locator('.imt_section').filter({has:page.getByRole('heading',{name:'Done today',exact:true})});await expect(done).toContainText('Chain');
  let saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);expect(saved.records).toHaveLength(5);expect(saved.records.at(-1)).toMatchObject({assetId:'a',componentId:'overdue',date:'2026-11-02',mileage:1000,cost:12.5,serviceProvider:'',taskType:'Service'});expect(saved.records.slice(0,4)).toEqual(fixture.records);expect(saved.components).toEqual(fixture.components);expect(saved.unknown).toEqual(fixture.unknown);expect(saved.version).toBe(1);
  await page.reload();await expect(page.locator('.imt_health')).toContainText('100%');await page.locator('[data-imt-nav="history"]').click();const record=saved.records.at(-1);
  page.once('dialog',d=>d.accept());await page.locator(`[data-delete-record="${record.id}"]`).click();await page.locator('[data-imt-nav="home"]').click();await expect(attention.locator('[data-task="overdue"]')).toHaveCount(1);await expect(page.locator('.imt_health')).toContainText('75%');
  await page.getByRole('button',{name:'Plan',exact:true}).click();await expect(page.getByRole('heading',{name:'This week',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'By mileage',exact:true})).toBeVisible();await expect(page.locator('[data-task="unknown"]')).toHaveCount(0);await expect(page.locator('[data-task="soon"] .imt_status')).toHaveCSS('background-color','rgb(223, 235, 242)');await expect(page.locator('[data-task="soon"] .imt_status')).toHaveCSS('color','rgb(42, 95, 130)');
  await page.screenshot({path:info.outputPath(`${theme}-plan.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(theme==='system'){await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');}
});
test('interval edit keeps legacy data and new components capture creation baseline',async({page})=>{
  await open(page);await garage(page);await page.locator('[data-component="overdue"]').click();await page.locator('[data-action="edit-component"]').click();
  await page.getByLabel('Service interval (miles)',{exact:true}).fill('800');await page.getByLabel('Service interval (months)',{exact:true}).fill('6');await page.getByLabel('Estimated cost',{exact:true}).fill('0');await page.getByLabel('Estimated time (minutes)',{exact:true}).fill('15');
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.clock.runFor(500);await expect(page.getByRole('heading',{name:'Chain',exact:true})).toBeVisible();
  let saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);expect(saved.components[0]).toMatchObject({intervalMiles:800,intervalMonths:6,estCost:0,estMinutes:15,currentStatus:'Attention',lastService:'Legacy text',custom:42});expect(saved.records).toEqual(fixture.records);
  await page.locator('[data-action="back"]').click();await page.locator('[data-action="add-component"]').click();await page.getByLabel('Component name *',{exact:true}).fill('New task');await page.getByLabel('Service interval (miles)',{exact:true}).fill('500');await page.getByRole('button',{name:'Save',exact:true}).click();await page.clock.runFor(500);
  saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);expect(saved.components.at(-1)).toMatchObject({name:'New task',mileageAtCreation:1000,intervalMiles:500});
  await page.locator('[data-component]').last().click();await expect(page.locator('.imt_status').first()).toHaveText('Current');await expect(page.locator('#maintenance-total-root')).toContainText('Based on task creation; no service record yet.');
});
test('Plan calendar grouping and time-first/mileage-first reasons',async({page})=>{
  const dates=['2026-10-01','2026-10-09','2026-10-16','2026-11-01'];const cs=dates.map((date,i)=>({id:'c'+i,assetId:'a',name:'Task '+i,intervalMonths:1}));const rs=dates.map((date,i)=>({id:'r'+i,assetId:'a',componentId:'c'+i,date,mileage:1000}));await open(page,{...fixture,components:cs,records:rs});await page.getByRole('button',{name:'Plan',exact:true}).click();
  for(const name of ['This week','Next 2 weeks','This season'])await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.locator('[data-task]').first()).toContainText('Overdue');await expect(page.getByRole('heading',{name:'By mileage',exact:true})).toHaveCount(0);
});
test('Done save failure leaves task and stored records unchanged',async({page})=>{
  await open(page);const raw=await page.evaluate(k=>localStorage.getItem(k),key);await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota');};});await page.getByRole('button',{name:'Mark Chain done'}).click();await expect(page.locator('[data-task-status]')).toContainText('Unable to save');await expect(page.getByRole('button',{name:'Mark Chain done'})).toBeEnabled();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
});
test('missing mileage directs Done to real form; missing baselines do not claim health',async({page})=>{
  await open(page,{...fixture,bikes:[{...fixture.bikes[0],currentMileage:''}],components:[{id:'c',assetId:'a',name:'Unknown task',intervalMiles:500}],records:[]});await expect(page.locator('.imt_health_ring')).toContainText('—');await expect(page.locator('[data-task="c"]')).toContainText('Needs baseline');await page.getByRole('button',{name:'Mark Unknown task done'}).click();await expect(page.getByLabel('Asset *',{exact:true})).toHaveValue('a');await expect(page.getByLabel('Component (optional)',{exact:true})).toHaveValue('c');await expect(page.locator('.imt_add_button')).toHaveCount(0);expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).records.length,key)).toBe(0);
});
test('Plan Done writes service and returns to the recomputed Plan',async({page})=>{
  await open(page);await page.getByRole('button',{name:'Plan',exact:true}).click();await page.getByRole('button',{name:'Mark Pads done'}).click();await expect(page.getByRole('heading',{name:'Plan',exact:true})).toBeVisible();await expect(page.locator('[data-task="due"]')).toHaveCount(0);const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);expect(saved.records.at(-1)).toMatchObject({componentId:'due',assetId:'a',mileage:1000,date:'2026-11-02'});await page.locator('[data-open-task="soon"]').click();await page.locator('[data-action="back"]').click();await expect(page.getByRole('heading',{name:'Plan',exact:true})).toBeVisible();
});
test('empty task list reports no health and does not claim Current',async({page})=>{
  await open(page,{version:1,bikes:[],components:[],records:[]});await expect(page.locator('.imt_health_ring')).toContainText('—');await expect(page.locator('#maintenance-total-root')).toContainText('No tasks yet.');await expect(page.locator('#maintenance-total-root')).not.toContainText('Everything is current.');
});
