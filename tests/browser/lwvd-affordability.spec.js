import {test,expect} from '@playwright/test';
const key='lando-world:lwvd:v1';
const seed={firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true,goals:[{id:'bike',name:'Bike',emoji:'🚲',targetCents:10000,reservedCents:6000,archived:false}]};
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function start(page){await page.setViewportSize({width:390,height:844});await page.goto('/violet-dineros/index.html');await page.evaluate(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key,seed});await page.reload();await page.getByRole('button',{name:'Can I Afford This?',exact:true}).click();}
test('live cents preview, invalid inputs, exact balance, cancel and one explicit expense',async({page})=>{
 await start(page);const input=page.getByLabel('How much does it cost?'),buy=page.getByRole('button',{name:'Buy It',exact:true});await expect(input).toBeFocused();
 for(const value of ['','0','-1','abc','1.001','1,000','9007199254740992']){await input.fill(value);await expect(buy).toBeDisabled();}
 await input.fill('40.01');await expect(page.locator('#afford-result')).toContainText('$0.01 more');await expect(buy).toBeDisabled();
 await input.fill('39.99');await expect(page.locator('#afford-result')).toContainText('$0.01 left');await input.fill('40');await expect(page.locator('#afford-result')).toContainText('$0.00 left');expect(await saved(page)).toEqual(seed);
 await buy.click();await expect(page.getByRole('heading',{name:'Add Expense',exact:true})).toBeVisible();await expect(page.getByLabel('How much?',{exact:true})).toHaveValue('40.00');await expect(page.getByLabel('How much?',{exact:true})).toBeFocused();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(buy).toBeFocused();await expect(input).toHaveValue('40');expect(await saved(page)).toEqual(seed);
 await input.fill('25.50');await buy.click();await page.getByLabel('Category',{exact:true}).selectOption('Shopping');await page.locator('#transaction-form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});
 const result=await saved(page);expect(result.transactions).toHaveLength(1);expect(result.transactions[0].amountCents).toBe(2550);expect(result.goals).toEqual(seed.goals);await expect(page.getByRole('heading',{name:'Hey, Violet!'})).toBeVisible();await expect(page.locator('.story .balance')).toHaveText('$14.50');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Add Expense',exact:true}).click();await expect(page.getByLabel('How much?',{exact:true})).toHaveValue('');
});
test('edited amount cannot overdraw even without goals; stale preview and stale save do not write',async({page})=>{
 await start(page);const input=page.getByLabel('How much does it cost?');await input.fill('20');await page.getByRole('button',{name:'Buy It',exact:true}).click();await page.getByLabel('How much?',{exact:true}).fill('40.01');await page.getByLabel('Category',{exact:true}).selectOption('Food');await page.getByRole('button',{name:'Save Expense',exact:true}).click();await expect(page.locator('#transaction-error')).toContainText('current available');expect(await saved(page)).toEqual(seed);
 await page.getByLabel('How much?',{exact:true}).fill('20');await page.evaluate(key=>{const next=JSON.parse(localStorage.getItem(key));next.balanceCents=6000;localStorage.setItem(key,JSON.stringify(next));},key);await page.getByRole('button',{name:'Save Expense',exact:true}).click();expect((await saved(page)).transactions).toBeUndefined();await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Buy It',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#notice')).toContainText('Reload');
 await page.reload();await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({...JSON.parse(localStorage.getItem(key)),balanceCents:1000,goals:[]})),key);await page.reload();await page.getByRole('button',{name:'Can I Afford This?',exact:true}).click();await input.fill('10');await page.getByRole('button',{name:'Buy It',exact:true}).click();await page.getByLabel('How much?',{exact:true}).fill('10.01');await page.getByLabel('Category',{exact:true}).selectOption('Food');await page.getByRole('button',{name:'Save Expense',exact:true}).click();await expect(page.locator('#transaction-error')).toContainText('current available');expect((await saved(page)).transactions).toBeUndefined();
});
test('cross-tab updates close draft, refresh funds and keep preview read-only',async({page,context})=>{
 await start(page);await page.getByLabel('How much does it cost?').fill('30');await page.getByRole('button',{name:'Buy It',exact:true}).click();const other=await context.newPage();await other.goto('/violet-dineros/index.html');await other.evaluate(({key,seed})=>localStorage.setItem(key,JSON.stringify({...seed,balanceCents:7000})),{key,seed});await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('.afford-available')).toHaveText('$10.00');await expect(page.getByRole('button',{name:'Buy It',exact:true})).toBeDisabled();expect((await saved(page)).transactions).toBeUndefined();
});
for(const theme of ['light','dark'])test(`${theme} compact preview and expense form fit keyboard-sized and large-text layouts`,async({page},testInfo)=>{
 await start(page);await page.evaluate(theme=>localStorage.setItem('landos_world_appearance_preference_v1',theme),theme);await page.reload();await page.getByRole('button',{name:'Can I Afford This?',exact:true}).click();
 await page.getByLabel('How much does it cost?').fill('25.50');await page.screenshot({path:testInfo.outputPath(`${theme}-preview.png`)});
 for(const font of ['100%','200%'])for(const height of [844,400]){
  await page.setViewportSize({width:320,height});await page.evaluate(font=>document.documentElement.style.fontSize=font,font);const input=page.getByLabel('How much does it cost?');await input.fill('90071992547409.91');await input.fill('30.25');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await input.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  const back=page.locator('#afford-back');await back.scrollIntoViewIfNeeded();await expect(back).toBeInViewport();const box=await back.boundingBox();expect(box.width).toBe(50);expect(box.height).toBe(50);await expect(back.locator('svg')).toBeVisible();
  const buy=page.getByRole('button',{name:'Buy It',exact:true});await buy.scrollIntoViewIfNeeded();await expect(buy).toBeInViewport();expect((await buy.boundingBox()).height).toBeGreaterThanOrEqual(44);await buy.click();
  await expect(page.getByLabel('How much?',{exact:true})).toBeFocused();const select=page.getByLabel('Category',{exact:true});expect(await select.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('linear-gradient');for(const control of await page.locator('dialog input,dialog select').all())expect(await control.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  await expect(page.getByRole('button',{name:'Save Expense',exact:true})).toBeInViewport();await page.getByLabel('What was it? (optional)').fill('A long description '.repeat(6));await page.screenshot({path:testInfo.outputPath(`${theme}-${font}-${height}.png`)});await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await saved(page)).toEqual(seed);
 }
});

test('Buy It handoff follows the visual viewport through keyboard open and close',async({page})=>{
 await start(page);await page.getByLabel('How much does it cost?').fill('25.50');await page.getByRole('button',{name:'Buy It',exact:true}).click();
 const inside=async locator=>{const box=await locator.boundingBox();expect(box.y).toBeGreaterThanOrEqual(45);expect(box.y+box.height).toBeLessThanOrEqual(366);};
 await page.evaluate(()=>{Object.defineProperties(window.visualViewport,{height:{configurable:true,get:()=>320},offsetTop:{configurable:true,get:()=>45}});window.visualViewport.dispatchEvent(new Event('resize'));});
 await inside(page.locator('.transaction-panel'));await inside(page.getByLabel('How much?',{exact:true}));await page.getByLabel('What was it? (optional)').fill('A little treat');await inside(page.getByLabel('What was it? (optional)'));await inside(page.getByRole('button',{name:'Save Expense',exact:true}));
 await page.evaluate(()=>{delete window.visualViewport.height;delete window.visualViewport.offsetTop;window.visualViewport.dispatchEvent(new Event('resize'));});
 await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeInViewport();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:'Buy It',exact:true})).toBeFocused();expect(await saved(page)).toEqual(seed);
});

