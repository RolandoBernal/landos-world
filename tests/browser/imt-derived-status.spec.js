import { test, expect } from '@playwright/test';
const key='lando-world:maintenance-total:v1';
const fixture={version:1,unknown:{keep:true},bikes:[{id:'a',name:'Actual asset',active:true,currentMileage:100},{id:'b',name:'Other asset',active:true}],components:[{id:'c',assetId:'a',name:'Chain',currentStatus:'Attention',lastService:'Hand entered fiction',extra:42},{id:'empty',assetId:'a',name:'No logs',currentStatus:'Current'}],records:[{id:'older',assetId:'a',componentId:'c',date:'2026-01-01',taskType:'Inspect',cost:25},{id:'latest',assetId:'a',componentId:'c',date:'2026-10-01',taskType:'Replace',cost:0,mileage:0,serviceProvider:'Real provider'},{id:'deleted',assetId:'a',componentId:'c',date:'2026-11-01',taskType:'Repair',deletedAt:'yes'},{id:'wrong-asset',assetId:'b',componentId:'c',date:'2026-11-02',taskType:'Clean'}]};
async function open(page){await page.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key,raw:JSON.stringify(fixture)});await page.goto('/#/maintenance-total');}
async function component(page){await page.locator('[data-imt-nav="assets"]').click();await page.locator('[data-bike="a"]').click();await page.locator('[data-component="c"]').click();}
for(const theme of ['light','dark','system']) test(`derived records, safe navigation and mobile ${theme}`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await open(page);
  await page.emulateMedia({colorScheme:'dark'});await page.evaluate(t=>window.LandosTheme.setPreference(t),theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='system'?'dark':theme);
  await component(page);
  await expect(page.locator('.imt_status').first()).toHaveText('Service recorded');
  await expect(page.locator('.imt_stat').filter({hasText:'Service date'})).toContainText('Oct 1, 2026');
  await expect(page.locator('.imt_stat').filter({hasText:'Mileage'})).toContainText('0');
  await expect(page.locator('.imt_stat').filter({hasText:'Cost'})).toContainText('$0');
  await expect(page.locator('.imt_record_card')).toHaveCount(2);
  await expect(page.locator('#maintenance-total-root')).not.toContainText('Hand entered fiction');
  await page.locator('header [data-action="edit-component"]').click();await expect(page.locator('#c-status')).toHaveCount(0);await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Chain',exact:true})).toBeVisible();
  await page.locator('[data-action="add-record"]').click();await page.getByRole('button',{name:'Back',exact:false}).click();await expect(page.getByRole('heading',{name:'Chain',exact:true})).toBeVisible();
  await page.locator('[data-edit-record="latest"]').click();await page.getByLabel('Date *',{exact:true}).fill('2025-01-01');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('heading',{name:'History & costs',exact:true})).toBeVisible();await component(page);await expect(page.locator('.imt_stat').filter({hasText:'Service date'})).toContainText('Jan 1, 2026');
  page.once('dialog',d=>d.accept());await page.locator('[data-delete-record="older"]').click();await expect(page.getByRole('heading',{name:'Chain',exact:true})).toBeVisible();await expect(page.locator('.imt_stat').filter({hasText:'Service date'})).toContainText('Jan 1, 2025');
  page.once('dialog',d=>d.accept());await page.locator('[data-delete-record="latest"]').click();await expect(page.locator('.imt_status').first()).toHaveText('No service record');
  await page.screenshot({path:info.outputPath(`${theme}-component.png`),fullPage:true});
  await page.locator('[data-action="back"]').click();await expect(page.getByRole('heading',{name:'Actual asset',exact:true})).toBeVisible();await page.locator('[data-action="home"]').click();await expect(page.getByRole('heading',{name:'Garage',exact:true})).toBeVisible();
  await page.locator('[data-imt-nav="history"]').click();await expect(page.locator('.imt_record_card').first()).toContainText('Other asset');
  await page.getByLabel('Filter by asset').selectOption('b');await page.locator('[data-edit-record="wrong-asset"]').click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Filter by asset')).toHaveValue('b');
  await page.locator('#imt_settings_toggle').click();await page.locator('#imt_settings_toggle').click();await expect(page.getByLabel('Filter by asset')).toHaveValue('b');
  await page.locator('.imt_add_button').click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Filter by asset')).toHaveValue('b');
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);expect(saved.components).toEqual(fixture.components);expect(saved.bikes).toEqual(fixture.bikes);expect(saved.unknown).toEqual(fixture.unknown);expect(saved.version).toBe(1);expect(saved.records.find(r=>r.id==='latest')).toMatchObject({cost:0,mileage:0,serviceProvider:'Real provider'});
  await page.reload();await component(page);await expect(page.locator('.imt_status').first()).toHaveText('No service record');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(theme==='system'){await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');}
});
test('adding service recomputes detail and return from each main destination',async({page})=>{
  await open(page);await component(page);await page.locator('[data-action="add-record"]').click();await page.getByLabel('Date *',{exact:true}).fill('2026-11-02');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('heading',{name:'History & costs',exact:true})).toBeVisible();await component(page);await expect(page.locator('.imt_stat').filter({hasText:'Service date'})).toContainText('Nov 2, 2026');
  for(const [nav,heading] of [['home',/Good (morning|afternoon|evening), Chief\./],['assets','Garage'],['plan','Coming up'],['history','History & costs']]){await page.locator(`[data-imt-nav="${nav}"]`).click();await page.locator('.imt_add_button').click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();}
});
test('same-day records use edit/create timestamps and preserve valid raw export',async({page},info)=>{
  const data=structuredClone(fixture);data.records.push({id:'same-day',assetId:'a',componentId:'c',date:'2026-10-01',updatedAt:'2026-10-02T12:00:00Z',taskType:'Tune-up',mileage:55,cost:10});
  const raw=' \n'+JSON.stringify(data)+'\n';
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.goto('/#/maintenance-total');await component(page);
  await expect(page.locator('.imt_stat').filter({hasText:'Mileage'})).toContainText('55');
  await page.locator('[data-action="edit-component"]').click();await page.getByLabel('Notes',{exact:true}).fill('Edited note');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('heading',{name:'Chain',exact:true})).toBeVisible();
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);expect(saved.components[0]).toMatchObject({extra:42,currentStatus:'Attention',lastService:'Hand entered fiction',notes:'Edited note'});expect(saved.records).toEqual(data.records);
  await page.locator('#imt_settings_toggle').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download maintenance JSON'}).click();const download=await pending;const output=info.outputPath('valid-export.json');await download.saveAs(output);const {readFile}=await import('node:fs/promises');expect(await readFile(output,'utf8')).toBe(await page.evaluate(k=>localStorage.getItem(k),key));
});
test('protected storage stays protected through repeated Settings gear clicks',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(k=>localStorage.setItem(k,'{broken'),key);await page.goto('/#/maintenance-total');await page.locator('#imt_settings_toggle').click();await page.locator('#imt_settings_toggle').click();await expect(page.getByRole('alert')).toContainText('Editing is disabled');expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{broken');expect(errors).toEqual([]);
});
