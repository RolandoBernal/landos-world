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
  for(const name of names){
   if(name==='Log Entry') await expect(nav.getByRole('button').nth(2)).toHaveAccessibleName('Log Entry');
   await nav.getByRole('button',{name,exact:true}).click();
   if(name==='Log Entry'){
    await expect(page.locator('#lee-lee-diabetes-root [name="type"]')).toBeVisible();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
   }else await expect(nav.getByRole('button',{name,exact:true})).toHaveAttribute('aria-current','page');
  }
  const metrics=await nav.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),p=getComputedStyle(el,'::before');return {x:r.x,y:r.y,width:r.width,bottom:r.bottom,height:r.height,radius:s.borderRadius,bg:s.backgroundColor,scrimTop:p.top,scrimPointer:p.pointerEvents,buttons:[...el.querySelectorAll('button')].map(b=>{const q=b.getBoundingClientRect();return {x:q.x,y:q.y,right:q.right,bottom:q.bottom};})};});
  expect(metrics.width).toBe(358);expect(metrics.radius).toBe('36px');expect(metrics.height).toBe(68);
  expect(metrics.bottom).toBeLessThanOrEqual(832);expect(metrics.scrimTop).toBe('-1px');expect(metrics.scrimPointer).toBe('none');
  expect(metrics.bg).toBe(theme==='light'?'rgb(255, 255, 255)':'rgb(23, 25, 28)');
  for(const b of metrics.buttons){expect(b.x).toBeGreaterThan(metrics.x);expect(b.y).toBeGreaterThan(metrics.y);expect(b.bottom).toBeLessThan(metrics.bottom);}
  for(const width of [320,430,1024]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:390,height:600});
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  const clearance=await page.evaluate(app=>{const shell=document.querySelector(app==='llt'?'.lee_lee_diabetes_shell':'.shell');return parseFloat(getComputedStyle(shell).paddingBottom);},app);
  expect(clearance).toBeGreaterThanOrEqual(110);
  await page.screenshot({path:test.info().outputPath(`${app}-${theme}.png`),fullPage:true});
 });
}
