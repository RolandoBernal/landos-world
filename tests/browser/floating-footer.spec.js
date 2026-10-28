import {test,expect} from '@playwright/test';
import {createIPhoneDevServer} from '../../scripts/dev-iphone.mjs';
let server,baseURL;
test.beforeAll(async()=>{
 server=createIPhoneDevServer({bindAddress:{address:'127.0.0.1',netmask:'255.0.0.0'},getMetadata:async()=>({environment:'local-device',appVersion:'1.0.0',branch:'feature/llt-lwvd-floating-footer',commit:'test',commitFull:'test',dirty:true,sourceId:'footer-test'})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 baseURL=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{if(server?.listening)await new Promise(resolve=>server.close(resolve));});
for (const app of ['llt','lwvd']) for (const theme of ['dark','light','system']) {
 test(`${app} ${theme}: pill geometry, navigation and bottom clearance`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({colorScheme:'dark'});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.addInitScript(({theme})=>{
   localStorage.setItem('landos_world_appearance_preference_v1',theme);
   localStorage.setItem('lando-world:lwvd:v1',JSON.stringify({firstName:'Max',balanceCents:42800,payday:'2099-01-31',frequency:'monthly',onboarded:true}));
   localStorage.setItem('lando-world:lee-lees-tracker:v1',JSON.stringify({schemaVersion:1,records:[],settings:{glucoseTargetMin:70,glucoseTargetMax:180},insulinPlans:[],foodLibrary:[],savedMeals:[],metadata:{}}));
  },{theme});
  await page.goto(baseURL+(app==='llt'?'/#/lee-lees-tracker':'/violet-dineros/index.html'));
  const nav=page.locator(app==='llt'?'.lee_lee_diabetes_bottom_nav':'nav');
  await expect(nav).toBeVisible();
  const names=app==='llt'?['Today','History','Log Entry','Reports','Foods']:['Home','Activity','Goals','Insights'];
  await expect(nav.getByRole('button')).toHaveCount(names.length);
  if(app==='llt') expect(await nav.getByRole('button').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-label')))).toEqual(names);
  for(const name of names){
   if(name==='Log Entry') await expect(nav.getByRole('button').nth(2)).toHaveAccessibleName('Log Entry');
   await nav.getByRole('button',{name,exact:true}).click();
   if(name==='Log Entry'){
    await expect(page.locator('#lee-lee-diabetes-root [name="type"]')).toBeVisible();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
   }else await expect(nav.getByRole('button',{name,exact:true})).toHaveAttribute('aria-current','page');
  }
  const metrics=await nav.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),p=getComputedStyle(el,'::before');return {x:r.x,y:r.y,width:r.width,bottom:r.bottom,height:r.height,radius:s.borderRadius,bg:s.backgroundColor,scrimTop:p.top,scrimPointer:p.pointerEvents,buttons:[...el.querySelectorAll('button')].map(b=>{const q=b.getBoundingClientRect();return {x:q.x,y:q.y,right:q.right,bottom:q.bottom};})};});
  expect(metrics.width).toBe(app==='llt'?342:358);expect(metrics.radius).toBe('36px');expect(metrics.height).toBe(68);
  expect(metrics.x).toBe(app==='llt'?24:16);
  expect(metrics.bottom).toBe(app==='llt'?828:832);expect(metrics.scrimTop).toBe('-1px');expect(metrics.scrimPointer).toBe('none');
  expect(metrics.bg).toBe(theme==='light'?'rgb(255, 255, 255)':'rgb(23, 25, 28)');
  if(app==='llt'){
   const plus=nav.getByRole('button',{name:'Log Entry',exact:true});
   const today=nav.getByRole('button',{name:'Today',exact:true});
   await expect(plus).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
   for(const property of ['color','border-radius','padding','gap','align-items','justify-content']){
    await expect(plus).toHaveCSS(property,await today.evaluate((el,property)=>getComputedStyle(el).getPropertyValue(property),property));
   }
   await expect(plus.locator('svg')).toHaveCSS('color',await today.locator('svg').evaluate(el=>getComputedStyle(el).color));
   await expect(plus.locator('.lee_lee_diabetes_sr_only')).toBeVisible();
  }
  for(const b of metrics.buttons){expect(b.x).toBeGreaterThan(metrics.x);expect(b.y).toBeGreaterThan(metrics.y);expect(b.bottom).toBeLessThan(metrics.bottom);}
  for(const width of [320,430,1024]){
   await page.setViewportSize({width,height:844});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(app==='llt'){
    const boxes=await nav.getByRole('button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right};}));
    for(let i=1;i<boxes.length;i++) expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i-1].right);
    const layout=await nav.getByRole('button').evaluateAll(buttons=>buttons.map(b=>{
     const rect=b.getBoundingClientRect(),icon=b.querySelector('svg').getBoundingClientRect(),label=b.querySelector('.lee_lee_diabetes_sr_only').getBoundingClientRect();
     return {width:rect.width,height:rect.height,iconWidth:icon.width,iconHeight:icon.height,iconBottom:icon.bottom,labelTop:label.top,iconCenter:icon.x+icon.width/2,labelCenter:label.x+label.width/2};
    }));
    for(const item of layout){expect(item.width).toBeGreaterThanOrEqual(44);expect(item.height).toBeGreaterThanOrEqual(44);expect(item.labelTop).toBeGreaterThan(item.iconBottom);expect(Math.abs(item.iconCenter-item.labelCenter)).toBeLessThan(1);expect(item.iconWidth).toBe(24);expect(item.iconHeight).toBe(24);}
    expect(Math.abs(layout[2].width-layout[0].width)).toBeLessThan(1);

   }
  }
  await page.setViewportSize({width:390,height:600});
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});});
  const clearance=await page.evaluate(app=>{const shell=document.querySelector(app==='llt'?'.lee_lee_diabetes_shell':'.shell');return parseFloat(getComputedStyle(shell).paddingBottom);},app);
  expect(clearance).toBeGreaterThanOrEqual(110);
  if(app==='llt'){
   const bottom=await page.evaluate(()=>{
    const nav=document.querySelector('.lee_lee_diabetes_bottom_nav');
    const controls=[...document.querySelectorAll('#lee-lee-diabetes-root button, #lee-lee-diabetes-root input')].filter(el=>!el.closest('nav')&&el.checkVisibility());
    return {navTop:nav.getBoundingClientRect().top,lastControlBottom:Math.max(...controls.map(el=>el.getBoundingClientRect().bottom))};
   });
   expect(bottom.lastControlBottom).toBeLessThan(bottom.navTop);
  }
  await page.screenshot({path:test.info().outputPath(`${app}-${theme}.png`),fullPage:true});
 });
}
