import { test, expect } from '@playwright/test';
for (const theme of ['dark','light']) {
  test(`floating controls, bottom clearance and actions in ${theme}`, async ({page}, info) => {
    await page.emulateMedia({colorScheme:theme});
    await page.goto('/#/maintenance-total');
    const root=page.locator('#maintenance-total-root');
    const nav=root.locator('.imt_bottom_nav');
    const add=root.getByRole('button',{name:'Add',exact:true});
    for (const width of [320,390,430,1280]) {
      await page.setViewportSize({width,height:844});
      const shell=await page.locator('#maintenance-total-view').boundingBox();
      const n=await nav.boundingBox(), a=await add.boundingBox();
      expect(n.x).toBeCloseTo(shell.x+16,0);
      expect(n.width).toBe(shell.width-32);
      expect(a.x+a.width).toBeCloseTo(n.x+n.width,0);
      expect(a.y+a.height+12).toBeCloseTo(n.y,0);
      expect(n.y+n.height).toBeLessThanOrEqual(844-12);
      expect(await nav.getByRole('button').count()).toBe(4);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
      expect((await nav.boundingBox()).y).toBeCloseTo(n.y,0);
      expect((await add.boundingBox()).y).toBeCloseTo(a.y,0);
      const last=await root.locator('[data-bike]').last().boundingBox();
      expect(last.y+last.height).toBeLessThan(a.y);
      await page.evaluate(()=>scrollTo(0,0));
      if(width===1280) await page.screenshot({path:info.outputPath(`${theme}-desktop.png`)});
    }
    await page.setViewportSize({width:390,height:844});
    await expect(nav.locator('.is-active')).toHaveCSS('background-color',theme==='dark'?'rgb(42, 44, 48)':'rgb(229, 231, 235)');
    await page.screenshot({path:info.outputPath(`${theme}-home.png`)});
    for (const [label,heading] of [['History','Maintenance History'],['Assets','Assets & Categories'],['More','More'],['Home','iMaintenanceTotal']]) {
      await nav.getByRole('button',{name:label,exact:true}).click();
      await expect(root.getByRole('heading',{name:heading,exact:true})).toBeVisible();
      await expect(nav.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-current','page');
    }
    await add.click();
    await expect(root.getByRole('heading',{name:'Add Maintenance Record'})).toBeVisible();
    await expect(root.getByLabel('Asset *',{exact:true})).toHaveValue('');
    await root.getByLabel('Notes',{exact:true}).fill('Scroll clearance check');
    await page.evaluate(()=>document.activeElement.blur());
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
    const save=root.getByRole('button',{name:'Save',exact:true});
    const s=await save.boundingBox(), a=await add.boundingBox();
    expect(s.y+s.height).toBeLessThan(a.y);
    await expect(save).toBeInViewport();
    await page.screenshot({path:info.outputPath(`${theme}-form-bottom.png`)});
    await save.click();
    await expect(root.locator('form')).toBeVisible();
    expect(await page.evaluate(()=>localStorage.getItem('lando-world:maintenance-total:v1'))).toBeNull();
    await page.evaluate(theme=>window.LandosTheme.setPreference(theme),theme);
    await page.emulateMedia({colorScheme:theme==='dark'?'light':'dark'});
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await page.evaluate(()=>window.LandosTheme.setPreference('system'));
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='dark'?'light':'dark');
  });
}