test('close and Escape preserve original purchase price; ordinary expense stays on its route',async({page})=>{
 await start(page);await page.getByLabel('How much does it cost?').fill('30.25');
 for(const close of ['Close','Escape']){
  await page.getByRole('button',{name:'Buy It',exact:true}).click();await page.getByLabel('How much?',{exact:true}).fill('20');
  if(close==='Escape')await page.keyboard.press('Escape');else await page.getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByLabel('How much does it cost?')).toHaveValue('30.25');expect(await saved(page)).toEqual(seed);
 }
 await page.getByRole('button',{name:'Back to Home',exact:true}).click();await page.getByRole('button',{name:'Add Expense',exact:true}).click();await page.getByLabel('How much?',{exact:true}).fill('5');await page.getByLabel('Category',{exact:true}).selectOption('Food');await page.getByRole('button',{name:'Save Expense',exact:true}).click();await expect(page.locator('.story .balance')).toHaveText('$35.00');expect((await saved(page)).transactions).toHaveLength(1);
});

for(const theme of ['light','dark'])test(`${theme} inline payday picker aligns and saves on narrow mobile`,async({page},testInfo)=>{
 await start(page);await page.evaluate(theme=>localStorage.setItem('landos_world_appearance_preference_v1',theme),theme);await page.reload();await page.locator('#settings').click();
 const date=page.getByLabel('Next payday',{exact:true});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await date.scrollIntoViewIfNeeded();await date.click();await date.fill('2026-11-15');await page.keyboard.press('Tab');
  expect(await date.evaluate(e=>({font:parseFloat(getComputedStyle(e).fontSize),align:getComputedStyle(e).textAlign}))).toEqual({font:16,align:'left'});
  const row=date.locator('xpath=ancestor::div[contains(@class,"setting-row")]');await expect(row.locator('.navigation-chevron')).toHaveCount(0);
  const inputBox=await date.boundingBox(),labelBox=await page.locator('label[for=payday]').boundingBox(),iconBox=await row.locator('.setting-icon').boundingBox();expect(inputBox.x).toBe(labelBox.x);expect(inputBox.y).toBeGreaterThanOrEqual(labelBox.y+labelBox.height);expect(iconBox.width).toBe(40);expect(inputBox.x+inputBox.width).toBeLessThanOrEqual(width);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.evaluate(()=>visualViewport.scale)).toBe(1);
 }
 await page.screenshot({path:testInfo.outputPath(`${theme}-payday.png`),fullPage:true});await page.getByRole('button',{name:'Save Settings',exact:true}).click();expect((await saved(page)).payday).toBe('2026-11-15');await expect(page.locator('.daily-card')).toBeVisible();await page.locator('#settings').click();await expect(date).toHaveValue('2026-11-15');
});

