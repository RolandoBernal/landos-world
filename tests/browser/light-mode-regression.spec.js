import { test, expect } from '@playwright/test';

const WEATHER_FIXTURE = {
  current: {
    temperature_2m: 78,
    weather_code: 1,
    time: '2026-08-13T10:00',
  },
  current_units: {
    temperature_2m: 'F',
  },
  hourly: {
    time: [
      '2026-08-13T06:00',
      '2026-08-13T12:00',
      '2026-08-13T18:00',
      '2026-08-14T06:00',
      '2026-08-14T12:00',
      '2026-08-14T18:00',
    ],
    temperature_2m: [70, 82, 79, 69, 84, 80],
    weather_code: [1, 1, 2, 2, 3, 2],
    precipitation_probability: [10, 20, 15, 5, 10, 20],
    wind_speed_10m: [5, 7, 6, 4, 6, 8],
  },
};

const theme = async (page, value) => {
  await page.evaluate(value => window.LandosTheme.setPreference(value), value);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
};
const styles = locator => locator.evaluate(el => {
  const s = getComputedStyle(el);
  return Object.fromEntries(['color','backgroundColor','backgroundImage','opacity','colorScheme','appearance','backgroundSize','backgroundRepeat'].map(k => [k,s[k]]));
});

for (const width of [320, 393, 430, 768, 1280]) {
  test(`light sweep switches themes without stale styles at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/geocoding-api\.open-meteo\.com/, route => route.fulfill({json:{results:[{name:'Nashville',admin1:'Tennessee',country_code:'US',latitude:36.16,longitude:-86.78,timezone:'America/Chicago'}]}}));
    await page.route(/api\.open-meteo\.com\/v1\/forecast/, route => route.fulfill({json:WEATHER_FIXTURE}));
    await page.goto('/#/weather');
    await page.getByRole('button', { name: 'Weather Settings', exact: true }).click();
    const buttons = page.locator('.weather_settings_button--primary');
    await theme(page, 'dark');
    await expect(buttons.first()).toBeEnabled();
    const weatherDark = await styles(buttons.first());
    await theme(page, 'light');
    for (const button of await buttons.all()) expect((await styles(button)).backgroundImage).toBe('linear-gradient(rgb(255, 229, 102), rgb(255, 212, 0))');
    await theme(page, 'dark');
    expect(await styles(buttons.first())).toEqual(weatherDark);

    await page.goto('/#/digital-clock');
    const clock = page.locator('#clock-view .digit_clock_time').first();
    await expect(clock.locator('.is-on').first()).toBeAttached();
    await theme(page, 'dark');
    const clockDark = await styles(clock);
    const cogDark = await styles(page.locator('#clock-view .digit_clock_menu_toggle'));
    await theme(page, 'light');
    expect((await styles(clock)).color).toBe('rgb(8, 122, 58)');
    expect((await styles(clock.locator('.ampm'))).color).toBe('rgb(8, 122, 58)');
    expect((await styles(clock.locator('.is-off').first())).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    const counts = await page.evaluate(() => {
      const host = document.createElement('div');
      host.className = 'digit_clock_time';
      host.innerHTML = Array.from({length:10}, (_, n) => renderSevenSegmentDigit(String(n))).join('');
      document.getElementById('clock-view').append(host);
      const result = [...host.children].map(digit => ({ on: digit.querySelectorAll('.is-on').length, visible: [...digit.querySelectorAll('.is-on')].every(s => getComputedStyle(s).backgroundColor === 'rgb(8, 122, 58)'), off: [...digit.querySelectorAll('.is-off')].every(s => getComputedStyle(s).backgroundColor === 'rgba(0, 0, 0, 0)') }));
      host.remove(); return result;
    });
    expect(counts.map(d => d.on)).toEqual([6,2,5,5,4,5,6,3,7,6]);
    expect(counts.every(d => d.visible && d.off)).toBe(true);
    await theme(page, 'dark');
    expect(await styles(clock)).toEqual(clockDark);
    expect(await styles(page.locator('#clock-view .digit_clock_menu_toggle'))).toEqual(cogDark);

    await page.goto('/#/violet-futbol-game-tracker');
    await page.getByRole('button', { name: 'Add Game', exact:true }).click();
    await page.getByRole('button', { name: 'Future Game' }).click();
    const select = page.getByLabel('Game Type', { exact:true });
    await theme(page, 'dark');
    const selectDark = await styles(select);
    await theme(page, 'light');
    await select.focus();
    await expect(select).toBeFocused();
    const light = await styles(select);
    expect(light.colorScheme).toBe('light');
    expect(light.appearance).toBe('none');
    expect(light.backgroundSize).toBe('16px 16px');
    expect(light.backgroundRepeat).toBe('no-repeat');
    expect(light.opacity).toBe('1');
    expect(light.backgroundColor).toBe('rgba(238, 247, 255, 0.94)');
    for (const value of await select.locator('option').evaluateAll(options => options.filter(o => o.value && !o.disabled).map(o => o.value))) {
      await select.selectOption(value); await expect(select).toHaveValue(value);
    }
    expect(await select.evaluate(el => el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right + 1)).toBe(true);
    await select.selectOption('');
    await theme(page, 'dark');
    expect(await styles(select)).toEqual(selectDark);

    await page.goto('/#/maintenance-total');
    await theme(page, 'dark');
    const navDark = await styles(page.locator('.imt_nav_button').first());
    await theme(page, 'light');
    expect((await styles(page.locator('#imt_settings_toggle'))).color).toBe('rgb(57, 69, 82)');
    for (const button of await page.locator('.imt_nav_button').all()) {
      await button.click();
      if (await button.getAttribute('data-imt-nav') === 'more') {
        await expect(page.locator('#imt_settings_toggle')).toHaveCSS('color','rgb(255, 253, 247)');
      }
      expect((await styles(page.locator('.imt_nav_button:not(.is-active)').first())).color).toBe('rgb(82, 97, 113)');
      expect((await styles(page.locator('.imt_nav_button.is-active .imt_nav_icon'))).color).toBe('rgb(100, 216, 203)');
    }
    await theme(page, 'dark');
    expect(await styles(page.locator('.imt_nav_button').first())).toEqual(navDark);
  });
}

test('Sprints confirmation retains an opaque light surface and dimmed backdrop', async ({ page }) => {
  await page.goto('/#/violet-sprints');
  await page.locator('[data-action="start"][data-id="treadmill-sprints"]').click();
  await page.getByRole('button', { name:'Finish Workout', exact:true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await theme(page, 'dark');
  const dark = await styles(dialog);
  await theme(page, 'light');
  expect((await styles(dialog)).backgroundColor).toBe('rgb(250, 246, 255)');
  expect((await styles(dialog)).opacity).toBe('1');
  expect((await styles(page.locator('.sprints-confirm__backdrop'))).backgroundColor).toBe('rgba(15, 23, 42, 0.42)');
  await expect(dialog.getByRole('button', {name:'Cancel'})).toBeVisible();
  await expect(dialog.getByRole('button', {name:'Finish Workout'})).toBeVisible();
  await theme(page, 'dark');
  expect(await styles(dialog)).toEqual(dark);
  await dialog.getByRole('button', {name:'Cancel'}).click();
  await expect(dialog).toHaveCount(0);
});

 test('system appearance changes reach the clock in both directions', async ({page}) => {
   await page.emulateMedia({colorScheme:'dark'});
   await page.goto('/#/digital-clock');
   await theme(page,'system');
   await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
   await page.emulateMedia({colorScheme:'light'});
   await expect(page.locator('html')).toHaveAttribute('data-theme','light');
   await expect(page.locator('#clock-view .is-off').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
   await page.emulateMedia({colorScheme:'dark'});
   await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
   await expect(page.locator('#clock-view .is-off').first()).toHaveCSS('background-color','rgba(55, 60, 57, 0.498)');
 });

for (const width of [320,393,768,1280]) {
  test(`launcher cards stay square with sparse and long content at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/#/');
    const cards=page.locator('#lando-launcher > .digital_clock_wrapper');
    await expect(cards.first()).toBeVisible();
    for (const mode of ['light','dark']) {
      await theme(page,mode);
      for (const long of [false,true]) {
        await page.locator('.vfgt_launcher_summary').evaluate((el,long)=>{
          el.textContent=long ? 'A very long opponent and venue summary '.repeat(25) : '0–0–0';
        },long);
        const sizes=await cards.evaluateAll(els=>els.map(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,overflow:el.scrollHeight>el.clientHeight+1})));
        expect(Math.max(...sizes.map(s=>s.height))-Math.min(...sizes.map(s=>s.height))).toBeLessThanOrEqual(1);
        expect(sizes.every(s=>!s.overflow && Math.abs(s.height-s.width)<=1)).toBe(true);
      }
    }
  });
}

