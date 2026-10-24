import {test,expect} from '@playwright/test';
const key='lando-world:lwvd:v1';
const payday=new Date();payday.setDate(payday.getDate()+4);
const seed={firstName:'Violet',balanceCents:10000,payday:`${payday.getFullYear()}-${String(payday.getMonth()+1).padStart(2,'0')}-${String(payday.getDate()).padStart(2,'0')}`,frequency:'',onboarded:true};
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function start(page){await page.setViewportSize({width:390,height:844});await page.goto('/violet-dineros/index.html');await page.evaluate(({key,seed})=>{localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('other-app','keep');},{key,seed});await page.reload();}
async function goals(page){await page.getByRole('button',{name:'Goals',exact:true}).click();}
async function create(page,name='Bike',target='80'){await page.getByRole('button',{name:'Create Goal',exact:true}).click();await page.getByLabel('Goal name',{exact:true}).fill(name);await page.getByLabel('Emoji (optional)').fill('🚲');await page.getByLabel('Target amount ($)',{exact:true}).fill(target);await page.getByRole('button',{name:'Save Goal',exact:true}).click();}
async function manage(page){await page.getByRole('button',{name:'Manage Goal: Bike',exact:true}).click();}
async function reserve(page,amount){await manage(page);await page.getByRole('button',{name:'Reserve Funds',exact:true}).click();await page.getByLabel('Amount ($)',{exact:true}).fill(amount);await page.getByRole('button',{name:'Reserve',exact:true}).click();}
test('goals lifecycle, accounting, featured selection and one purchase survive reload',async({page})=>{
 await start(page);expect(await saved(page)).toEqual(seed);await goals(page);await create(page);await reserve(page,'80');await expect(page.locator('.goal-card')).toContainText('Fully Funded');
 await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.locator('.balance')).toHaveText('$20.00');await expect(page.locator('.story')).toContainText('Plus $80.00 saved for your goals.');await expect(page.locator('.guide')).toHaveText('$5.00 a day');await expect(page.locator('.featured')).toContainText('Bike');
 await goals(page);await manage(page);await page.getByRole('button',{name:'Record Goal Purchase',exact:true}).click();await page.getByLabel('Purchase amount ($)').fill('65');await page.locator('#transaction-form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});
 const result=await saved(page);expect(result.transactions).toHaveLength(1);expect(result.transactions[0].amountCents).toBe(6500);expect(result.goals[0]).toMatchObject({archived:true,reservedCents:0});
 await page.reload();await expect(page.locator('.balance')).toHaveText('$35.00');await expect(page.locator('.featured')).not.toContainText('Bike');await page.getByRole('button',{name:'Activity',exact:true}).click();await expect(page.locator('.transaction-row')).toHaveCount(1);
 await goals(page);await page.getByRole('button',{name:'Manage Archived Goal: Bike'}).click();await page.getByRole('button',{name:'Delete Goal',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Goal Details'})).toBeVisible();await page.getByRole('button',{name:'Delete Goal',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();expect((await saved(page)).goals).toEqual([]);expect((await saved(page)).transactions).toHaveLength(1);expect(await page.evaluate(()=>localStorage.getItem('other-app'))).toBe('keep');
});
test('limits, edit, release, archive and protected spending',async({page})=>{
 await start(page);await goals(page);await create(page);await reserve(page,'81');await expect(page.getByRole('dialog').locator('.error')).toContainText('within');await page.getByRole('button',{name:'Cancel',exact:true}).click();await reserve(page,'60');
 await manage(page);await page.getByRole('button',{name:'Edit Goal',exact:true}).click();await page.getByLabel('Target amount ($)').fill('50');await page.getByRole('button',{name:'Save Goal',exact:true}).click();await expect(page.getByRole('dialog').locator('.error')).toContainText('Release');await page.getByLabel('Target amount ($)').fill('90');await page.getByRole('button',{name:'Save Goal',exact:true}).click();
 await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Add Expense',exact:true}).click();await page.getByLabel('How much?',{exact:true}).fill('41');await page.getByLabel('Category',{exact:true}).selectOption('Food');await page.getByRole('button',{name:'Save Expense',exact:true}).click();await expect(page.getByRole('dialog').locator('.error')).toContainText('Release goal funds');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await goals(page);await manage(page);await page.getByRole('button',{name:'Release Funds',exact:true}).click();await page.getByLabel('Amount ($)',{exact:true}).fill('10');await page.getByRole('button',{name:'Release',exact:true}).click();expect((await saved(page)).goals[0].reservedCents).toBe(5000);
 await manage(page);await page.getByRole('button',{name:'Archive Goal',exact:true}).click();await page.getByRole('button',{name:'Archive',exact:true}).click();expect((await saved(page)).goals[0]).toMatchObject({archived:true,reservedCents:0});expect((await saved(page)).transactions).toBeUndefined();
});
test('storage failure retains form and legacy data; circular back controls preserve navigation',async({page})=>{
 await start(page);await goals(page);await page.getByRole('button',{name:'Create Goal',exact:true}).click();await page.getByLabel('Goal name',{exact:true}).fill('Bike');await page.getByLabel('Target amount ($)').fill('80');await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota');};});await page.getByRole('button',{name:'Save Goal',exact:true}).click();await expect(page.getByRole('dialog').locator('.error')).toContainText('could not be saved');expect(await saved(page)).toEqual(seed);await page.reload();
 await page.locator('#settings').click();const back=page.locator('#settings-back');await expect(back).toHaveAccessibleName('Back to Home');const box=await back.boundingBox();expect(box.width).toBe(50);expect(box.height).toBe(50);await page.getByRole('button',{name:/Starting Balance/}).click();await page.getByRole('button',{name:'Back to Settings',exact:true}).click();await back.click();await expect(page.getByRole('heading',{name:'Hey, Violet!'})).toBeVisible();
});
test('goal content fits narrow screens and dark mode with scrollable form actions',async({page})=>{
 await start(page);await page.evaluate(()=>localStorage.setItem('landos_world_appearance_preference_v1','dark'));await page.reload();await page.setViewportSize({width:320,height:568});await goals(page);await create(page,'A very long goal name for a special birthday shopping trip','100');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-goal]').click();await page.getByRole('button',{name:'Edit Goal',exact:true}).click();await expect(page.getByRole('button',{name:'Save Goal',exact:true})).toBeInViewport();expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=innerWidth)).toBe(true);
});
test('failed and stale purchases leave goals and transactions intact',async({page})=>{
 await start(page);await goals(page);await create(page);await reserve(page,'60');await manage(page);await page.getByRole('button',{name:'Record Goal Purchase',exact:true}).click();
 const before=await saved(page);await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota');};});await page.getByRole('button',{name:'Save Purchase',exact:true}).click();await expect(page.getByRole('dialog').locator('.error')).toContainText('could not be saved');expect(await saved(page)).toEqual(before);
 await page.reload();await goals(page);await manage(page);await page.getByRole('button',{name:'Record Goal Purchase',exact:true}).click();await page.evaluate(key=>{const next=JSON.parse(localStorage.getItem(key));next.firstName='New name';localStorage.setItem(key,JSON.stringify(next));},key);await page.getByRole('button',{name:'Save Purchase',exact:true}).click();await expect(page.getByRole('dialog').locator('.error')).toContainText('another tab');expect((await saved(page)).transactions).toBeUndefined();expect((await saved(page)).goals[0].reservedCents).toBe(6000);
});

test('goal target explains its format, focuses invalid input and saves exact cents after correction',async({page})=>{
 await start(page);await goals(page);await page.getByRole('button',{name:'Create Goal',exact:true}).click();
 await page.getByLabel('Goal name',{exact:true}).fill('New iPhone');const target=page.getByLabel('Target amount ($)',{exact:true});
 await expect(target).toHaveAttribute('aria-describedby','goal-target-hint');await expect(page.locator('#goal-target-hint')).toContainText('1500 or 1500.50, without commas or a $ sign');
 for(const amount of ['1,500','$1500','0','1500.001']){
  await target.fill(amount);await page.getByRole('button',{name:'Save Goal',exact:true}).click();await expect(target).toBeFocused();await expect(target).toHaveAttribute('aria-invalid','true');await expect(page.getByRole('dialog').locator('.error')).toContainText('Do not include commas or a $ sign');expect((await saved(page)).goals).toBeUndefined();
 }
 await target.fill('1500.50');await page.getByRole('button',{name:'Save Goal',exact:true}).click();expect((await saved(page)).goals[0].targetCents).toBe(150050);
 await page.locator('[data-goal]').click();await page.getByRole('button',{name:'Edit Goal',exact:true}).click();await expect(target).toHaveValue('1500.50');await expect(page.getByRole('button',{name:'Close',exact:true})).toBeInViewport();await expect(page.locator('#goal-target-hint')).toBeVisible();
});

for(const theme of ['light','dark'])test(`${theme} goal progress has a purple empty track and teal fill on Home, Goals and Details`,async({page},testInfo)=>{
 await start(page);await page.evaluate(theme=>localStorage.setItem('landos_world_appearance_preference_v1',theme),theme);await page.reload();await goals(page);await create(page);
 for(const amount of [0,40,80]){
  if(amount)await reserve(page,'40');
  for(const tab of ['Home','Goals']){
   await page.getByRole('button',{name:tab,exact:true}).click();const progress=page.getByRole('progressbar');await expect(progress).toHaveAttribute('value',String(amount*100));await expect(progress).toHaveAttribute('max','8000');await expect(progress).toHaveCSS('background-color','rgb(129, 70, 203)');await expect(progress).toHaveCSS('color','rgb(46, 230, 197)');
  }
  await page.screenshot({path:testInfo.outputPath(`progress-${amount}.png`)});
 }
 await expect(page.locator('.goal-card')).toContainText('Fully Funded');await manage(page);await expect(page.getByRole('dialog').getByRole('progressbar')).toHaveAttribute('value','8000');
});

for(const theme of ['light','dark'])test(`${theme} Goal Details fills the visible frame and every action remains reachable at large text`,async({page},testInfo)=>{
 await start(page);await page.evaluate(theme=>localStorage.setItem('landos_world_appearance_preference_v1',theme),theme);await page.reload();await goals(page);await create(page);
 await page.setViewportSize({width:320,height:568});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await manage(page);
 const dialog=page.getByRole('dialog');await expect(dialog).toHaveAttribute('data-view','details');await expect(page.locator('.shell')).toHaveCSS('visibility','hidden');
 for(const height of [568,400]){
  await page.setViewportSize({width:320,height});await expect.poll(()=>page.locator('.transaction-panel').evaluate(e=>Math.round(e.getBoundingClientRect().height))).toBe(height);const bounds=await page.locator('.transaction-panel').boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeLessThanOrEqual(1);expect(bounds.height).toBeLessThanOrEqual(height);expect(bounds.height).toBeGreaterThanOrEqual(height-1);
  await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeInViewport();
  for(const name of ['Edit Goal','Reserve Funds','Release Funds','Record Goal Purchase','Archive Goal','Delete Goal']){const button=dialog.getByRole('button',{name,exact:true});await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();}
  expect(await dialog.evaluate(e=>e.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.screenshot({path:testInfo.outputPath('goal-details-large-text.png')});await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('.shell')).toHaveCSS('visibility','visible');expect((await saved(page)).transactions).toBeUndefined();
});

test('goal purchase category uses the inset LLT chevron and remains a working native select',async({page},testInfo)=>{
 await start(page);await goals(page);await create(page);await manage(page);await page.getByRole('button',{name:'Record Goal Purchase',exact:true}).click();const category=page.getByLabel('Category',{exact:true});await expect(page.getByRole('button',{name:'Close',exact:true})).toBeInViewport();
 await expect(category).toHaveCSS('appearance','none');await expect(category).toHaveCSS('padding-inline-end','48px');const image=await category.evaluate(e=>getComputedStyle(e).backgroundImage);expect(image.match(/linear-gradient/g)).toHaveLength(2);
 await category.selectOption('Fun');await expect(category).toHaveValue('Fun');await page.screenshot({path:testInfo.outputPath('goal-purchase-select.png')});await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).transactions).toBeUndefined();
});

test('every goal form opens on its first input and Details keeps heading focus',async({page})=>{
 await start(page);await goals(page);await page.getByRole('button',{name:'Create Goal',exact:true}).click();await expect(page.getByLabel('Goal name',{exact:true})).toBeFocused();await page.getByRole('button',{name:'Cancel',exact:true}).click();await create(page);
 for(const [action,id] of [['Edit Goal','goal-name'],['Reserve Funds','goal-amount'],['Release Funds','goal-amount'],['Record Goal Purchase','goal-amount']]){
  await manage(page);await expect(page.locator('#sheet-title')).toBeFocused();await page.getByRole('button',{name:action,exact:true}).click();await expect(page.locator(`#${id}`)).toBeFocused();await expect(page.locator(`#${id}`)).toBeInViewport();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 }
 expect((await saved(page)).transactions).toBeUndefined();expect((await saved(page)).goals[0].reservedCents).toBe(0);
});

test('onboarding, Settings and Starting Balance focus the first input on entry and return',async({page})=>{
 await page.goto('/violet-dineros/index.html');await expect(page.getByLabel('What’s your first name?')).toBeFocused();await page.getByLabel('What’s your first name?').fill('Violet');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByLabel('Your money ($)')).toBeFocused();await page.getByLabel('Your money ($)').fill('100');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByLabel('Next payday (optional)')).toBeFocused();await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByLabel('Your money ($)')).toBeFocused();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Skip for now',exact:true}).click();await page.getByRole('button',{name:'Go to My Dashboard',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByLabel('First name',{exact:true})).toBeFocused();await page.locator('#edit-starting-balance').click();await expect(page.getByLabel('Starting Balance ($)',{exact:true})).toBeFocused();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('First name',{exact:true})).toBeFocused();await page.locator('#settings-back').click();
 for(const action of ['Add Money','Add Expense']){await page.getByRole('button',{name:action,exact:true}).click();await expect(page.getByLabel('How much?',{exact:true})).toBeFocused();await page.getByRole('button',{name:'Cancel',exact:true}).click();}
 expect((await saved(page)).transactions).toBeUndefined();
});

