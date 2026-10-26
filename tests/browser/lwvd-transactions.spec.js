import {test,expect} from '@playwright/test';

async function continuous(page) {
 const dialog=page.getByRole('dialog');
 for(const inner of await dialog.locator('.transaction-frame,.transaction-panel,#transaction-form,.sheet-body').all()) await expect(inner).toHaveCSS('overflow-y','visible');
 await expect(dialog).toHaveCSS('position','relative');
 await expect(page.locator('.transaction-panel')).toHaveCSS('border-radius','24px');
 await expect(page.locator('.transaction-panel')).toHaveCSS('border-bottom-width','1px');
 const controls=await dialog.locator('input,select,button').all();
 for(const control of controls){await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();}
 await controls[0].scrollIntoViewIfNeeded();await expect(controls[0]).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
const key='lando-world:lwvd:v1',launcher='landos_world_my_apps_v1';
const preferences={schemaVersion:1,visibleAppIds:['digital-clock','violet-dineros'],appOrder:['digital-clock','violet-dineros','weather']};
async function setup(page,theme='light',transactions) {
  await page.setViewportSize({width:390,height:844});
  const date=new Date();date.setDate(date.getDate()+3);const payday=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const initial={firstName:'Max',balanceCents:15000,payday,frequency:'monthly',onboarded:true,...(transactions?{transactions}:{})};
  await page.addInitScript(({key,launcher,preferences,initial,theme})=>{
    if(!localStorage.getItem('sprint2-seeded')){localStorage.setItem(key,JSON.stringify(initial));localStorage.setItem(launcher,JSON.stringify(preferences));localStorage.setItem('other-app-test','untouched');localStorage.setItem('landos_world_appearance_preference_v1',theme);localStorage.setItem('sprint2-seeded','true');}
  },{key,launcher,preferences,initial,theme});
  await page.goto('/violet-dineros/index.html');await expect(page.getByRole('heading',{name:'Hey, Max!'})).toBeVisible();return initial;
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const sheet=page=>page.getByRole('dialog');
async function openAdd(page,type){await page.getByRole('button',{name:type==='income'?'Add Money':'Add Expense',exact:true}).click();await expect(sheet(page)).toBeVisible();await expect(sheet(page).getByLabel('How much?',{exact:true})).toBeFocused();}
async function fillTransaction(page,type,amount,label,description=''){
  await sheet(page).getByLabel('How much?',{exact:true}).fill(amount);
  await sheet(page).getByLabel(type==='income'?'Where did it come from?':'Category',{exact:true}).selectOption(label);
  await sheet(page).getByLabel(type==='income'?'Description (optional)':'What was it? (optional)',{exact:true}).fill(description);
}
async function add(page,type,amount,label,description=''){
  await openAdd(page,type);await fillTransaction(page,type,amount,label,description);
  await sheet(page).getByRole('button',{name:type==='income'?'Add Money':'Save Expense',exact:true}).click();await expect(sheet(page)).not.toBeVisible();
}
async function activity(page){await page.getByRole('button',{name:'Activity',exact:true}).click();}
async function home(page){await page.getByRole('button',{name:'Home',exact:true}).click();}

test('legacy data is not rewritten; income/expense, negative balances, guide and reload use cents',async({page})=>{
  const initial=await setup(page);expect(await saved(page)).toEqual(initial);await expect(page.locator('.balance')).toHaveText('$150.00');
  await expect(page.getByRole('button',{name:'Can I Afford This?',exact:true})).toBeEnabled();
  await add(page,'income','30','Allowance');await expect(page.locator('.balance')).toHaveText('$180.00');await expect(page.locator('.guide')).toHaveText('$60.00 a day');
  await add(page,'expense','6','Food','Coffee');await expect(page.locator('.balance')).toHaveText('$174.00');await expect(page.locator('.guide')).toHaveText('$58.00 a day');
  await add(page,'expense','200','Shopping','New shirt');await expect(page.locator('.balance')).toHaveText('-$26.00');await expect(page.locator('.guide')).toHaveText('$0.00 a day');
  const data=await saved(page);expect(data.balanceCents).toBe(15000);expect(data.transactions).toHaveLength(3);
  const {transactions,moneyProgress,...settings}=data;expect(settings).toEqual(initial);
  await page.reload();await expect(page.locator('.balance')).toHaveText('-$26.00');expect(await saved(page)).toEqual(data);
  await activity(page);await expect(page.locator('.transaction-row')).toHaveCount(3);expect(await page.locator('.transaction-row').allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining('−$200.00'),expect.stringContaining('+$30.00')]));
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),launcher)).toEqual(preferences);expect(await page.evaluate(()=>localStorage.getItem('other-app-test'))).toBe('untouched');
});

