import { test, expect } from '@playwright/test';
test('phone shell, themes, navigation and long forms', async ({page}, info) => {
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/#/maintenance-total');
  const view=page.locator('#maintenance-total-view');
  const root=page.locator('#maintenance-total-root');
  for (const width of [320,390,430,1280]) {
    await page.setViewportSize({width,height:844});
    await expect(view).toBeVisible();
    const bounds=await view.boundingBox();
    expect(bounds.width).toBe(Math.min(width,430));
    expect(Math.abs(bounds.x-(width-bounds.width)/2)).toBeLessThan(1);
    const nav=await root.locator('.imt_bottom_nav').boundingBox();
    expect(nav.width).toBe(bounds.width - 32);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const label of ['Home','History','Assets','More']) await expect(root.locator('.imt_nav_label',{hasText:label})).toBeVisible();
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('dark-home.png'),fullPage:true});
  await root.getByRole('button',{name:'Add',exact:true}).click();
  const add = root.locator('[data-imt-nav="add"]');
  await expect(add.locator('circle')).toHaveCount(0);
  await expect(add.locator('.imt_nav_icon')).toHaveCSS('width','24px');
  await expect(add).toHaveCSS('color','rgb(8, 9, 11)');
  const assertBack = async () => {
    const back = root.locator('.imt_back');
    await expect(back).toHaveCSS('text-align','left');
    const button = await back.boundingBox();
    const heading = await root.locator('.imt_header h1').boundingBox();
    expect(Math.abs(button.x-heading.x)).toBeLessThan(1);
  };
  await assertBack();
  await root.getByLabel('Notes',{exact:true}).fill('Keyboard and scrolling check');
  await root.getByRole('button',{name:'Save',exact:true}).scrollIntoViewIfNeeded();
  const save=await root.getByRole('button',{name:'Save',exact:true}).boundingBox();
  const nav=await root.locator('.imt_bottom_nav').boundingBox();
  expect(save.y+save.height).toBeLessThanOrEqual(nav.y);
  await page.screenshot({path:info.outputPath('dark-form.png'),fullPage:true});
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(view).toHaveCSS('color','rgb(21, 35, 56)');
  await assertBack();
  await root.locator('.imt_back').click();
  await expect(root.locator('form')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('light-form.png'),fullPage:true});
});
