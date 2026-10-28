import {test,expect} from '@playwright/test';
const fixture={version:1,bikes:[{id:'bike',name:'Test bicycle',active:true,currentMileage:100}],components:[{id:'chain',assetId:'bike',name:'Chain',currentStatus:'Current'}],records:[{id:'record',assetId:'bike',componentId:'chain',taskType:'Clean',date:'2026-10-01'}]};
for(const theme of ['dark','light']) test(`all six Add/Edit forms hide floating Add and submit in ${theme}`,async({page},info)=>{
  await page.emulateMedia({colorScheme:theme});
  await page.addInitScript(f=>localStorage.setItem('lando-world:maintenance-total:v1',JSON.stringify(f)),fixture);
  await page.goto('/#/maintenance-total');
  const root=page.locator('#maintenance-total-root'),fab=root.locator('.imt_add_button'),nav=root.locator('.imt_bottom_nav');
  const regular=async()=>{await expect(fab).toBeVisible();await expect(nav.getByRole('button')).toHaveCount(4);};
  const submit=async(title)=>{
    await expect(root.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(fab).toHaveCount(0);
    await expect(nav.getByRole('button')).toHaveCount(4);
    const save=root.getByRole('button',{name:'Save',exact:true});
    await expect(save).toHaveCSS('background-color',theme==='dark'?'rgb(192, 196, 202)':'rgb(52, 55, 60)');
    await page.evaluate(()=>document.activeElement.blur());await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
    const s=await save.boundingBox(),n=await nav.boundingBox();expect(s.y+s.height).toBeLessThan(n.y);await expect(save).toBeInViewport();
    if(title==='Add Bike')await page.screenshot({path:info.outputPath(`${theme}-save-clear.png`)});
    await save.click();await expect(root.locator('form')).toHaveCount(0);await regular();
  };
  await regular();await root.locator('[data-action="add-bike"]').click();await root.getByLabel('Name *',{exact:true}).fill('New bicycle');await submit('Add Bike');
  await root.locator('[data-bike="bike"]').click();await regular();await root.locator('[data-action="edit-bike"]').click();await submit('Edit Bike');
  await root.locator('[data-action="add-component"]').click();await root.getByLabel('Component name *',{exact:true}).fill('New component');await submit('Add Component');
  await root.locator('[data-component="chain"]').click();await root.locator('[data-action="edit-component"]').click();await submit('Edit Component');
  await fab.click();await root.getByLabel('Asset *',{exact:true}).selectOption('bike');await root.getByLabel('Task *',{exact:true}).selectOption('Inspect');await submit('Add Maintenance Record');
  await root.locator('[data-edit-record="record"]').click();await submit('Edit Service Record');
  for(const label of ['Home','History','Assets','More']){await nav.getByRole('button',{name:label,exact:true}).click();await regular();}
});