test('invalid, zero, negative and overprecision amounts and missing source are rejected; duplicate submit is guarded',async({page})=>{
  await setup(page);await openAdd(page,'income');
  for(const amount of ['0','-1','abc','1.234','1e2','']){
    await sheet(page).getByLabel('How much?',{exact:true}).fill(amount);await sheet(page).getByRole('button',{name:'Add Money',exact:true}).click();await expect(page.locator('#transaction-error')).toContainText('greater than zero');expect((await saved(page)).transactions).toBeUndefined();
  }
  await sheet(page).getByLabel('How much?',{exact:true}).fill('1.25');await sheet(page).getByRole('button',{name:'Add Money',exact:true}).click();await expect(page.locator('#transaction-error')).toContainText('Choose');
  await fillTransaction(page,'income','1.25','Gift');
  await page.locator('#transaction-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await expect(sheet(page)).not.toBeVisible();expect((await saved(page)).transactions).toHaveLength(1);await expect(page.locator('.balance')).toHaveText('$151.25');
});

test('Activity local date groups, newest-first order, search, filters and details',async({page})=>{
  const now=new Date(),yesterday=new Date(now);yesterday.setDate(now.getDate()-1);const earlier=new Date(now);earlier.setDate(now.getDate()-4);
  const records=[{id:'a',type:'income',amountCents:3000,label:'Allowance',description:'',createdAt:earlier.toISOString()},{id:'b',type:'expense',amountCents:600,label:'Food',description:'Coffee',createdAt:yesterday.toISOString()},{id:'c',type:'expense',amountCents:2400,label:'Shopping',description:'New shirt',createdAt:now.toISOString()}];
  await setup(page,'light',records);await activity(page);await expect(page.locator('.activity-group>h2').nth(0)).toHaveText('Today');await expect(page.locator('.activity-group>h2').nth(1)).toHaveText('Yesterday');await expect(page.locator('.transaction-row').first()).toContainText('New shirt');
  await page.getByRole('button',{name:'Money In',exact:true}).click();await expect(page.locator('.transaction-row')).toHaveCount(1);await expect(page.locator('.transaction-row')).toContainText('Allowance');
  await page.getByRole('button',{name:'Expenses',exact:true}).click();await expect(page.locator('.transaction-row')).toHaveCount(2);
  await page.getByLabel('Search activity').fill(' COFFEE ');await expect(page.locator('.transaction-row')).toHaveCount(1);await page.locator('.transaction-row').click();await expect(sheet(page)).toContainText('Food');await expect(sheet(page)).toContainText('Coffee');await expect(sheet(page)).toContainText('Expense');
  await sheet(page).getByRole('button',{name:'Close',exact:true}).click();await page.getByLabel('Search activity').fill('missing');await expect(page.locator('#activity-list')).toContainText('No matching');
  await page.getByLabel('Search activity').fill('food');await expect(page.locator('.transaction-row')).toHaveCount(1);
});

test('edit preserves ID/type/date and deletion still confirms and cancels',async({page})=>{
  await setup(page);await add(page,'expense','6','Food','Coffee');const original=(await saved(page)).transactions[0];await activity(page);await page.locator('.transaction-row').click();await sheet(page).getByRole('button',{name:'Edit',exact:true}).click();
  await expect(sheet(page).getByLabel('How much?',{exact:true})).toBeFocused();
  await fillTransaction(page,'expense','8.50','Fun','Movie snack');await sheet(page).getByRole('button',{name:'Save Changes',exact:true}).click();
  await expect(page.locator('.activity>h1')).toBeFocused();
  const edited={...original,amountCents:850,label:'Fun',description:'Movie snack'};
  expect((await saved(page)).transactions).toEqual([edited]);await expect(page.locator('#notice')).toHaveText('Changes saved.');
  await home(page);await expect(page.locator('.balance')).toHaveText('$141.50');await expect(page.locator('.guide')).toHaveText('$47.17 a day');await activity(page);
  await page.locator('.transaction-row').click();await sheet(page).getByRole('button',{name:'Delete',exact:true}).click();await expect(sheet(page)).toContainText('Your balance will be updated');expect((await saved(page)).transactions).toEqual([edited]);
  await sheet(page).getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).transactions).toEqual([edited]);await sheet(page).getByRole('button',{name:'Delete',exact:true}).click();await sheet(page).getByRole('button',{name:'Delete',exact:true}).click();
  await expect(page.locator('.transaction-row')).toHaveCount(0);await expect(page.locator('#notice')).toHaveText('Transaction deleted.');await home(page);await expect(page.locator('.balance')).toHaveText('$150.00');
  await page.reload();expect((await saved(page)).transactions).toEqual([]);
});

