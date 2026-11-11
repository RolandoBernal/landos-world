import {test,expect} from '@playwright/test';
// Safeguard for the in-shell restructure: LWVD's document- and window-level
// handlers must do nothing while the app is switched inactive via
// window.LandoLWVD.setActive(false) (the shell router flips it on route
// changes). Each test flips the switch off, proves the handlers are inert,
// flips it back on, and proves the same events work again.
const key='lando-world:lwvd:v1';
const seed={firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true,goals:[{id:'goal',name:'Bike',emoji:'🚲',targetCents:10000,reservedCents:6000,archived:false}]};
async function start(page){
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('landos_world_appearance_preference_v1','light');},{key,seed});
 await page.goto('/#/violet-dineros');
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
 await page.locator('#violet-dineros-view main').evaluate(e=>e.style.minHeight='2200px');
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
 await page.locator('#violet-dineros-view nav [data-tab=Goals]').click();
 await page.getByRole('button',{name:'Manage Goal: Bike'}).click();
 await page.getByRole('button',{name:'Edit Goal'}).click();
 await expect(page.getByLabel('Goal name')).toHaveValue('Bike');
 await setActive(page,false);
 // A second tab in the same context raises the reservation to $70.
 const tab2=await page.context().newPage();
 await tab2.goto('/#/violet-dineros');
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
 const focusIn=()=>page.evaluate(()=>document.dispatchEvent(new FocusEvent('focusin',{bubbles:true})));
 await focusIn();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await pointerDown();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await setActive(page,true);
 await focusIn();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
});

test('reactivation preserves a Starting Balance draft and conflict-checks its save (PR 2 acceptance case)',async({page})=>{
 await start(page);
 // Open Edit Starting Balance (seeded at $100.00) and type a new value.
 await page.locator('#settings').click();
 await page.locator('#edit-starting-balance').click();
 await expect(page.getByRole('heading',{name:'Edit Starting Balance'})).toBeVisible();
 await page.getByLabel('Starting Balance').fill('123.45');
 // Leave LWVD through the shell router: the app deactivates for real.
 await page.goto('/#/');
 await expect.poll(()=>page.evaluate(()=>window.LandoLWVD?.isActive())).toBe(false);
 // While it is inactive, another tab saves a different starting balance.
 const tab2=await page.context().newPage();
 await tab2.goto('/#/');
 await tab2.evaluate(k=>{
  const data=JSON.parse(localStorage.getItem(k));
  data.balanceCents=11000;
  localStorage.setItem(k,JSON.stringify(data));
 },key);
 await page.waitForTimeout(300);
 await tab2.close();
 // Returning must not re-render over the draft: 123.45 is still typed,
 // and the newer $110.00 has not been applied underneath it.
 await page.goto('/#/violet-dineros');
 await expect.poll(()=>page.evaluate(()=>window.LandoLWVD?.isActive())).toBe(true);
 await expect(page.getByLabel('Starting Balance')).toHaveValue('123.45');
 // Saving the stale draft hits the existing conflict guard; the other
 // tab's $110.00 stays untouched in storage.
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('#notice')).toContainText('Your information changed in another tab. Reload before saving so those changes stay safe.');
 const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(stored.balanceCents).toBe(11000);
 // Leaving the draft applies the deferred sync: Home now reflects the
 // other tab's balance ($110.00 - $60.00 reserved for the goal = $50.00).
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Settings'})).toBeVisible();
 await page.locator('#settings').click();
 await expect(page.locator('.story')).toContainText('$50.00');
});

test('browser Back with an open confirmation leaves a working launcher and an unarchived goal',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('landos_world_appearance_preference_v1','light');},{key,seed});
 // Enter LWVD from the launcher so browser Back returns to the launcher.
 await page.goto('/#/');
 await page.locator('#lando-launcher [data-route="violet-dineros"]').click();
 await expect.poll(()=>page.evaluate(()=>window.LandoLWVD?.isActive())).toBe(true);
 // Goals → Manage Goal → Archive Goal opens the native confirmation:
 // a modal dialog that locks document scrolling while it is open.
 await page.locator('#violet-dineros-view nav [data-tab=Goals]').click();
 await page.getByRole('button',{name:'Manage Goal: Bike'}).click();
 await page.getByRole('button',{name:'Archive Goal',exact:true}).click();
 const openState=await page.evaluate(()=>{const d=document.querySelector('#transaction-sheet');return {open:d.open,view:d.dataset.view,overflow:document.body.style.overflow};});
 expect(openState).toEqual({open:true,view:'confirm',overflow:'hidden'});
 // Safari Back: the route leaves LWVD and the launcher becomes visible.
 await page.goBack();
 await expect(page).toHaveURL(/#\/$/);
 await expect.poll(()=>page.evaluate(()=>window.LandoLWVD?.isActive())).toBe(false);
 // The confirmation must be dismissed without running its action, and
 // its document scroll lock must be released.
 const exitState=await page.evaluate(()=>{const d=document.querySelector('#transaction-sheet');return {open:d.open,overflow:document.body.style.overflow};});
 expect(exitState.open).toBe(false);
 expect(exitState.overflow).not.toBe('hidden');
 const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(stored.goals[0].archived).toBe(false);
 expect(stored.goals[0].reservedCents).toBe(6000);
 // The launcher scrolls again.
 await page.evaluate(()=>{document.querySelector('#lando-launcher').style.minHeight='2200px';scrollTo(0,300);});
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(300);
 await page.evaluate(()=>scrollTo(0,0));
 // And it answers taps: re-entering LWVD lands on the still-mounted
 // Goal Details page (the round trip kept the view and its state).
 await page.locator('#lando-launcher [data-route="violet-dineros"]').click();
 await expect.poll(()=>page.evaluate(()=>window.LandoLWVD?.isActive())).toBe(true);
 await expect(page.getByRole('button',{name:'Archive Goal',exact:true})).toBeVisible();
});
