import {test,expect} from '@playwright/test';
// Safeguard for the in-shell restructure (PR 1 of 2): LWVD's document- and
// window-level handlers must do nothing while the app is switched inactive
// via window.LandoLWVD.setActive(false). In the standalone document the app
// is always active, so each test flips the switch off, proves the handlers
// are inert, flips it back on, and proves the same events work again.
const key='lando-world:lwvd:v1';
const seed={firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true,goals:[{id:'goal',name:'Bike',emoji:'🚲',targetCents:10000,reservedCents:6000,archived:false}]};
async function start(page){
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('landos_world_appearance_preference_v1','light');},{key,seed});
 await page.goto('/violet-dineros/index.html');
 await expect(page.locator('.shell')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.LandoLWVD?.isActive())).toBe(true);
}
const setActive=(page,value)=>page.evaluate(v=>window.LandoLWVD.setActive(v),value);
async function openExpenseForm(page){
 await page.locator('#quick-actions-toggle').click();
 await page.getByRole('button',{name:'Add Expense',exact:true}).click();
 await expect(page.getByLabel('How much?',{exact:true})).toBeVisible();
}

test('Escape closes an open sheet page only while LWVD is active',async({page})=>{
 await start(page);
 await openExpenseForm(page);
 await setActive(page,false);
 await page.keyboard.press('Escape');
 // Inactive: the document-level Escape handler must not close the page.
 await expect(page.getByLabel('How much?',{exact:true})).toBeVisible();
 await setActive(page,true);
 await page.keyboard.press('Escape');
 await expect(page.getByLabel('How much?',{exact:true})).toBeHidden();
 await expect(page.getByRole('heading',{name:'Hey, Violet!'})).toBeVisible();
});

test('window scroll hides the floating nav only while LWVD is active',async({page})=>{
 await start(page);
 await page.locator('main').evaluate(e=>e.style.minHeight='2200px');
 await setActive(page,false);
 await page.evaluate(()=>scrollTo(0,300));
 await page.waitForTimeout(150);
 await expect(page.locator('.shell')).not.toHaveClass(/nav-scroll-hidden/);
 await setActive(page,true);
 await page.evaluate(()=>scrollTo(0,600));
 await expect(page.locator('.shell')).toHaveClass(/nav-scroll-hidden/);
 await page.evaluate(()=>scrollTo(0,0));
 await expect(page.locator('.shell')).not.toHaveClass(/nav-scroll-hidden/);
});

test('a submit anywhere dismisses the notice only while LWVD is active',async({page})=>{
 await page.clock.install();
 await start(page);
 await openExpenseForm(page);
 await page.getByLabel('How much?',{exact:true}).fill('40');
 await page.getByLabel('Category',{exact:true}).selectOption('Food');
 await page.getByRole('button',{name:'Save Expense',exact:true}).click();
 await expect(page.locator('#notice')).toContainText('Expense saved');
 const submitOutside=()=>page.evaluate(()=>{
  const form=document.createElement('form');
  document.body.append(form);
  form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  form.remove();
 });
 await setActive(page,false);
 await submitOutside();
 await expect(page.locator('#notice')).toContainText('Expense saved');
 await setActive(page,true);
 await submitOutside();
 await expect(page.locator('#notice')).toBeEmpty();
});

test('a draft opened before deactivation conflict-checks against its own base revision',async({page})=>{
 await start(page);
 // Open Edit Goal for the seeded goal ($60 of $100 reserved).
 await page.locator('nav [data-tab=Goals]').click();
 await page.getByRole('button',{name:'Manage Goal: Bike'}).click();
 await page.getByRole('button',{name:'Edit Goal'}).click();
 await expect(page.getByLabel('Goal name')).toHaveValue('Bike');
 await setActive(page,false);
 // A second tab in the same context raises the reservation to $70.
 const tab2=await page.context().newPage();
 await tab2.goto('/violet-dineros/index.html');
 await tab2.evaluate(k=>{
  const data=JSON.parse(localStorage.getItem(k));
  data.goals[0].reservedCents=7000;
  localStorage.setItem(k,JSON.stringify(data));
 },key);
 await page.waitForTimeout(300);
 await tab2.close();
 await setActive(page,true);
 // Saving a name change from the stale draft must hit the conflict
 // guard, preserve the draft, and leave the newer $70 untouched.
 await page.getByLabel('Goal name').fill('Bike (renamed)');
 await page.getByRole('button',{name:'Save Goal'}).click();
 await expect(page.locator('#notice')).toContainText('Your information changed in another tab. Reload before saving so those changes stay safe.');
 await expect(page.getByLabel('Goal name')).toHaveValue('Bike (renamed)');
 const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(stored.goals[0].reservedCents).toBe(7000);
 expect(stored.goals[0].name).toBe('Bike');
 // Cancelling the draft applies the deferred sync: the Goals list now
 // shows $70, and a fresh edit saves cleanly against the new revision.
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.locator('.goal-card')).toContainText('$70.00 of $100.00');
 await page.getByRole('button',{name:'Manage Goal: Bike'}).click();
 await page.getByRole('button',{name:'Edit Goal'}).click();
 await page.getByLabel('Goal name').fill('Bike (renamed)');
 await page.getByRole('button',{name:'Save Goal'}).click();
 await expect(page.locator('#notice')).toContainText('Goal saved.');
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(saved.goals[0].reservedCents).toBe(7000);
 expect(saved.goals[0].name).toBe('Bike (renamed)');
});

test('focus-mode tracking and quick-action closers run only while LWVD is active',async({page})=>{
 await start(page);
 const focusMode=()=>page.evaluate(()=>document.documentElement.dataset.focusMode);
 const keyTab=()=>page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true})));
 const pointerDown=()=>page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
 expect(await focusMode()).toBe('pointer');
 await setActive(page,false);
 await keyTab();
 expect(await focusMode()).toBe('pointer');
 await setActive(page,true);
 await keyTab();
 expect(await focusMode()).toBe('keyboard');
 await pointerDown();
 expect(await focusMode()).toBe('pointer');

 const toggle=page.locator('#quick-actions-toggle');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 // Deactivating closes the menu itself; reopen it (element handlers on
 // LWVD's own controls stay live by design) and prove the document-level
 // closers stay inert while inactive.
 await setActive(page,false);
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await page.evaluate(()=>{location.hash='isolation-off';});
 await page.waitForTimeout(150);
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await pointerDown();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await setActive(page,true);
 await page.evaluate(()=>{location.hash='isolation-on';});
 await expect(toggle).toHaveAttribute('aria-expanded','false');
});
