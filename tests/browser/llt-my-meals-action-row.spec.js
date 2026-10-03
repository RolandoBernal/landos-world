import { expect, test } from '@playwright/test';

const longName = 'Morning fruits with whole grain toast and a very long descriptive meal name';
const meals = [
  { id: 'morning', name: 'Morning fruits', totalCarbs: 67, components: [
    { nameSnapshot: '100% Fruit Juice', emojiSnapshot: '🧃', carbsPerServing: 25 },
    { nameSnapshot: 'Apple', emojiSnapshot: '🍎', carbsPerServing: 22 },
    { nameSnapshot: 'Banana', emojiSnapshot: '🍌', carbsPerServing: 20 },
  ] },
  { id: 'long', name: longName, totalCarbs: 1234.5, components: [
    { nameSnapshot: 'A very long whole grain food name with roasted vegetables and extra cheese', carbsPerServing: 1234.5 },
    ...Array.from({ length: 8 }, (_, i) => ({ nameSnapshot: `Additional fruit component ${i}`, carbsPerServing: 0 })),
  ] },
].map(m => ({ ...m, favorite: false, components: m.components.map((c, i) => ({ ...c, id: `${m.id}-${i}`, componentType: 'food', foodId: `${m.id}-food-${i}`, quantity: 1, carbTotal: c.carbsPerServing })) }));

for (const width of [320, 393, 768, 1280, 852]) {
  test(`Saved meal footer stays below content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 852 ? 393 : 900 });
    await page.goto('/#/lee-lees-tracker');
    await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
    await page.waitForFunction(() => Boolean(window.LeeLeeTrackerStorage));
    await page.evaluate(meals => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current, savedMeals: meals })), meals);
    const mobileNav = page.getByLabel('Lee-Lee’s Tracker mobile navigation');
    const nav = await mobileNav.isVisible() ? mobileNav : page.getByLabel('Lee-Lee’s Tracker sections');
    await nav.getByRole('button', { name: 'Foods', exact: true }).click();
    const mealsPanel = page.locator('[data-food-library-accordion="meals"]');
    if (await mealsPanel.getAttribute('open') === null) await mealsPanel.locator('summary').click();
    await expect(mealsPanel).toHaveAttribute('open', '');
    const cards = page.locator('[data-saved-meals-list] article');
    await expect(cards).toHaveCount(2);
    const morning = cards.filter({ has: page.locator('[data-action="edit-saved-meal"][data-id="morning"]') });
    await expect(morning).toContainText('Morning fruits');
    await expect(morning).toContainText('67 g carbs');
    await expect(morning).toContainText('🧃 100% Fruit Juice · 🍎 Apple · 🍌 Banana');
    for (const card of await cards.all()) {
      await expect(card).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      const geometry = await card.evaluate(n => {
        const content = n.querySelector('.lee_lee_diabetes_food_item_content');
        const footer = n.querySelector('footer');
        const group = footer.querySelector('.lee_lee_diabetes_food_item_actions_right');
        const star = footer.querySelector('button');
        const c = content.getBoundingClientRect(), f = footer.getBoundingClientRect(), s = star.getBoundingClientRect(), g = group.getBoundingClientRect();
        const [edit, del] = [...group.querySelectorAll('button')].map(b => b.getBoundingClientRect());
        return { semanticOrder: content.nextElementSibling === footer, below: f.top >= c.bottom,
          fullWidth: Math.abs(f.left - c.left) < 1 && Math.abs(f.right - c.right) < 1,
          divider: parseFloat(getComputedStyle(footer).borderTopWidth) > 0,
          favoriteLeft: s.left < g.left, groupedRight: Math.abs(g.right - f.right) < 1,
          buttonsTogether: Math.abs(edit.top - del.top) < 1 && edit.right <= del.left,
          contained: f.left >= 0 && f.right <= innerWidth && n.scrollWidth <= n.clientWidth };
      });
      expect(Object.values(geometry).every(Boolean), JSON.stringify(geometry)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await morning.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/llt14-saved-card-${test.info().project.name}-${width}.png`, fullPage: true });
    await morning.getByRole('button', { name: 'Favorite meal', exact: true }).click();
    await expect(morning.getByRole('button', { name: 'Remove meal favorite', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(morning.getByRole('button', { name: 'Remove meal favorite', exact: true })).toHaveText('★');
    expect(await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().savedMeals.find(m => m.id === 'morning').favorite)).toBe(true);
    await morning.getByRole('button', { name: 'Remove meal favorite', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(morning.getByRole('button', { name: 'Edit', exact: true })).toBeFocused();
    expect(await morning.getByRole('button', { name: 'Edit', exact: true }).evaluate(b => getComputedStyle(b).outlineStyle)).toBe('solid');
    await page.keyboard.press('Tab');
    await expect(morning.getByRole('button', { name: 'Delete', exact: true })).toBeFocused();
    await morning.getByRole('button', { name: 'Edit', exact: true }).click();
    const builder = page.locator('[data-meal-builder]');
    await expect(builder.getByLabel('Meal Name', { exact: true })).toHaveValue('Morning fruits');
    await expect(builder.locator('[data-meal-builder-total]')).toHaveText('67 g carbs');
    await builder.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    page.once('dialog', async dialog => { expect(dialog.message()).toBe('Delete Morning fruits?'); await dialog.dismiss(); });
    await morning.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(morning).toBeVisible();
    page.once('dialog', async dialog => { expect(dialog.message()).toBe('Delete Morning fruits?'); await dialog.accept(); });
    await morning.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText(longName);
    const saved = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().savedMeals.find(m => m.id === 'morning'));
    expect(saved.deletedAt).toBeTruthy();
    expect(saved.totalCarbs).toBe(67);
  });
}

