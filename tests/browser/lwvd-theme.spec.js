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

for (const theme of ['dark', 'light']) test(`LWVD ${theme}: standalone viewport policy and visible footer gap match the launcher`, async ({page}) => {
 await page.setViewportSize({width:390,height:844});await seed(page,theme);
 await page.goto('/violet-dineros/index.html');
 const reference=await page.evaluate(async()=>{
  const html=await (await fetch('../index.html')).text();
  return new DOMParser().parseFromString(html,'text/html').querySelector('meta[name=viewport]').content;
 });
 await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content',reference);
 // Activate the shipped standalone rules; desktop WebKit cannot install an iOS PWA.
 await page.evaluate(()=>{
  for(const sheet of document.styleSheets) for(const rule of sheet.cssRules){
   if(rule.conditionText==='(display-mode: standalone)')rule.media.mediaText='all';
  }
 });
 const before=await page.evaluate(()=>localStorage.getItem('lando-world:lwvd:v1'));
 for(const height of [568,844,932]){
  await page.setViewportSize({width:390,height});
  for(const name of ['Home','Activity','Goals','Insights']){
   await page.locator('nav').getByRole('button',{name,exact:true}).click();
   for(const fraction of [0,1]){
    await page.evaluate(fraction=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*fraction,behavior:'instant'});},fraction);
    const geometry=await page.evaluate(()=>{
     const nav=document.querySelector('nav'),r=nav.getBoundingClientRect(),v=visualViewport;
     const probe=document.createElement('div');probe.style.paddingBottom='env(safe-area-inset-bottom)';document.body.append(probe);
     const safe=parseFloat(getComputedStyle(probe).paddingBottom);probe.remove();
     const parents=[];for(let el=nav.parentElement;el;el=el.parentElement)parents.push(getComputedStyle(el).transform);
     return {gap:(v.offsetTop+v.height)-r.bottom,safe,parents,width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(geometry.gap).toBeCloseTo(12+geometry.safe,1);expect(geometry.width).toBe(358);expect(geometry.height).toBe(68);
    expect(geometry.parents.every(value=>value==='none')).toBe(true);expect(geometry.overflow).toBe(false);
   }
  }
 }
 expect(await page.evaluate(()=>localStorage.getItem('lando-world:lwvd:v1'))).toBe(before);
 await page.screenshot({path:test.info().outputPath(`lwvd-standalone-${theme}.png`)});
});

for(const [preference,device,theme] of [['light','dark','light'],['dark','light','dark'],['system','light','light'],['system','dark','dark']]){
 test(`original LWVD nav palette: ${preference} on ${device}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:device});await seed(page,preference);
  await page.goto('/violet-dineros/index.html');
  const nav=page.locator('nav');
  const expected=theme==='dark'?{surface:'rgb(23, 19, 31)',border:'rgb(56, 48, 64)',inactive:'rgb(189, 176, 213)',active:'rgb(194, 155, 255)',selected:'rgb(52, 39, 68)'}:{surface:'rgb(255, 255, 255)',border:'rgb(235, 230, 245)',inactive:'rgb(102, 96, 164)',active:'rgb(107, 29, 255)',selected:'rgb(240, 234, 255)'};
  const before=await page.evaluate(()=>localStorage.getItem('lando-world:lwvd:v1'));
  await expect(nav).toHaveCSS('background-color',expected.surface);await expect(nav).toHaveCSS('border-top-color',expected.border);
  for(const name of ['Activity','Goals','Insights','Home']){
   await nav.getByRole('button',{name,exact:true}).click();
   const active=nav.locator('[aria-current=page]');await expect(active).toHaveAccessibleName(name);
   await expect(active).toHaveCSS('color',expected.active);await expect(active.locator('svg')).toHaveCSS('color',expected.active);
   await expect(active).toHaveCSS('background-color',expected.selected);
   for(const inactive of await nav.locator('button:not([aria-current])').all()){
    await expect(inactive).toHaveCSS('color',expected.inactive);await expect(inactive.locator('svg')).toHaveCSS('color',expected.inactive);
   }
   const r=await nav.boundingBox();expect(r).toEqual({x:16,y:764,width:358,height:68});
  }
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content','width=device-width, initial-scale=1');
  expect(await page.evaluate(()=>localStorage.getItem('lando-world:lwvd:v1'))).toBe(before);
  await page.screenshot({path:test.info().outputPath(`lwvd-original-${preference}-${device}.png`)});
 });
}
