import { test, expect } from '@playwright/test';
const seed = {firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true,transactions:[{id:'expense',type:'expense',amountCents:500,label:'Food',description:'Lunch',date:'2026-10-25',createdAt:'2026-10-25T12:00:00.000Z'}],goals:[]};
for (const theme of ['light','dark']) test(`${theme} shared surface covers tabs, secondary pages and document forms`, async ({page}, testInfo) => {
 await page.setViewportSize({width:320,height:640});
 await page.goto('/violet-dineros/index.html');
 await page.evaluate(({seed,theme})=>{localStorage.setItem('lando-world:lwvd:v1',JSON.stringify(seed));localStorage.setItem('landos_world_appearance_preference_v1',theme);},{seed,theme});
 await page.reload();
 async function surface() {
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const colors=await page.evaluate(()=>[document.documentElement,document.body].map(e=>getComputedStyle(e).backgroundColor));
  expect(colors[0]).toBe(colors[1]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 for (const tab of ['Home','Activity','Goals','Insights']) {await page.getByRole('navigation').getByRole('button',{name:tab,exact:true}).click();await surface();}
 await page.getByRole('navigation').getByRole('button',{name:'Home',exact:true}).click();
 await page.locator('#settings').click();await surface();await page.locator('#settings-back').click();
 for (const action of ['Add Money','Add Expense']) {
  await page.getByRole('button',{name:action,exact:true}).click();
  await expect(page.locator('#transaction-amount')).toBeFocused();
  for (const height of [640,320,640]) {
   await page.setViewportSize({width:320,height});
   await expect(page.locator('.transaction-frame')).toHaveCSS('align-items','flex-start');
   for (const control of await page.locator('dialog input,dialog select,dialog button').all()) {await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();}
   await expect(page.locator('.sheet-fields')).toHaveCSS('overflow-y','visible');await surface();
  }
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
 }
 await page.getByRole('button',{name:'Can I Afford This?',exact:true}).click();
 await expect(page.getByRole('navigation')).toBeHidden();
 await expect(page.locator('.affordability')).toHaveCSS('border-bottom-left-radius','24px');
 await expect(page.locator('#afford-price')).toBeFocused();await surface();
 await page.screenshot({path:testInfo.outputPath(`${theme}-afford-bottom.png`),fullPage:true});
 await page.getByRole('button',{name:'Back to Home',exact:true}).click();
 await expect(page.getByRole('navigation')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lando-world:lwvd:v1')))).toEqual(seed);
});
test('Edit Expense keeps autofocus at safe top and paints status area while document scrolls',async({page},testInfo)=>{
 await page.route('**/violet-dineros/styles.css',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('env(safe-area-inset-top,0px)','44px').replaceAll('env(safe-area-inset-top)','44px')});});
 await page.goto('/violet-dineros/index.html');await page.evaluate(seed=>localStorage.setItem('lando-world:lwvd:v1',JSON.stringify(seed)),seed);await page.reload();
 await page.getByRole('navigation').getByRole('button',{name:'Activity',exact:true}).click();await page.locator('[data-transaction-id]').first().click();await page.getByRole('button',{name:'Edit',exact:true}).click();
 await expect(page.locator('#transaction-amount')).toBeFocused();
 await page.setViewportSize({width:390,height:320});
 await page.evaluate(()=>window.scrollTo(0,0));
 expect((await page.locator('.transaction-panel').boundingBox()).y).toBe(44);
 for(const control of await page.locator('dialog input,dialog select,dialog button').all()){await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();}
 expect(await page.evaluate(()=>{const s=getComputedStyle(document.body,'::after');return {height:s.height,position:s.position,background:s.backgroundColor};})).toEqual({height:'44px',position:'fixed',background:'rgb(252, 250, 255)'});
 await page.screenshot({path:testInfo.outputPath('edit-expense-bottom.png')});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
});

for (const theme of ['light','dark']) test(`${theme} affordability autofocus opens at the same safe top as transaction forms`,async({page})=>{
 await page.route('**/violet-dineros/styles.css',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('env(safe-area-inset-top,0px)','44px').replaceAll('env(safe-area-inset-top)','44px')});});
 await page.goto('/violet-dineros/index.html');await page.evaluate(({seed,theme})=>{localStorage.setItem('lando-world:lwvd:v1',JSON.stringify(seed));localStorage.setItem('landos_world_appearance_preference_v1',theme);},{seed,theme});await page.reload();
 // Record focus options as WebKit viewport resizing cannot open a physical iOS keyboard.
 await page.evaluate(()=>{const focus=HTMLElement.prototype.focus;window.affordFocusOptions=[];HTMLElement.prototype.focus=function(options){if(this.id==='afford-price')window.affordFocusOptions.push(options);return focus.call(this,options);};});
 for(const height of [844,400]){
  await page.setViewportSize({width:390,height});
  const tops=[];
  for(const action of ['Add Money','Add Expense','Can I Afford This?']){
   await page.getByRole('button',{name:action,exact:true}).click();
   const afford=action==='Can I Afford This?';
   await expect(page.locator(afford?'#afford-price':'#transaction-amount')).toBeFocused();
   tops.push((await page.locator(afford?'.affordability':'dialog .transaction-panel').boundingBox()).y);
   expect(await page.evaluate(()=>scrollY)).toBe(0);
   await page.getByRole('button',{name:afford?'Back to Home':'Cancel',exact:true}).click();
  }
  expect(tops).toEqual([44,44,44]);
 }
 expect(await page.evaluate(()=>window.affordFocusOptions)).toEqual([{preventScroll:true},{preventScroll:true}]);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lando-world:lwvd:v1')))).toEqual(seed);
});

for(const theme of ['light','dark']) test(`${theme} all entry panels share native opening and document scrolling`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/violet-dineros/index.html');await page.evaluate(({seed,theme})=>{localStorage.setItem('lando-world:lwvd:v1',JSON.stringify(seed));localStorage.setItem('landos_world_appearance_preference_v1',theme);},{seed,theme});await page.reload();
 await page.evaluate(()=>{const show=HTMLDialogElement.prototype.show;window.panelOpenings=[];HTMLDialogElement.prototype.show=function(){window.panelOpenings.push(this.id);return show.call(this);};});
 const layouts=[];
 for(const action of ['Add Money','Add Expense','Can I Afford This?']){
  await page.getByRole('button',{name:action,exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toHaveAttribute('open','');
  const input=dialog.locator('input[autofocus]');await expect(input).toBeFocused();
  layouts.push(await dialog.evaluate(e=>[e,e.querySelector('.transaction-frame'),e.querySelector('.transaction-panel')].map(n=>{const s=getComputedStyle(n);return {position:s.position,overflow:s.overflowY,minHeight:s.minHeight,padding:s.padding,border:s.border,radius:s.borderRadius,align:s.alignItems};})));
  for(const height of [400,844]){
   await page.setViewportSize({width:390,height});
   for(const control of await dialog.locator('input,select,button').all()){await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();}
   for(const layer of [dialog,dialog.locator('.transaction-frame'),dialog.locator('.transaction-panel')])await expect(layer).toHaveCSS('overflow-y','visible');
  }
  await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Hey, Violet!'})).toBeVisible();
 }
 expect(layouts[1]).toEqual(layouts[0]);expect(layouts[2]).toEqual(layouts[0]);
 expect(await page.evaluate(()=>window.panelOpenings)).toEqual(['transaction-sheet','transaction-sheet','affordability-sheet']);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lando-world:lwvd:v1')))).toEqual(seed);
});