test('Starting Balance changes preserve transactions and recalculate Current Balance',async({page})=>{
  const initial=await setup(page);await add(page,'income','30','Allowance');await add(page,'expense','20','Food');const transactions=(await saved(page)).transactions;
  await expect(page.locator('.balance')).toHaveText('$160.00');
  await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('#edit-starting-balance')).toContainText('$150.00');await page.locator('#edit-starting-balance').click();await page.getByLabel('Starting Balance ($)',{exact:true}).fill('175');await page.getByRole('button',{name:'Save',exact:true}).click();
  expect(await saved(page)).toEqual({...initial,balanceCents:17500,transactions,moneyProgress:expect.objectContaining({xp:10})});await home(page);await expect(page.locator('.balance')).toHaveText('$185.00');
});

test('stale saves cannot overwrite newer raw financial data',async({page})=>{
  await setup(page);await openAdd(page,'income');await fillTransaction(page,'income','30','Gift');
  const newer=await page.evaluate(key=>{const data=JSON.parse(localStorage.getItem(key));data.balanceCents=20000;localStorage.setItem(key,JSON.stringify(data));return data;},key);
  await sheet(page).getByRole('button',{name:'Add Money',exact:true}).click();await expect(sheet(page).getByRole('alert')).toContainText('changed in another tab');expect(await saved(page)).toEqual(newer);
});

test('another tab updates the balance without losing transactions',async({page,context})=>{
  await setup(page);await add(page,'income','30','Gift');const second=await context.newPage();await second.goto('/violet-dineros/index.html');await add(second,'expense','10','Gas');await expect(page.locator('.balance')).toHaveText('$170.00');await expect(page.getByRole('button',{name:'Undo',exact:true})).toHaveCount(0);expect((await saved(page)).transactions).toHaveLength(2);
});

test('storage failures preserve saved data, keep the sheet open and show no success or Undo',async({page})=>{
  const initial=await setup(page);await page.evaluate(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw Error('quota');return original.call(this,name,value);};},key);
  await openAdd(page,'expense');await fillTransaction(page,'expense','20','Food');await sheet(page).getByRole('button',{name:'Save Expense',exact:true}).click();await expect(sheet(page).getByRole('alert')).toContainText('could not be saved');await expect(sheet(page)).toBeVisible();expect(await saved(page)).toEqual(initial);await expect(page.getByRole('button',{name:'Undo',exact:true})).toHaveCount(0);
});

for(const theme of ['light','dark','system']){
  test(`bottom sheet and Activity work in ${theme} with mobile keyboard-size viewports`,async({page})=>{
    await page.emulateMedia({colorScheme:'dark'});await setup(page,theme);await openAdd(page,'expense');
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='light'?'light':'dark');
    for(const [width,height] of [[320,568],[390,400],[430,844]]){
      await page.setViewportSize({width,height});await sheet(page).getByLabel('What was it? (optional)',{exact:true}).fill('A long description '.repeat(5));
      await sheet(page).getByRole('button',{name:'Save Expense',exact:true}).scrollIntoViewIfNeeded();
      await continuous(page);
    }
    await page.setViewportSize({width:390,height:844});await fillTransaction(page,'expense','1.25','Other','Snack');await sheet(page).getByRole('button',{name:'Save Expense',exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('');
    await activity(page);await expect(page.locator('.transaction-row')).toContainText('Snack');
    for(const tab of ['Goals','Insights','Home'])await page.getByRole('button',{name:tab,exact:true}).click();
    if(theme==='system'){await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');}
  });
}

test('invalid stored transactions fail closed without replacing legacy settings',async({page})=>{
  await setup(page);const raw=await page.evaluate(key=>{const data=JSON.parse(localStorage.getItem(key));data.transactions=[{amountCents:-10}];const raw=JSON.stringify(data);localStorage.setItem(key,raw);return raw;},key);await page.reload();await expect(page.getByRole('heading',{name:'Your saved information needs attention'})).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
});


test('success messages are noninteractive and expire at 2.5 seconds; errors remain',async({page})=>{
  await setup(page);const clockTime=new Date();await page.clock.install({time:clockTime});await page.clock.pauseAt(new Date(clockTime.getTime()+1000));await add(page,'income','10','Gift');await expect(page.locator('#notice')).toHaveText('Money added.');await expect(page.getByRole('button',{name:'Undo',exact:true})).toHaveCount(0);
  await page.clock.fastForward(2499);await expect(page.locator('#notice')).toHaveText('Money added.');await page.clock.fastForward(1);await expect(page.locator('#notice')).toBeEmpty();
  await add(page,'expense','2','Food');await expect(page.locator('#notice')).toHaveText('Expense saved.');await page.clock.fastForward(2500);await expect(page.locator('#notice')).toBeEmpty();
  const before=await saved(page);await page.evaluate(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw Error('quota');return original.call(this,name,value);};},key);
  await openAdd(page,'expense');await fillTransaction(page,'expense','1','Other');await sheet(page).getByRole('button',{name:'Save Expense',exact:true}).click();await page.clock.fastForward(3000);await expect(sheet(page).getByRole('alert')).toContainText('could not be saved');expect(await saved(page)).toEqual(before);
});