test('Neighboring food cards, Favorites, Recent, Search and calculator retain their controls', async ({ page }) => {
  await page.goto('/#/lee-lees-tracker');
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
  await page.waitForFunction(() => Boolean(window.LeeLeeTrackerStorage));
  await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current,
    foodLibrary: [{ id: 'neighbor-food', name: 'Neighbor Food', carbs: 12.5, servingLabel: 'slice', favorite: true, lastUsedAt: new Date().toISOString() }],
  })));
  const mobileNav = page.getByLabel('Lee-Lee’s Tracker mobile navigation');
  const nav = await mobileNav.isVisible() ? mobileNav : page.getByLabel('Lee-Lee’s Tracker sections');
  await nav.getByRole('button', { name: 'Foods', exact: true }).click();
  const panel = page.locator('[data-food-library-accordion="foods"]');
  if (await panel.getAttribute('open') === null) await panel.locator('summary').click();
  const food = page.locator('[data-food-library-list] article').filter({ hasText: 'Neighbor Food' });
  await expect(food.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(food.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  expect(await food.evaluate(n => n.querySelector('footer').getBoundingClientRect().top >= n.querySelector('.lee_lee_diabetes_food_item_content').getBoundingClientRect().bottom)).toBe(true);
  await nav.getByRole('button', { name: 'Log Entry', exact: true }).click();
  await page.getByRole('button', { name: 'Open Carb Calculator' }).click();
  const calc = page.locator('[data-carb-calculator]');
  for (const list of ['favorites', 'recent']) {
    await calc.locator('[data-carb-library-view]').selectOption(list);
    await expect(calc.locator(`[data-carb-picker="${list}"]`).getByRole('button', { name: /Neighbor Food/ })).toBeVisible();
  }
  await calc.getByRole('button', { name: 'Search foods...', exact: true }).click();
  await calc.locator('[name="carbFoodSearch"]').fill('Neighbor');
  await calc.getByRole('button', { name: /Neighbor Food 12.5 g carbs/ }).click();
  await expect(calc.getByLabel('Meal Total')).toHaveText('12.5 g');
  await expect(calc.getByRole('button', { name: 'Edit Neighbor Food', exact: true })).toBeVisible();
  await expect(calc.getByRole('button', { name: 'Remove Neighbor Food', exact: true })).toBeVisible();
  await calc.getByRole('button', { name: '+ Add Manual Amount...', exact: true }).click();
  await calc.getByLabel('Label', { exact: true }).fill('Manual neighbor');
  await calc.getByLabel('Carbs per serving').fill('5');
  await calc.getByRole('button', { name: 'Add Item', exact: true }).click();
  await expect(calc.getByLabel('Meal Total')).toHaveText('17.5 g');
  await calc.getByRole('button', { name: 'Remove Manual neighbor', exact: true }).click();
  await expect(calc.getByLabel('Meal Total')).toHaveText('12.5 g');
});
