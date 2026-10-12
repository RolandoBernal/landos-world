import { test, expect } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';
let server, url;
const fixtureKey = 'lando-world:llt-sensor-fixture:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: {address:'127.0.0.1',netmask:'255.0.0.0'}, getMetadata:async()=>({environment:'local-device',appVersion:'test',branch:'feature/llt-issues-15-16',commit:'test',commitFull:'test',dirty:true,sourceId:'sensor-history-test'}) });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); url = `http://127.0.0.1:${server.address().port}/#/lee-lees-tracker`;
});
test.afterAll(async()=>{ if(server?.listening) await new Promise(resolve=>server.close(resolve)); });
async function seed(page, historical = 2) {
  await page.addInitScript(({key,historical}) => {
    const uid='local-sensor-fixture', now=Date.now(), H=3600000;
    const cycle=(id,start,state,end=null)=>({id,user_id:uid,sensor_type:'dexcom_g7_10d_v1',started_at:new Date(start).toISOString(),ended_at:end?new Date(end).toISOString():null,state,cancelled_at:null,previous_cycle_id:null,revision:1});
    const cycles=[]; if(historical>=0) cycles.push(cycle(crypto.randomUUID(),now-H,'current'));
    for(let i=0;i<historical;i++) {
      const start=now-(i+1)*12*24*H, c=cycle(crypto.randomUUID(),start,'closed',start+(i%2?240:48)*H);
      if(i===0) Object.assign(c,{replacement_reason_id:'fell_off',replacement_notes:'Synthetic adhesive note <script>bad()</script>',replacement_requested:false});
      if(i===1) Object.assign(c,{replacement_reason_id:'normal_expiration'});
      cycles.push(c);
    }
    localStorage.setItem(key,JSON.stringify({revision:historical>=0?1:0,currentCycleId:cycles[0]?.id||null,cycles}));
  },{key:fixtureKey,historical});
  await page.goto(url); await expect(page.locator('[data-dexcom-card]')).toBeVisible();
}
async function history(page) {
  const disclosure=page.locator('.llt_sensor_disclosure').first();
  if(await disclosure.count()) await disclosure.click();
  await page.locator('.llt_sensor_card [data-sensor-action=history]').click();
  await expect(page.getByRole('heading',{name:'All Sensors',exact:true})).toBeVisible();
}
for(const historical of [-1,0,2,25,105]) test(`bounded sensor history with ${historical < 0 ? 0 : historical + 1} records`,async({page})=>{
  await seed(page,historical); await expect(page.locator('.llt_sensor_card .llt_sensor_history')).toHaveCount(0);
  await history(page); const total=Math.max(0,historical+1);
  await expect(page.locator('[data-sensor-results] > button')).toHaveCount(Math.min(25,total));
  await expect(page.locator('[data-sensor-count]')).toHaveText(`${Math.min(25,total)} of ${total} sensors`);
  if(total>25) { await page.getByRole('button',{name:'Load More',exact:true}).click(); await expect(page.locator('[data-sensor-results] > button')).toHaveCount(Math.min(50,total)); }
  if(total) {
    await page.locator('[data-sensor-results] > button').first().click();
    await expect(page.getByRole('heading',{name:'Sensor Details',exact:true})).toBeVisible();
    await expect(page.locator('.llt_sensor_dialog')).toContainText('Active');
    await expect(page.locator('.llt_sensor_dialog')).not.toContainText('Actual Replacement');
    await expect(page.locator('.llt_sensor_dialog')).not.toContainText('Actual Duration');
    await expect(page.getByRole('button',{name:'Edit Replacement Metadata',exact:true})).toHaveCount(0);
  }
});
test('combined search/filter, legacy unknowns, escaped notes, and preserved list position at mobile widths',async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:740}); await seed(page,105); await history(page);
  const filter=page.locator('[data-sensor-filter]'), search=page.locator('[data-sensor-search]');
  await filter.selectOption('Sensor Issues'); await expect(page.locator('[data-sensor-results] > button')).toHaveCount(1);
  await search.fill('ADHESIVE'); await expect(page.locator('[data-sensor-results] > button')).toHaveCount(1);
  await filter.selectOption('Completed'); await expect(page.locator('[data-sensor-results] > button')).toHaveCount(0);
  await filter.selectOption('Replaced Early'); await page.locator('[data-sensor-results] > button').click();
  await expect(page.locator('.llt_sensor_dialog')).toContainText('Sensor Fell Off');
  await expect(page.locator('.llt_sensor_dialog')).toContainText('Replacement Requested: No');
  await expect(page.locator('.llt_sensor_notes')).toHaveText('Synthetic adhesive note <script>bad()</script>');
  await expect(page.locator('.llt_sensor_notes script')).toHaveCount(0);
  await page.getByRole('button',{name:'← All Sensors',exact:true}).click();
  await expect(search).toHaveValue('ADHESIVE'); await expect(filter).toHaveValue('Replaced Early');
  await search.fill(''); await filter.selectOption('All'); await page.getByRole('button',{name:'Load More'}).click();
  await page.locator('.llt_sensor_dialog').evaluate(d=>d.scrollTop=500);
  const scroll=await page.locator('.llt_sensor_dialog').evaluate(d=>d.scrollTop);
  await page.locator('[data-sensor-results] > button').nth(3).click();
  await expect(page.locator('.llt_sensor_dialog')).toContainText('Reason Not Recorded');
  await expect(page.locator('.llt_sensor_dialog')).toContainText('No Notes Recorded');
  await expect(page.locator('.llt_sensor_dialog')).toContainText('Replacement Requested: Not Recorded');
  await page.getByRole('button',{name:'← All Sensors',exact:true}).click();
  await expect(page.locator('[data-sensor-results] > button')).toHaveCount(50);
  expect(await page.locator('.llt_sensor_dialog').evaluate(d=>d.scrollTop)).toBeCloseTo(scroll,0);
  for(const width of [320,393,768,1280]) {
    await page.setViewportSize({width,height:740});
    expect(await page.locator('.llt_sensor_dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1 && d.getBoundingClientRect().width<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:testInfo.outputPath('all-sensors.png')});
});
test('historical metadata edit persists and refetches across tabs, conflicts fail closed, and cancelled is read-only',async({page,context})=>{
  await seed(page); await history(page); await page.locator('[data-sensor-results] > button').nth(1).click();
  await page.getByRole('button',{name:'Edit Replacement Metadata'}).click();
  await page.getByLabel('Replacement Reason (optional)',{exact:true}).selectOption('signal_loss');
  await page.getByLabel('Replacement Notes',{exact:true}).fill('Updated synthetic note');
  await page.getByLabel('Replacement Requested from Dexcom',{exact:true}).selectOption('true');
  await page.getByRole('button',{name:'Save Replacement Metadata'}).click();
  await expect(page.getByRole('heading',{name:'Sensor Details',exact:true})).toBeVisible();
  await expect(page.locator('.llt_sensor_dialog')).toContainText('Signal Loss');
  const second=await context.newPage(); await second.goto(url);
  await history(second); await second.locator('[data-sensor-results] > button').nth(1).click();
  await expect(second.locator('.llt_sensor_dialog')).toContainText('Updated synthetic note');
  await second.getByRole('button',{name:'Edit Replacement Metadata'}).click();
  await page.getByRole('button',{name:'Edit Replacement Metadata'}).click();
  await page.getByLabel('Replacement Notes',{exact:true}).fill('Newer synthetic note');
  await page.getByRole('button',{name:'Save Replacement Metadata'}).click();
  await second.getByLabel('Replacement Notes',{exact:true}).fill('Stale edit');
  await second.getByRole('button',{name:'Save Replacement Metadata'}).click();
  await expect(second.locator('[data-sensor-error]')).toContainText('changed');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.locator('.llt_sensor_card [data-sensor-action=details]').click();
  await page.locator('.llt_sensor_manage summary').click();
  await page.getByRole('button',{name:'Undo Current Sensor',exact:true}).click();
  await page.getByRole('button',{name:'Undo Current Sensor',exact:true}).click();
  await page.locator('.llt_sensor_dialog [data-sensor-action=history]').click();
  await page.locator('[data-sensor-filter]').selectOption('Cancelled');
  await page.locator('[data-sensor-results] > button').click();
  await expect(page.getByRole('button',{name:'Edit Replacement Metadata'})).toHaveCount(0);
  await second.close();
});
test('replacement metadata belongs to previous cycle, optional fields never block replacement',async({page})=>{
  await seed(page,0);
  await page.locator('.llt_sensor_disclosure').click();
  await page.locator('.llt_sensor_card [data-sensor-action=start]').click();
  await page.getByLabel('Sensor Code',{exact:true}).fill('0042');
  await page.getByLabel('Replacement Reason (optional)',{exact:true}).selectOption('sensor_failed');
  await page.getByLabel('Replacement Notes',{exact:true}).fill('Synthetic replacement');
  await page.getByLabel('Replacement Requested from Dexcom',{exact:true}).selectOption('false');
  await page.getByRole('button',{name:'Review New Sensor'}).click();
  await page.getByRole('button',{name:'Save Sensor Change'}).click();
  await expect(page.locator('.llt_sensor_card strong')).toContainText('0042');
  const snapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),fixtureKey);
  const active=snapshot.cycles.find(c=>c.state==='current'),closed=snapshot.cycles.find(c=>c.state==='closed');
  expect(active.sensor_code).toBe('0042'); expect(active.replacement_notes).toBeUndefined();
  expect(closed.replacement_notes).toBe('Synthetic replacement'); expect(closed.replacement_requested).toBe(false);
  expect(closed.ended_at).toBe(active.started_at);
});

