import {test,expect} from '@playwright/test';
const key='lando-world:lwvd:v1';
const seed={firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true,goals:[{id:'goal',name:'Bike',emoji:'🚲',targetCents:10000,reservedCents:6000,archived:false}]};
async function start(page,theme='light'){
 await page.setViewportSize({width:320,height:600});
 await page.addInitScript(({key,seed,theme})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('landos_world_appearance_preference_v1',theme);},{key,seed,theme});
 await page.goto('/violet-dineros/index.html');
}
async function expense(page,amount){
 await page.locator('#quick-actions-toggle').click();await page.getByRole('button',{name:'Add Expense',exact:true}).click();
 await page.getByLabel('How much?',{exact:true}).fill(amount);await page.getByLabel('Category',{exact:true}).selectOption('Food');await page.getByRole('button',{name:'Save Expense',exact:true}).click();
}
for(const theme of ['light','dark'])test(`${theme}: exact warning amounts, replacement, dismissal and no writes`,async({page})=>{
 await page.clock.install();await start(page,theme);const raw=await page.evaluate(key=>localStorage.getItem(key),key);
 await expense(page,'43');const notice=page.locator('#notice');
 await expect(notice).toContainText('You need $3.00 more');await expect(notice).toContainText('release $3.00');await page.screenshot({path:test.info().outputPath(`${theme}-warning.png`),fullPage:true});
 await page.getByLabel('How much?',{exact:true}).fill('106.63');await page.getByRole('button',{name:'Save Expense',exact:true}).click();
 await expect(notice).toContainText("You'd still be $6.63 short");await expect(notice).not.toContainText('You could');await expect(page.locator('#notice')).toHaveCount(1);
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Dismiss notification'}).click();await expect(notice).toBeEmpty();
 await page.clock.pauseAt(new Date());await page.getByRole('button',{name:'Save Expense',exact:true}).click();await expect(notice).not.toBeEmpty();await page.clock.fastForward(5999);await expect(notice).not.toBeEmpty();await page.clock.fastForward(1);await expect(notice).toBeEmpty();
 await page.getByLabel('How much?',{exact:true}).fill('100');await page.getByRole('button',{name:'Save Expense',exact:true}).click();await expect(notice).toContainText('release $60.00');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(notice).toBeEmpty();
 await expense(page,'100.01');await expect(notice).toContainText('$0.01 short');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expense(page,'40');await expect(notice).toContainText('Expense saved');expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).goals).toEqual(seed.goals);
 await page.locator('nav [data-tab=Goals]').click();await expect(notice).toBeEmpty();
});
test('LLT scroll threshold hides and reveals both controls; notices clear on another task',async({page})=>{
 await start(page);await expense(page,'40');await expect(page.locator('#notice')).toContainText('Expense saved');
 // Give Home enough scroll range without changing its actual controls.
 await page.locator('main').evaluate(e=>e.style.minHeight='2200px');
 await page.evaluate(()=>scrollTo(0,200));await expect(page.locator('body')).toHaveClass(/nav-scroll-hidden/);
 await expect(page.locator('nav')).toHaveCSS('visibility','hidden');await expect(page.locator('.floating-actions')).toHaveCSS('visibility','hidden');
 const hiddenBottom=await page.locator('#notice').evaluate(e=>parseFloat(getComputedStyle(e).bottom));expect(hiddenBottom).toBe(16);
 await page.evaluate(()=>scrollTo(0,195));await expect(page.locator('body')).toHaveClass(/nav-scroll-hidden/);
 await page.evaluate(()=>scrollTo(0,175));await expect(page.locator('body')).not.toHaveClass(/nav-scroll-hidden/);
 await expect(page.locator('nav')).toHaveCSS('visibility','visible');
 const n=await page.locator('#notice').boundingBox(),q=await page.locator('.floating-actions').boundingBox();expect(n.y+n.height).toBeLessThanOrEqual(q.y);
 await page.locator('#quick-actions-toggle').click();await expect(page.locator('#notice')).toBeEmpty();
 await page.locator('nav [data-tab=Activity]').click();await expect(page.locator('body')).not.toHaveClass(/nav-scroll-hidden/);
});

test('expense just below available balance saves with no warning and keeps reservations',async({page})=>{
 await start(page);await expense(page,'39.99');await expect(page.locator('#notice')).toHaveAttribute('data-kind','success');
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);expect(saved.transactions[0].amountCents).toBe(3999);expect(saved.goals).toEqual(seed.goals);
});
