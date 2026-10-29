import {test,expect} from '@playwright/test';
for(const theme of ['light','dark']) test(`floating actions and Settings in ${theme}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const raw=JSON.stringify({firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true});
  await page.addInitScript(({raw,theme})=>{localStorage.setItem('lando-world:lwvd:v1',raw);localStorage.setItem('landos_world_appearance_preference_v1',theme);},{raw,theme});
  await page.goto('/violet-dineros/index.html');
  const toggle=page.getByRole('button',{name:'Quick actions',exact:true}), menu=page.locator('#quick-actions-menu'), nav=page.getByRole('navigation');
  await expect(toggle).toBeVisible(); await expect(page.getByRole('heading',{name:'Quick Actions'})).toHaveCount(0);
  const box=await toggle.boundingBox(), pill=await nav.boundingBox();expect(box.y+box.height).toBeLessThan(pill.y);expect(box.x+box.width).toBeLessThanOrEqual(390);
  await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(menu).toBeVisible();
  await page.waitForTimeout(220);expect(await toggle.boundingBox()).toEqual(box);
  expect(await toggle.locator('span').evaluate(e=>getComputedStyle(e).transform)).not.toBe('none');
  await page.screenshot({path:`test-results/floating-${theme}-${test.info().project.name}.png`});
  await page.locator('h1').click();await expect(toggle).toHaveAttribute('aria-expanded','false');
  await toggle.click();await toggle.press('Escape');await expect(toggle).toBeFocused();await expect(toggle).toHaveAttribute('aria-expanded','false');
  for(const label of ['Add Money','Add Expense','Can I Afford This?']){
    await toggle.click();await menu.getByRole('button',{name:label,exact:true}).click();await expect(toggle).toBeHidden();
    if(label==='Can I Afford This?'){await expect(page.locator('#afford-price')).toBeFocused();await page.locator('#afford-back').click();}
    else{await expect(page.getByLabel('How much?',{exact:true})).toBeFocused();await page.getByRole('button',{name:'Close',exact:true}).click();}
    await expect(toggle).toBeVisible();await expect(toggle).toHaveAttribute('aria-expanded','false');
  }
  for(const label of ['Activity','Goals','Insights','Home']){await toggle.click();await nav.getByRole('button',{name:label,exact:true}).click();await expect(toggle).toBeVisible();await expect(toggle).toHaveAttribute('aria-expanded','false');}
  await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(nav).toBeHidden();await expect(toggle).toBeHidden();
  await expect(page.getByRole('button',{name:'Back to Home',exact:true})).toHaveCount(1);
  const save=page.getByRole('button',{name:'Save Settings'}), form=page.locator('.settings-panel form');expect((await save.boundingBox()).width).toBeCloseTo((await form.boundingBox()).width,0);
  await page.getByLabel('First name').focus();await page.setViewportSize({width:390,height:420});await save.scrollIntoViewIfNeeded();await expect(save).toBeInViewport();
  await page.screenshot({path:`test-results/settings-${theme}-${test.info().project.name}.png`});
  await page.getByRole('button',{name:'Back to Home',exact:true}).click();await expect(nav).toBeVisible();
  await page.emulateMedia({reducedMotion:'reduce'});await toggle.click();expect(await toggle.locator('span').evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
  expect(await page.evaluate(()=>localStorage.getItem('lando-world:lwvd:v1'))).toBe(raw);
});
