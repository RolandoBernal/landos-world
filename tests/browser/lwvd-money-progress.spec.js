import {test,expect} from '@playwright/test';
for (const theme of ['light','dark']) test(`compact Money Progress persists on narrow Home in ${theme}`,async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.addInitScript(theme=>{
    if (!localStorage.getItem('progress-test')) {
      localStorage.setItem('lando-world:lwvd:v1',JSON.stringify({firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true}));
      localStorage.setItem('progress-test','yes');
    }
    localStorage.setItem('landos_world_appearance_preference_v1',theme);
  },theme);
  await page.goto('/violet-dineros/index.html');
  const progress=page.getByRole('region',{name:'Money Progress'});
  await expect(progress).toContainText('Level 1 · Money Rookie');
  await expect(progress).toContainText('0 XP total');
  await expect(progress.locator('.progress-help')).toHaveText('Earn XP for tracking expenses and saving toward your goals. Small steps add up! ✨');
  await page.getByRole('button',{name:'Add Expense',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('How much?',{exact:true})).toBeFocused();
  await dialog.getByLabel('How much?',{exact:true}).fill('2');
  await dialog.getByLabel('Category',{exact:true}).selectOption('Food');
  await dialog.getByRole('button',{name:'Save Expense',exact:true}).click();
  await expect(progress).toContainText('10 XP total');
  await expect(progress).toContainText('1 of 3 completed');
  await expect(page.locator('.balance')).toHaveText('$98.00');
  await page.reload(); await expect(progress).toContainText('10 XP total');
  await progress.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/money-progress-${theme}-${test.info().project.name}.png`,fullPage:true});
});
