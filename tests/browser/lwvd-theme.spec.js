import { test, expect } from '@playwright/test';
const appearanceKey = 'landos_world_appearance_preference_v1';
const moneyKey = 'lando-world:lwvd:v1';
const launcherKey = 'landos_world_my_apps_v1';
const financial = { firstName: 'Max', balanceCents: 42800, payday: '2099-01-31', frequency: 'monthly', onboarded: true };
const selection = { schemaVersion: 1, visibleAppIds: ['digital-clock', 'violet-dineros'], appOrder: ['digital-clock', 'violet-dineros', 'weather', 'lee-lees-tracker'] };
async function seed(page, preference, onboarded = true) {
  await page.addInitScript(({ appearanceKey, moneyKey, launcherKey, financial, selection, preference, onboarded }) => {
    if (!sessionStorage.getItem('lwvd-theme-seeded')) {
      localStorage.setItem(appearanceKey, preference);
      localStorage.setItem(launcherKey, JSON.stringify(selection));
      if (onboarded) localStorage.setItem(moneyKey, JSON.stringify(financial));
      sessionStorage.setItem('lwvd-theme-seeded', 'yes');
    }
    window.firstBodyTheme = null;
    new MutationObserver(() => {
      if (document.body && window.firstBodyTheme === null) window.firstBodyTheme = document.documentElement.dataset.theme;
    }).observe(document, { childList: true, subtree: true });
  }, {appearanceKey, moneyKey, launcherKey, financial, selection, preference, onboarded});
}
for (const [preference, device, expected] of [['light','dark','light'], ['dark','light','dark'], ['system','dark','dark'], ['system','light','light']]) {
  test(`LWVD ${preference} preference with ${device} device resolves before body paint`, async ({page}) => {
    await page.setViewportSize({width:390,height:844}); await page.emulateMedia({colorScheme:device}); await seed(page,preference);
    await page.goto('/violet-dineros/index.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme',expected);
    expect(await page.evaluate(() => window.firstBodyTheme)).toBe(expected);
    const before = await page.evaluate(({moneyKey,launcherKey}) => [localStorage.getItem(moneyKey),localStorage.getItem(launcherKey)],{moneyKey,launcherKey});
    await expect(page.getByRole('heading',{name:'Hey, Max!'})).toBeVisible();
    for (const name of ['Activity','Goals','Insights','Home']) { await page.getByRole('button',{name,exact:true}).click(); await expect(page.locator('main h1')).toBeVisible(); }
    await page.getByRole('button',{name:'Settings',exact:true}).click(); await expect(page.getByLabel('First name',{exact:true})).toHaveValue('Max');
    await page.locator('#settings-back').click();
    for (const width of [320,390,430]) { await page.setViewportSize({width,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
    await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme',expected);
    await page.getByRole('link',{name:"Return to Lando's World home"}).click(); await expect(page).toHaveURL(/\/index.html#\/$/);
    await page.locator('#open-violet-dineros').click();
    expect(await page.evaluate(({moneyKey,launcherKey}) => [localStorage.getItem(moneyKey),localStorage.getItem(launcherKey)],{moneyKey,launcherKey})).toEqual(before);
    expect(await page.evaluate(k => localStorage.getItem(k),appearanceKey)).toBe(preference);
  });
}
test('System follows live device changes and launcher preference is reused on next entry',async ({page})=>{
  await page.emulateMedia({colorScheme:'light'});await seed(page,'system');await page.goto('/violet-dineros/index.html');
  await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('link',{name:"Return to Lando's World home"}).click();
  await expect(page.locator('#open-violet-dineros')).toBeVisible();
  await page.evaluate(()=>window.LandosTheme.setPreference('dark'));
  await page.locator('#open-violet-dineros').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
for (const theme of ['light','dark']) {
  test(`onboarding completes and persists in ${theme}`,async ({page})=>{
    await page.setViewportSize({width:390,height:844});await seed(page,theme,false);await page.goto('/violet-dineros/index.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await page.getByLabel('What’s your first name?').fill('Levi');await page.getByRole('button',{name:'Continue'}).click();
    await page.getByLabel('Your money ($)').fill('150.25');await page.getByRole('button',{name:'Continue'}).click();
    await page.getByRole('button',{name:'Skip for now'}).click();await page.getByRole('button',{name:'Go to My Dashboard'}).click();
    await expect(page.getByRole('heading',{name:'Hey, Levi!'})).toBeVisible();await expect(page.locator('.balance')).toHaveText('$150.25');
    await page.reload();await expect(page.getByRole('heading',{name:'Hey, Levi!'})).toBeVisible();
  });
}

for (const tab of ['Home', 'Activity', 'Goals', 'Insights', 'Settings']) {
  test(`launcher return works from ${tab} without changing saved data`, async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await seed(page,'dark'); await page.goto('/violet-dineros/index.html');
    await page.getByRole('button',{name:tab,exact:true}).click();
    const back = page.getByRole('link',{name:"Return to Lando's World home"});
    await expect(back).toBeVisible(); await expect(back).toHaveAttribute('href','../index.html#/');
    await back.click(); await expect(page).toHaveURL(/\/index.html#\/$/);
    expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),moneyKey)).toEqual(financial);
    expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),launcherKey)).toEqual(selection);
  });
}
