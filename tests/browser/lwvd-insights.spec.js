import {test,expect} from '@playwright/test';
const key='lando-world:lwvd:v1';
const seed={onboarded:true,firstName:'Violet',balanceCents:20000,payday:'2026-10-30',frequency:'weekly',transactions:[['a','Food',250,'2026-10-23'],['b','Shopping',750,'2026-10-25'],['c','Fun',500,'2026-09-30']].map(([id,label,amountCents,date])=>({id,type:'expense',label,amountCents,description:'',createdAt:date+'T12:00:00'}))};
async function start(page,data=seed){await page.clock.install({time:new Date('2026-10-25T16:00:00')});await page.addInitScript(({key,data})=>{if(!sessionStorage.getItem('seed')){localStorage.setItem(key,JSON.stringify(data));sessionStorage.setItem('seed','yes');}},{key,data});await page.goto('/violet-dineros/index.html');await page.getByRole('button',{name:'Insights',exact:true}).click();}
test('shared filters, accessible chart and independent read-only what-if',async({page})=>{
 await start(page);const before=await page.evaluate(key=>localStorage.getItem(key),key);
 await expect(page.locator('h1')).toBeFocused();await expect(page.locator('.chart-total')).toContainText('$10.00');await expect(page.locator('.your-insight')).toContainText('Shopping');
 await page.getByLabel('Purchase amount ($)',{exact:true}).fill('2.50');await expect(page.locator('#small-result')).toContainText('$130.00');await page.getByLabel('How often?').selectOption('daily');await expect(page.locator('#small-result')).toContainText('$912.50');
 for(const [label,total] of [['All Time','$15.00'],['This Month','$10.00'],['Budget Period','$10.00']]){await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('.chart-total')).toContainText(total);await expect(page.locator('#small-result')).toContainText('$912.50');}
 await page.getByLabel('Purchase amount ($)',{exact:true}).fill('-5');await expect(page.locator('#small-result')).toContainText('positive amount');
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(before);
});
test('missing schedule, no expenses, one expense, ties and refresh',async({page})=>{
 await start(page,{...seed,payday:'',frequency:'',transactions:[]});await expect(page.locator('#spending-report')).toContainText('Budget period unavailable');await page.getByRole('button',{name:'This Month',exact:true}).click();await expect(page.locator('#spending-report')).toContainText('No spending to show yet');
 for(const [transactions,text] of [[seed.transactions.slice(0,1),'One purchase'],[[seed.transactions[0],{...seed.transactions[1],amountCents:250}],'tied']]){await page.evaluate(({key,transactions})=>{const s=JSON.parse(localStorage.getItem(key));localStorage.setItem(key,JSON.stringify({...s,transactions}));},{key,transactions});await page.reload();await page.getByRole('button',{name:'Insights',exact:true}).click();await page.getByRole('button',{name:'All Time',exact:true}).click();await expect(page.locator('.your-insight')).toContainText(text);}
});
for(const theme of ['light','dark'])test(`${theme} narrow layouts, tap targets, input focus, scroll and input sizing`,async({page},info)=>{
 await start(page);await page.evaluate(theme=>window.LandosTheme?.setPreference?.(theme),theme);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('[data-period=month]').evaluate(e=>getComputedStyle(e).borderBottomColor)).toBe('rgba(0, 0, 0, 0)');
 expect(await page.locator('.insight-filters').evaluate(e=>getComputedStyle(e).justifyContent)).toBe('space-evenly');
 for(const b of await page.locator('[data-period]').all()){const rect=await b.boundingBox();expect(rect.height).toBeGreaterThanOrEqual(44);}
 await expect(page.locator('.spending-chart')).toBeInViewport();await page.getByLabel('Purchase amount ($)',{exact:true}).fill('3');await expect(page.getByLabel('Purchase amount ($)',{exact:true})).toBeFocused();expect(await page.locator('#small-amount').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
 await page.locator('#small-hint').scrollIntoViewIfNeeded();await expect(page.locator('#small-hint')).toBeInViewport();await expect(page.locator('nav')).toBeInViewport();
 await page.screenshot({path:info.outputPath(`insights-${theme}-${width}.png`),fullPage:true});
 }
});

test('calculator remains usable with large text and a keyboard-sized viewport',async({page})=>{
 await start(page);await page.setViewportSize({width:320,height:360});await page.addStyleTag({content:':root{font-size:20px}'});
 const input=page.getByLabel('Purchase amount ($)',{exact:true});await input.click();await input.fill('4');await expect(input).toBeInViewport();
 await page.getByLabel('How often?').selectOption('monthly');await page.locator('#small-result').scrollIntoViewIfNeeded();await expect(page.locator('#small-result')).toContainText('$48.00');await expect(page.locator('#small-result')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