test('metadata notes enforce the 2000-character limit without changing stored data on invalid save',async({page})=>{
  await page.setViewportSize({width:320,height:740}); await seed(page); await history(page);
  await page.locator('[data-sensor-results] > button').nth(1).click();
  await page.getByRole('button',{name:'Edit Replacement Metadata'}).click();
  const original=await page.evaluate(key=>localStorage.getItem(key),fixtureKey);
  await page.getByLabel('Replacement Notes',{exact:true}).fill('x'.repeat(2001));
  await page.getByRole('button',{name:'Save Replacement Metadata'}).click();
  await expect(page.locator('[data-sensor-error]')).toContainText('2,000');
  expect(await page.evaluate(key=>localStorage.getItem(key),fixtureKey)).toBe(original);
  await page.getByLabel('Replacement Notes',{exact:true}).fill('😀'.repeat(2000));
  await page.getByLabel('Replacement Requested from Dexcom',{exact:true}).selectOption('');
  await page.getByRole('button',{name:'Save Replacement Metadata'}).click();
  await expect(page.getByRole('heading',{name:'Sensor Details',exact:true})).toBeVisible();
  await expect(page.locator('.llt_sensor_notes')).toHaveText('😀'.repeat(2000));
  await expect(page.locator('.llt_sensor_dialog')).toContainText('Replacement Requested: Not Recorded');
  expect(await page.locator('.llt_sensor_dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1)).toBe(true);
});
