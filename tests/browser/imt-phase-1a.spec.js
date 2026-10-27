import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const KEY='lando-world:maintenance-total:v1';
const fixture={version:1,bikes:[{id:'bike-original',name:'Test bicycle',active:true,currentMileage:100,custom:'preserve'}],components:[{id:'component-original',assetId:'bike-original',name:'Chain',currentStatus:'Current',extra:42}],records:[{id:'record-original',assetId:'bike-original',componentId:'component-original',taskType:'Clean',date:'2026-10-01',notes:'Original note',extra:'keep'}],unknown:{nested:true}};
async function open(page,raw){
  await page.addInitScript(({key,raw})=>{if(!sessionStorage.getItem('imt-test-seeded')){if(raw!==null)localStorage.setItem(key,raw);sessionStorage.setItem('imt-test-seeded','1');}},{key:KEY,raw});
  await page.goto('/#/maintenance-total');
  await expect(page.locator('#maintenance-total-root')).toBeVisible();
}
const root=page=>page.locator('#maintenance-total-root');
async function stored(page){return page.evaluate(key=>localStorage.getItem(key),KEY);}
async function download(page,testInfo,raw){
  const pending=page.waitForEvent('download');
  await root(page).getByRole('button',{name:'Download maintenance JSON',exact:true}).click();
  const result=await pending;
  expect(result.suggestedFilename()).toMatch(/^maintenance-total-\d{4}-\d{2}-\d{2}\.json$/);
  const path=testInfo.outputPath('maintenance-export.json');await result.saveAs(path);
  expect(await readFile(path,'utf8')).toBe(raw);expect(await stored(page)).toBe(raw);
}
test('download uses current raw storage, preserving formatting, IDs, deleted records and unknown fields',async({page},testInfo)=>{
  await open(page,JSON.stringify(fixture));
  await root(page).getByRole('button',{name:'More',exact:true}).click();
  const raw=' \n'+JSON.stringify({...fixture,records:[...fixture.records,{id:'deleted-id',deletedAt:'2026-10-02'}],unknown:{updated:'é 🚲'}})+'\n';
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw});
  await download(page,testInfo,raw);
});
for(const [label,raw] of [['malformed','{broken'],['empty',''],['unsupported-version','{"version":2}'],['invalid-shape','{"version":1,"bikes":{},"components":[],"records":[]}']]){
  test(`${label} storage stays protected through navigation and reload and can be exported`,async({page},testInfo)=>{
    await open(page,raw);
    for(const name of ['Home','History','Add','Assets','More']){
      await root(page).getByRole('button',{name,exact:true}).click();
      await expect(root(page).getByRole('alert')).toContainText('Editing is disabled');
      await expect(root(page).locator('form')).toHaveCount(0);expect(await stored(page)).toBe(raw);
    }
    await download(page,testInfo,raw);await page.reload();
    await expect(root(page).getByRole('alert')).toContainText('Editing is disabled');expect(await stored(page)).toBe(raw);
  });
}
test('missing storage exports no samples and retains bicycle creation',async({page})=>{
  await open(page,null);await expect(root(page).getByRole('button',{name:/Madone/})).toBeVisible();
  await root(page).getByRole('button',{name:'More',exact:true}).click();
  let downloads=0;page.on('download',()=>downloads++);
  await root(page).getByRole('button',{name:'Download maintenance JSON'}).click();
  await expect(root(page).getByRole('status')).toContainText('No saved maintenance data');expect(await stored(page)).toBeNull();expect(downloads).toBe(0);
  await root(page).getByRole('button',{name:'Home',exact:true}).click();
  await root(page).getByRole('button',{name:'＋ Add bike',exact:true}).click();
  await root(page).getByLabel('Name *',{exact:true}).fill('New bicycle');await root(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(root(page).getByRole('button',{name:/New bicycle/})).toBeVisible();
  expect(JSON.parse(await stored(page)).bikes.at(-1).name).toBe('New bicycle');
});
test('existing bicycle, component and maintenance add/edit/filter/delete workflows preserve IDs and extra fields',async({page})=>{
  await open(page,JSON.stringify(fixture));
  await root(page).getByRole('button',{name:/Test bicycle/}).click();
  await root(page).locator('header').getByRole('button',{name:'Edit',exact:true}).click();
  await root(page).getByLabel('Name *',{exact:true}).fill('Edited bicycle');await root(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(root(page).getByRole('heading',{name:'Edited bicycle',exact:true})).toBeVisible();
  await root(page).getByRole('button',{name:/Chain/}).click();
  await root(page).locator('header').getByRole('button',{name:'Edit',exact:true}).click();
  await root(page).getByLabel('Notes',{exact:true}).fill('Component edited');await root(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(root(page).getByRole('heading',{name:'Edited bicycle',exact:true})).toBeVisible();
  await root(page).getByRole('button',{name:/Chain/}).click();
  await root(page).getByRole('button',{name:'＋ Add Service Record',exact:true}).click();
  await expect(root(page).getByLabel('Asset *',{exact:true})).toHaveValue('bike-original');
  await expect(root(page).getByLabel('Component (optional)',{exact:true})).toHaveValue('component-original');
  await root(page).getByLabel('Task *',{exact:true}).selectOption('Inspect');
  await root(page).getByLabel('Date *',{exact:true}).fill('2026-10-27');
  await root(page).getByLabel('Notes',{exact:true}).fill('New record');await root(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(root(page).getByRole('heading',{name:'Maintenance History'})).toBeVisible();
  await root(page).getByLabel('Filter by bike').selectOption('bike-original');
  await expect(root(page).locator('.imt_record_card')).toHaveCount(2);
  await root(page).locator('[data-edit-record="record-original"]').click();
  await root(page).getByLabel('Notes',{exact:true}).fill('Edited record');await root(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(root(page).getByRole('heading',{name:'Maintenance History'})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());await root(page).locator('[data-delete-record="record-original"]').click();
  await expect(root(page).locator('.imt_record_card')).toHaveCount(1);
  const saved=JSON.parse(await stored(page));
  expect(saved.bikes[0]).toMatchObject({id:'bike-original',name:'Edited bicycle',custom:'preserve'});
  expect(saved.components[0]).toMatchObject({id:'component-original',assetId:'bike-original',extra:42,notes:'Component edited'});
  expect(saved.records[0]).toMatchObject({id:'record-original',extra:'keep',notes:'Edited record',deletedAt:expect.any(String)});
  expect(saved.unknown).toEqual(fixture.unknown);expect(saved.records[1]).toMatchObject({assetId:'bike-original',componentId:'component-original',taskType:'Inspect'});
  await page.reload();await root(page).getByRole('button',{name:'History',exact:true}).click();await expect(root(page).locator('.imt_record_card')).toHaveCount(1);
});