for (const width of [320,393,430,600,767,768,820,1024,1280]) {
  test(`launcher button gutters match on left right and bottom at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/#/');
    for (const mode of ['light','dark']) {
      await theme(page,mode);
      const gutters=await page.locator('#lando-launcher > .digital_clock_wrapper').evaluateAll(cards=>cards.map(card=>{
        const c=card.getBoundingClientRect(),button=card.querySelector('.clock_launch_btn'),b=button.getBoundingClientRect();
        return {left:b.left-c.left,right:c.right-b.right,bottom:c.bottom-b.bottom,square:Math.abs(c.width-c.height)<=1};
      }));
      for (const g of gutters) {
        expect(Math.abs(g.left-g.right)).toBeLessThanOrEqual(1);
        expect(Math.abs(g.left-g.bottom)).toBeLessThanOrEqual(1);
        expect(g.square).toBe(true);
      }
    }
  });
}

for (const width of [320,393,600,768,1280]) {
  test(`launcher time scales with its panel and stays contained at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/#/');
    const panel=page.locator('#lando-launcher .clock_utility_local_time');
    const read=()=>panel.evaluate(panel=>{
      const time=panel.querySelector('.clock_utility_local_time_value');
      const region=time.getBoundingClientRect();
      const digit=time.querySelector('.vfgt_seven_segment_digit').getBoundingClientRect();
      return {digit:digit.width,panel:region.width,inside:[...time.querySelectorAll('.vfgt_seven_segment_digit,.vfgt_seven_segment_colon,.ampm')].every(el=>{
        const r=el.getBoundingClientRect();return r.left>=region.left-1 && r.right<=region.right+1;
      })};
    });
    for (const mode of ['light','dark']) {
      await theme(page,mode);
      for (const parts of [['01','11','11','AM'],['08','58','02','PM'],['12','59','59','PM'],['23','58','58','']]) {
        await panel.evaluate((el,parts)=>{
          const time=el.querySelector('.clock_utility_local_time_value');
          for (const [index,name] of ['hour','minute','second'].entries()) time.querySelector('.'+name).innerHTML=renderClockPartSevenSegment(parts[index]);
          time.querySelector('.ampm').textContent=parts[3];
        },parts);
        expect((await read()).inside).toBe(true);
      }
      const natural=await read();
      expect(natural.inside).toBe(true);
      expect(natural.digit/natural.panel).toBeCloseTo(.1,2);
      await panel.evaluate(el=>el.style.width='70%');
      const smaller=await read();
      expect(smaller.inside).toBe(true);
      expect(smaller.digit).toBeLessThan(natural.digit);
      expect(smaller.digit/smaller.panel).toBeCloseTo(.1,2);
      await panel.evaluate(el=>el.style.width='100%');
      const larger=await read();
      expect(larger.inside).toBe(true);
      expect(larger.digit).toBeCloseTo(natural.digit,1);
    }
  });
}
