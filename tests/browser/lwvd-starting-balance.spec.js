import { test, expect } from '@playwright/test';
const key = 'lando-world:lwvd:v1';
const launcherKey = 'landos_world_my_apps_v1';
const preferences = {schemaVersion:1,visibleAppIds:['digital-clock','violet-dineros'],appOrder:['digital-clock','violet-dineros','weather']};
async function setup(page, theme = 'light') {
  await page.setViewportSize({width:390,height:844});
  const date = new Date(); date.setDate(date.getDate() + 3);
  const payday = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const initial = {firstName:'Max',balanceCents:15000,payday,frequency:'monthly',onboarded:true};
  await page.addInitScript(({key,launcherKey,initial,preferences,theme}) => {
    if (!sessionStorage.getItem('starting-balance-seeded')) {
      localStorage.setItem(key,JSON.stringify(initial));
      localStorage.setItem(launcherKey,JSON.stringify(preferences));
      localStorage.setItem('lwvd-unrelated-test-data','unchanged');
      localStorage.setItem('landos_world_appearance_preference_v1',theme);
      sessionStorage.setItem('starting-balance-seeded','yes');
    }
    window.balanceWrites = 0;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name,value) { if (name === key) window.balanceWrites++; return setItem.call(this,name,value); };
  },{key,launcherKey,initial,preferences,theme});
  await page.goto('/violet-dineros/index.html');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.locator('#edit-starting-balance')).toContainText('$150.00');
  return initial;
}
async function openEditor(page) {
  await page.locator('#edit-starting-balance').click();
  await expect(page.getByRole('heading',{name:'Edit Starting Balance',exact:true})).toBeVisible();
  await expect(page.getByLabel('Starting Balance ($)',{exact:true})).toHaveValue('150.00');
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)),key);
for (const [amount,cents,guide] of [['180.00',18000,'$60.00'],['120.00',12000,'$40.00'],['0',0,'$0.00']]) {
  test(`replaces Starting Balance with ${amount}, recalculates and preserves Sprint 1 data`,async ({page})=>{
    const initial = await setup(page); await openEditor(page);
    await page.getByLabel('Starting Balance ($)',{exact:true}).fill(amount);
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await expect(page.locator('#edit-starting-balance')).toContainText((cents/100).toFixed(2));
    expect(await stored(page)).toEqual({...initial,balanceCents:cents});
    expect(await page.evaluate(()=>window.balanceWrites)).toBe(1);
    expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),launcherKey)).toEqual(preferences);
    expect(await page.evaluate(()=>localStorage.getItem('lwvd-unrelated-test-data'))).toBe('unchanged');
    await page.getByRole('button',{name:'Home',exact:true}).click();
    await expect(page.locator('.balance')).toHaveText(`$${(cents/100).toFixed(2)}`);
    await expect(page.locator('.guide')).toHaveText(`${guide} a day`);
    await page.reload(); await expect(page.locator('.balance')).toHaveText(`$${(cents/100).toFixed(2)}`);
    for (const tab of ['Activity','Goals','Insights','Home']) await page.getByRole('button',{name:tab,exact:true}).click();
    await expect(page.locator('.guide')).toHaveText(`${guide} a day`);
  });
}
test('invalid amounts are rejected without writing, then a corrected value saves',async ({page})=>{
  const initial = await setup(page); await openEditor(page);
  for (const amount of ['-1','abc','1.234','1e3','1,000','','$1']) {
    await page.getByLabel('Starting Balance ($)',{exact:true}).fill(amount);
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await expect(page.locator('#balance-error')).toContainText('zero or a positive dollar amount');
    await expect(page.getByLabel('Starting Balance ($)',{exact:true})).toHaveAttribute('aria-invalid','true');
    expect(await stored(page)).toEqual(initial);
  }
  expect(await page.evaluate(()=>window.balanceWrites)).toBe(0);
  await page.getByLabel('Starting Balance ($)',{exact:true}).fill('175.25');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  expect(await stored(page)).toEqual({...initial,balanceCents:17525});
});
test('unchanged save, Cancel, Back and tab navigation do not update the balance',async ({page})=>{
  const initial = await setup(page); await openEditor(page);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#edit-starting-balance')).toBeFocused();
  for (const button of ['Cancel','Back to Settings']) {
    await openEditor(page); await page.getByLabel('Starting Balance ($)',{exact:true}).fill('999');
    await page.getByRole('button',{name:button,exact:true}).click();
    expect(await stored(page)).toEqual(initial);
  }
  await openEditor(page);await page.getByLabel('Starting Balance ($)',{exact:true}).fill('999');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await expect(page.locator('.balance')).toHaveText('$150.00');
  expect(await page.evaluate(()=>window.balanceWrites)).toBe(0);
});
for (const theme of ['light','dark','system']) {
  test(`Starting Balance editor respects ${theme} theme and mobile geometry`,async ({page})=>{
    await page.emulateMedia({colorScheme:'dark'});await setup(page,theme);await openEditor(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='light'?'light':'dark');
    for (const width of [320,390,430]) {
      await page.setViewportSize({width,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      for (const name of ['Save','Cancel','Back to Settings']) {
        const box = await page.getByRole('button',{name,exact:true}).boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    if (theme==='system') { await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light'); }
  });
}
test('onboarding establishes the same Starting Balance shown and edited in Settings',async ({page})=>{
  await page.goto('/violet-dineros/index.html');
  await page.getByLabel('What’s your first name?').fill('Levi');await page.getByRole('button',{name:'Continue'}).click();
  await page.getByLabel('Your money ($)').fill('75.50');await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('button',{name:'Skip for now'}).click();await page.getByRole('button',{name:'Go to My Dashboard'}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('#edit-starting-balance')).toContainText('$75.50');
  await page.locator('#edit-starting-balance').click();await expect(page.getByLabel('Starting Balance ($)',{exact:true})).toHaveValue('75.50');
});
test('storage failure keeps the editor open and preserves saved information',async ({page})=>{
  const initial = await setup(page);await openEditor(page);
  await page.evaluate(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw Error('quota');return original.call(this,name,value);};},key);
  await page.getByLabel('Starting Balance ($)',{exact:true}).fill('180');await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#notice')).toContainText('could not be saved');
  await expect(page.getByRole('heading',{name:'Edit Starting Balance',exact:true})).toBeVisible();
  expect(await stored(page)).toEqual(initial);
});