test('failed edit and deletion keep the saved transaction unchanged',async({page})=>{
  await setup(page);await add(page,'expense','6','Food','Coffee');const original=await saved(page);await activity(page);await page.locator('.transaction-row').click();await sheet(page).getByRole('button',{name:'Edit',exact:true}).click();
  await page.evaluate(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw Error('quota');return original.call(this,name,value);};},key);
  await fillTransaction(page,'expense','9','Fun','Snack');await sheet(page).getByRole('button',{name:'Save Changes',exact:true}).click();await expect(sheet(page).getByRole('alert')).toContainText('could not be saved');expect(await saved(page)).toEqual(original);
  await sheet(page).getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('.transaction-row').click();await sheet(page).getByRole('button',{name:'Delete',exact:true}).click();await sheet(page).getByRole('button',{name:'Delete',exact:true}).click();await expect(sheet(page).getByRole('alert')).toContainText('could not be saved');expect(await saved(page)).toEqual(original);
});




test('repeated sheets restore focus and page position through top, middle and bottom scroll',async({page})=>{
  await setup(page);await page.setViewportSize({width:320,height:568});
  for(const fraction of [0,0.5,1]){
    await page.evaluate(fraction=>window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*fraction),fraction);
    const opener=page.getByRole('button',{name:'Add Expense',exact:true});await opener.scrollIntoViewIfNeeded();
    const before=await page.evaluate(()=>window.scrollY);
    for(let cycle=0;cycle<2;cycle++){
      await opener.click();await expect(sheet(page)).toBeVisible();
      const bounds=await page.locator('.transaction-panel').boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(569);
      await page.keyboard.press('Escape');await expect(sheet(page)).not.toBeVisible();await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('');await expect(opener).toBeFocused();await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(before);
    }
  }
  expect((await saved(page)).transactions).toBeUndefined();
});

test('Home has no disclaimer and compact Activity rows communicate interactive details',async({page})=>{
  await setup(page);await expect(page.locator('main')).not.toContainText('A gentle guide, not a strict spending limit.');
  await add(page,'expense','6','Food','Coffee');await activity(page);
  const row=page.locator('.transaction-row');await expect(row).toHaveAccessibleName(/View transaction details: Coffee, Expense/);
  await expect(row.locator('.transaction-chevron svg')).toHaveAttribute('viewBox','0 0 24 24');await expect(row.locator('.transaction-chevron')).toHaveAttribute('aria-hidden','true');
  await expect(row.locator('.navigation-chevron svg')).toHaveCSS('width','24px');
  const bounds=await row.boundingBox(),amount=await row.locator('.transaction-amount').boundingBox(),chevron=await row.locator('.transaction-chevron').boundingBox();
  expect(bounds.height).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeLessThanOrEqual(64);expect(chevron.x).toBeGreaterThan(amount.x+amount.width+3);
  await row.focus();await page.keyboard.press('Enter');await expect(sheet(page)).toContainText('Coffee');await expect(sheet(page).getByRole('button',{name:'Edit',exact:true})).toBeVisible();
});

for(const mode of ['Add Money','Add Expense','Edit Money In','Edit Expense','Details']){
  test(`${mode}: document scrolling reaches every field and action`,async({page})=>{
    const createdAt=new Date().toISOString();
    await setup(page,'dark',[{id:'income',type:'income',amountCents:3000,label:'Allowance',description:'Pocket money',createdAt},{id:'expense',type:'expense',amountCents:600,label:'Food',description:'Coffee',createdAt}]);
    if(mode.startsWith('Add')) await openAdd(page,mode==='Add Money'?'income':'expense');
    else {
      await activity(page);await page.locator(`[data-transaction-id="${mode==='Edit Money In'?'income':'expense'}"]`).click();
      if(mode.startsWith('Edit'))await sheet(page).getByRole('button',{name:'Edit',exact:true}).click();
    }
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    if(mode!=='Details')await expect(sheet(page).getByLabel('How much?',{exact:true})).toBeFocused();
    await page.setViewportSize({width:390,height:320});await continuous(page);
    await page.locator('nav button').first().evaluate(button=>button.focus());expect(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement))).toBe(true);
    await sheet(page).getByRole('button',{name:'Close',exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('');
    expect(await page.locator('#transaction-sheet').evaluate(el=>el.style.getPropertyValue('--sheet-height'))).toBe('');
    expect((await saved(page)).transactions).toHaveLength(2);
  });
}