test('Home shows spendable money and compact featured card opens its specific goal by keyboard',async({page})=>{
 await start(page);await expect(page.locator('.story')).not.toContainText('saved for your goals');await goals(page);await create(page);await reserve(page,'10');
 await page.getByRole('button',{name:'Home',exact:true}).click();const before=await saved(page);
 await expect(page.locator('.balance')).toHaveText('$90.00');await expect(page.locator('.story')).toContainText('Plus $10.00 saved for your goals.');await expect(page.locator('.guide')).toHaveText('$22.50 a day');
 const card=page.getByRole('button',{name:'View Goal: Bike',exact:true});await expect(page.getByRole('button',{name:'View Goals',exact:true})).toHaveCount(0);
 const cue=await card.locator('.navigation-chevron').boundingBox();expect(cue.width).toBe(38);expect(cue.height).toBe(38);
 await expect(card.locator('svg')).toHaveCSS('width','24px');await expect(card.locator('svg')).toHaveCSS('stroke-width','2.25px');
 const bounds=await card.boundingBox();const parent=await page.locator('.featured').boundingBox();expect(bounds.width).toBeCloseTo(parent.width);expect(bounds.height).toBeCloseTo(parent.height);
 await card.focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Goal Details'})).toBeVisible();await expect(page.getByRole('dialog')).toContainText('Bike');await page.getByRole('button',{name:'Close',exact:true}).click();await expect(card).toBeFocused();
 await card.click();await expect(page.getByRole('heading',{name:'Goal Details'})).toBeVisible();expect(await saved(page)).toEqual(before);
});

test('LWVD editable controls retain focus, readable sizes and narrow viewport containment',async({page})=>{
 async function controls(){for(const control of await page.locator('input:visible,select:visible').all()){expect(await control.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);}expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:390,height:844});await page.goto('/violet-dineros/index.html');await controls();await start(page);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByLabel('First name',{exact:true})).toBeFocused();
 for(const height of [844,400]){await page.setViewportSize({width:320,height});await controls();}
 await expect(page.locator('#edit-starting-balance .navigation-chevron svg')).toHaveCSS('width','24px');await expect(page.locator('#settings-back')).toHaveCSS('width','50px');
 await page.locator('#edit-starting-balance').click();await controls();await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('#settings-back').click();
 await page.getByRole('button',{name:'Add Expense',exact:true}).click();await controls();await page.getByRole('button',{name:'Cancel',exact:true}).click();await goals(page);await page.getByRole('button',{name:'Create Goal',exact:true}).click();await controls();
 await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content','width=device-width, initial-scale=1, viewport-fit=cover');expect(await saved(page)).toEqual(seed);
});