test('purchase save failure retains draft; retry saves once and updates Home daily guide',async({page})=>{
 await start(page);await page.evaluate(key=>{const data=JSON.parse(localStorage.getItem(key));const payday=new Date();payday.setDate(payday.getDate()+10);data.payday=`${payday.getFullYear()}-${String(payday.getMonth()+1).padStart(2,'0')}-${String(payday.getDate()).padStart(2,'0')}`;localStorage.setItem(key,JSON.stringify(data));},key);await page.reload();await expect(page.locator('.daily-card .numeric')).toHaveText('$4.00');await page.locator('#check-affordability').click();await page.getByLabel('How much does it cost?').fill('25');await page.getByRole('button',{name:'Buy It',exact:true}).click();await page.getByLabel('Category',{exact:true}).selectOption('Shopping');
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota');};});await page.getByRole('button',{name:'Save Expense',exact:true}).click();await expect(page.locator('#transaction-error')).toContainText('could not be saved');await expect(page.getByRole('dialog')).toBeVisible();expect((await saved(page)).transactions).toBeUndefined();
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);await page.getByRole('button',{name:'Save Expense',exact:true}).click();await expect(page.locator('.story .balance')).toHaveText('$15.00');await expect(page.locator('.daily-card .numeric')).toHaveText('$1.50');await expect(page.locator('h1')).toBeFocused();expect((await saved(page)).transactions).toHaveLength(1);
 await page.locator('nav').getByRole('button',{name:'Activity',exact:true}).click();await page.locator('.transaction-row').click();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('How much?',{exact:true}).fill('20');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(page.getByRole('heading',{name:'Activity',exact:true})).toBeVisible();expect((await saved(page)).transactions).toHaveLength(1);
});