for(const type of ['income','expense']){
  test(`${type} Details is opaque, rounded, centered and returns to filtered Activity`,async({page})=>{
    const createdAt=new Date().toISOString(),label=type==='income'?'Gift':'Food';
    await setup(page,'dark',[{id:'detail',type,amountCents:600,label,description:'Coffee',createdAt}]);await activity(page);
    await page.getByRole('button',{name:type==='income'?'Money In':'Expenses',exact:true}).click();await page.getByLabel('Search activity').fill('Coffee');await page.locator('.transaction-row').click();
    await expect(sheet(page)).toHaveAttribute('data-view','details');await expect(page.locator('.shell')).not.toBeVisible();
    await continuous(page);
    expect(await sheet(page).evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(33, 25, 44)');
    await expect(sheet(page)).toContainText(type==='income'?'Money In':'Expense');await expect(sheet(page)).toContainText(label);await expect(sheet(page)).toContainText('Coffee');
    await page.setViewportSize({width:320,height:360});await page.evaluate(()=>document.documentElement.style.fontSize='32px');await continuous(page);
    expect(await page.evaluate(()=>document.scrollingElement.scrollHeight>innerHeight)).toBe(true);
    const edit=sheet(page).getByRole('button',{name:'Edit',exact:true});await edit.scrollIntoViewIfNeeded();const box=await edit.boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(360);
    await page.evaluate(()=>document.documentElement.style.fontSize='');await page.setViewportSize({width:390,height:844});
    await sheet(page).getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByLabel('Search activity')).toHaveValue('Coffee');await expect(page.getByRole('button',{name:type==='income'?'Money In':'Expenses',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.transaction-row')).toHaveCount(1);
    await page.locator('.transaction-row').click();await sheet(page).getByRole('button',{name:'Edit',exact:true}).click();await expect(sheet(page)).toHaveAttribute('data-view','form');await expect(page.locator('dialog[open]')).toHaveCount(1);await expect(sheet(page).getByLabel('How much?',{exact:true})).toBeFocused();
  });
}

test('restoring viewport height preserves the continuous form',async({page})=>{
  await setup(page);await openAdd(page,'expense');
  await page.setViewportSize({width:390,height:300});await continuous(page);
  await sheet(page).getByLabel('What was it? (optional)',{exact:true}).fill('Text keyboard');
  await page.setViewportSize({width:390,height:844});await continuous(page);
  await sheet(page).getByRole('button',{name:'Cancel',exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('');expect((await saved(page)).transactions).toBeUndefined();
});

test('touch outlines clear app-wide, while keyboard focus remains visible',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();await setup(page);
  for(const name of ['Add Money','Add Expense']){
    const action=page.getByRole('button',{name,exact:true});await action.tap();await expect(sheet(page).getByLabel('How much?',{exact:true})).toBeFocused();await sheet(page).getByRole('button',{name:'Cancel',exact:true}).tap();
    await expect(sheet(page)).not.toBeVisible();await expect(action).toHaveCSS('outline-style','none');await expect(action).toHaveCSS('box-shadow','none');await page.getByRole('heading',{name:'Hey, Max!'}).tap();await expect(action).toHaveCSS('box-shadow','none');
  }
  await add(page,'expense','6','Food','Coffee');
  const activityButton=page.getByRole('button',{name:'Activity',exact:true});await activityButton.tap();await expect(activityButton).toHaveCSS('outline-style','none');
  const row=page.locator('.transaction-row');await row.tap();await sheet(page).getByRole('button',{name:'Close',exact:true}).tap();await expect(row).toHaveCSS('outline-style','none');
  await page.getByRole('button',{name:'Expenses',exact:true}).tap();await expect(page.getByRole('button',{name:'Expenses',exact:true})).toHaveCSS('outline-style','none');
  await page.getByRole('button',{name:'Home',exact:true}).tap();await page.getByRole('button',{name:'Settings',exact:true}).tap();await page.locator('#edit-starting-balance').tap();await page.getByRole('button',{name:'Cancel',exact:true}).tap();await expect(page.locator('#edit-starting-balance')).toHaveCSS('outline-style','none');await page.getByRole('button',{name:'Home',exact:true}).tap();
  await page.getByRole('button',{name:'Add Money',exact:true}).tap();await expect(sheet(page).getByLabel('How much?',{exact:true})).toHaveCSS('outline-style','none');
  const source=sheet(page).getByLabel('Where did it come from?',{exact:true});await source.focus();await expect(source).toHaveCSS('outline-style','none');await page.keyboard.press('Tab');await source.focus();await expect(source).toHaveCSS('outline-style','solid');await sheet(page).getByRole('button',{name:'Cancel',exact:true}).tap();
  const action=page.getByRole('button',{name:'Add Money',exact:true});await page.keyboard.press('Tab');await action.focus();await expect(action).toHaveCSS('outline-style','solid');await page.keyboard.press('Enter');await page.keyboard.press('Escape');await expect(action).toBeFocused();await expect(action).toHaveCSS('outline-style','solid');
  await context.close();
});


for(const theme of ['light','dark']){
  test(`${theme} continuous forms keep fields and actions in document flow and center native select text`,async({page})=>{
    const createdAt=new Date().toISOString();const records=[{id:'income',type:'income',amountCents:3000,label:'Allowance',description:'Gift',createdAt},{id:'expense',type:'expense',amountCents:600,label:'Food',description:'Coffee',createdAt}];
    await setup(page,theme,records);const before=await saved(page);
    for(const mode of ['Add Money','Add Expense','Edit Money In','Edit Expense']){
      const income=mode.includes('Money');
      if(mode.startsWith('Add'))await openAdd(page,income?'income':'expense');
      else{await activity(page);await page.locator(`[data-transaction-id="${income?'income':'expense'}"]`).click();await sheet(page).getByRole('button',{name:'Edit',exact:true}).click();}
      const amount=sheet(page).getByLabel('How much?',{exact:true});
      await expect(amount).toBeFocused();
      const prefix=sheet(page).locator('.currency-input>span');await expect(prefix).toHaveText('$');await expect(prefix).toBeVisible();
      for(const value of ['', '10', '10.25']){await amount.fill(value);await expect(prefix).toBeVisible();await expect(amount).toHaveValue(value);}
      await expect(amount).toHaveAttribute('inputmode','decimal');await expect(amount).toHaveCSS('font-variant-numeric','tabular-nums');
      expect(await amount.evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Geist Mono');
      expect(await sheet(page).evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(theme==='light'?'rgb(252, 250, 255)':'rgb(33, 25, 44)');
      for(const height of [320,844]){
        await page.setViewportSize({width:390,height});
        await continuous(page);await expect(page.locator('.shell')).toBeHidden();
        const select=sheet(page).getByLabel(income?'Where did it come from?':'Category',{exact:true});await select.selectOption(income?'Paycheck':'Shopping');
        const metrics=await select.evaluate(el=>{const style=getComputedStyle(el);return {height:el.getBoundingClientRect().height,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,lineHeight:style.lineHeight,value:el.value};});
        expect(metrics.height).toBe(52);expect(metrics.paddingTop).toBe('0px');expect(metrics.paddingBottom).toBe('0px');expect(metrics.lineHeight).toBe('normal');expect(metrics.value).toBe(income?'Paycheck':'Shopping');
        const description=sheet(page).getByLabel(income?'Description (optional)':'What was it? (optional)',{exact:true});await description.fill(height===320?'Long description '.repeat(7):'Short description');
        await continuous(page);
      }
      await sheet(page).getByRole('button',{name:'Cancel',exact:true}).click();await home(page);
    }
    expect(await saved(page)).toEqual(before);
  });
}

for(const theme of ['light','dark'])test(`${theme} targeted numeric fonts, bullseye and Starting Balance prefix`,async({page})=>{
  await setup(page,theme);
  await expect(page.locator('.balance')).toHaveCSS('font-variant-numeric','tabular-nums');
  expect(await page.locator('.balance').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Geist Mono');
  expect(await page.locator('.greeting h1').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('DM Sans');
  await expect(page.locator('.goal-star svg circle')).toHaveCount(3);await expect(page.locator('.goal-star svg path')).toHaveCount(0);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:/Starting Balance/}).click();
  await expect(page.locator('.currency-input>span')).toBeVisible();await expect(page.locator('#starting-balance')).toHaveValue('150.00');
  await page.locator('#starting-balance').fill('10');await page.getByRole('button',{name:'Save',exact:true}).click();expect((await saved(page)).balanceCents).toBe(1000);
});

for(const theme of ['light','dark','system'])test(`${theme} Sprint 2.1 viewport, conversational balance, Settings and Activity polish`,async({page})=>{
  if(theme==='system')await page.emulateMedia({colorScheme:'dark'});
  await setup(page,theme);const before=await saved(page);
  const raw=await page.evaluate(k=>localStorage.getItem(k),key);
  await expect(page.locator('.story')).toHaveText('You have$150.00available to spend right now.');
  await expect(page.getByRole('heading',{name:'Your Money Story'})).toHaveCount(0);
  expect(await page.locator('.guide').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(18.08);
  const bullseye=await page.locator('.goal-star svg').innerHTML();
  for(const width of [320,390,430]){
    await page.setViewportSize({width,height:844});
    for(const tab of ['Home','Activity','Goals','Insights']){
      await page.getByRole('button',{name:tab,exact:true}).click();
      const geometry=await page.evaluate(()=>({height:innerHeight,body:document.body.getBoundingClientRect().height,shell:document.querySelector('.shell').getBoundingClientRect().height,nav:document.querySelector('nav').getBoundingClientRect().bottom,rootColor:getComputedStyle(document.documentElement).backgroundColor,bodyColor:getComputedStyle(document.body).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth}));
      expect(geometry.body).toBeGreaterThanOrEqual(geometry.height-1);expect(geometry.shell).toBeGreaterThanOrEqual(geometry.height-1);expect(Math.abs(geometry.nav-geometry.height)).toBeLessThanOrEqual(1);expect(geometry.overflow).toBe(false);expect(geometry.rootColor).not.toBe('rgb(0, 0, 0)');expect(geometry.bodyColor).toBe(geometry.rootColor);
      expect(await page.locator('nav [data-tab="Goals"] svg').innerHTML()).toBe(bullseye);
      if(tab==='Goals')expect(await page.locator('.empty-icon svg').innerHTML()).toBe(bullseye);
    }
  }
  await home(page);await page.getByRole('button',{name:'Settings',exact:true}).click();
  const rows=await page.locator('.settings-panel .setting-row').evaluateAll(rows=>rows.map(row=>({height:row.getBoundingClientRect().height,padding:getComputedStyle(row).padding,icon:row.querySelector('.setting-icon').getBoundingClientRect().width})));
  expect(rows).toHaveLength(4);expect(new Set(rows.map(r=>r.padding)).size).toBe(1);expect(new Set(rows.map(r=>r.icon)).size).toBe(1);expect(Math.max(...rows.map(r=>r.height))-Math.min(...rows.map(r=>r.height))).toBeLessThan(2);
  const actions=await page.locator('.settings-actions button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {top:r.top,width:r.width,height:r.height,bottom:r.bottom};}));expect(actions[0].top).toBe(actions[1].top);expect(Math.abs(actions[0].width-actions[1].width)).toBeLessThan(1);expect(actions[0].height).toBe(actions[1].height);expect(actions[0].height).toBeGreaterThanOrEqual(44);
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));const actionBottom=(await page.locator('.settings-actions').boundingBox()).y+(await page.locator('.settings-actions').boundingBox()).height;expect(actionBottom).toBeLessThanOrEqual((await page.locator('nav').boundingBox()).y-8);
  await page.getByLabel('First name',{exact:true}).fill('Unsaved');await page.locator('#cancel').click();await expect(page.getByRole('heading',{name:'Hey, Max!'})).toBeVisible();expect(await saved(page)).toEqual(before);
  await activity(page);await expect(page.locator('.activity-search svg')).toBeVisible();
  for(const name of ['All','Money In','Expenses']){const filter=page.getByRole('button',{name,exact:true});await filter.click();await expect(filter).toHaveAttribute('aria-pressed','true');await expect(filter).toHaveCSS('background-color','rgba(0, 0, 0, 0)');expect((await filter.boundingBox()).height).toBeGreaterThanOrEqual(44);}
  await page.keyboard.press('Tab');await page.getByRole('button',{name:'All',exact:true}).focus();await expect(page.getByRole('button',{name:'All',exact:true})).toHaveCSS('outline-style','solid');
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
  for(const record of [{...before,balanceCents:0},{...before,balanceCents:Number.MAX_SAFE_INTEGER},{...before,balanceCents:0,transactions:[{id:'negative',type:'expense',amountCents:Number.MAX_SAFE_INTEGER,label:'Other',description:'',createdAt:new Date().toISOString()}]}]){await page.evaluate(({key,record})=>localStorage.setItem(key,JSON.stringify(record)),{key,record});await page.reload();await expect(page.locator('.balance')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});

test('Sprint 2.1.1 navigation follows the viewport for short and scrolling tabs; financial values load Geist Mono',async({page})=>{
  const createdAt=new Date().toISOString();
  await setup(page,'dark',Array.from({length:40},(_,i)=>({id:String(i),type:'income',amountCents:125,label:'Gift',description:`Gift ${i}`,createdAt})));
  const before=await saved(page);
  expect(await page.evaluate(async()=>{const faces=await document.fonts.load('16px "Geist Mono"');return faces.length>0&&faces.every(face=>face.status==='loaded');})).toBe(true);
  await expect(page.locator('.guide .numeric')).toHaveCSS('font-family',/Geist Mono.*monospace/);
  expect(await page.locator('.payday-card .numeric').first().evaluate(el=>getComputedStyle(el).fontFamily)).not.toContain('Geist Mono');
  for(const height of [568,844,932]){
    await page.setViewportSize({width:390,height});
    for(const tab of ['Home','Activity','Goals','Insights','Settings']){
      if(tab==='Settings')await home(page);
      await page.getByRole('button',{name:tab,exact:true}).click();
      if(tab==='Activity'){await page.getByLabel('Search activity').fill('missing');await expect(page.locator('.transaction-row')).toHaveCount(0);}
      const check=async()=>{const geometry=await page.evaluate(()=>{const nav=document.querySelector('nav').getBoundingClientRect();return {bottom:nav.bottom,height:innerHeight,width:nav.width,position:getComputedStyle(document.querySelector('nav')).position,overflow:document.documentElement.scrollWidth>innerWidth};});expect(Math.abs(geometry.bottom-geometry.height)).toBeLessThanOrEqual(1);expect(geometry.width).toBe(390);expect(geometry.position).toBe('sticky');expect(geometry.overflow).toBe(false);};
      for(const fraction of [0,0.5,1]){await page.evaluate(fraction=>window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*fraction),fraction);await check();}
      if(tab==='Activity'){
        await page.getByLabel('Search activity').fill('');await expect(page.locator('.transaction-row')).toHaveCount(40);
        await expect(page.locator('.transaction-amount').first()).toHaveCSS('font-family',/Geist Mono.*monospace/);
        for(const fraction of [0,0.5,1]){await page.evaluate(fraction=>window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*fraction),fraction);await check();}
      }
    }
  }
  expect(await saved(page)).toEqual(before);
});

for(const theme of ['light','dark'])test(`${theme} diagnostics are removed while navigation, data and financial weights remain intact`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await setup(page,theme);const before=await saved(page);
  for(const tab of ['Home','Activity','Goals','Insights']){
    await page.getByRole('button',{name:tab,exact:true}).click();
    await expect(page.locator('#viewport-diagnostics,#viewport-safe-area')).toHaveCount(0);
    await expect(page.getByText('Viewport Diagnostics',{exact:false})).toHaveCount(0);
  }
  await page.setViewportSize({width:375,height:667});await page.evaluate(()=>dispatchEvent(new Event('orientationchange')));
  await home(page);await expect(page.locator('.balance')).toHaveCSS('font-weight','500');await expect(page.locator('.guide .numeric')).toHaveCSS('font-weight','500');await expect(page.locator('.greeting h1')).toHaveCSS('font-weight','500');await expect(page.getByRole('button',{name:'Add Money',exact:true})).toHaveCSS('font-weight','500');
  expect(await saved(page)).toEqual(before);expect(errors).toEqual([]);
});

test('standalone shell stays full height when launch dvh underreports by 33px',async({page})=>{
  // Desktop engines do not reproduce the installed-iPhone viewport bug. Model
  // only its smaller dvh and activate the real standalone CSS rule below.
  await page.route('**/violet-dineros/styles.css',async route=>{
    const response=await route.fetch();
    const css=(await response.text()).replaceAll('min-height:100dvh','min-height:calc(100vh - 33px)');
    await route.fulfill({response,body:css});
  });
  await setup(page,'dark');const before=await saved(page);
  await page.evaluate(()=>{
    const rules=[...document.styleSheets].flatMap(sheet=>[...sheet.cssRules]);
    const standalone=rules.find(rule=>rule.conditionText==='(display-mode: standalone)');
    if(!standalone)throw Error('Missing standalone viewport rule');
    standalone.media.mediaText='all';
  });
  for(const height of [841,874]){
    await page.setViewportSize({width:390,height});
    for(const tab of ['Home','Activity','Goals','Insights']){
      await page.getByRole('button',{name:tab,exact:true}).click();
      await page.evaluate(()=>window.scrollTo(0,0));
      const geometry=await page.evaluate(()=>({height:innerHeight,shell:document.querySelector('.shell').getBoundingClientRect().height,nav:document.querySelector('nav').getBoundingClientRect().bottom}));
      expect(geometry.shell).toBeGreaterThanOrEqual(geometry.height);
      expect(geometry.nav).toBe(geometry.height);
    }
  }
  expect(await saved(page)).toEqual(before);
});
