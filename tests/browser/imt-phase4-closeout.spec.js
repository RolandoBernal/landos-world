import { test, expect } from '@playwright/test';
const KEY = 'lando-world:maintenance-total:v1';
// Phase 4 close-out: assert the shipped KeepUp treatment that earlier specs
// did not cover — greeting header, flat backgrounds, health ring, Plan's
// amber group border, History's sub-line, the nothing-due empty state, and
// the starter-template offer surface. (Frosted-nav assertions live in
// imt-mockup-tokens.spec.js and are deliberately not duplicated here.)
const RICH = JSON.stringify({ version: 1,
  bikes: [{ id: 'bike', name: 'Road bike', category: 'bikes', active: true, currentMileage: 10000, createdAt: '2025-01-01' }],
  components: [{ id: 'chain', assetId: 'bike', name: 'Chain clean & lube', intervalMiles: 500, estCost: 10, estMinutes: 10, mileageAtCreation: 0, createdAt: '2025-01-01' }],
  records: [{ id: 'r1', assetId: 'bike', componentId: 'chain', date: '2026-01-01', mileage: 9550, cost: 10, serviceProvider: 'Me', taskType: 'Service' }] });
const CLEAN = JSON.stringify({ version: 1,
  bikes: [{ id: 'bike', name: 'Road bike', category: 'bikes', active: true, currentMileage: 10000, createdAt: '2025-01-01' }],
  components: [{ id: 'chain', assetId: 'bike', name: 'Chain clean & lube', intervalMiles: 2000, estCost: 10, estMinutes: 10, mileageAtCreation: 0, createdAt: '2025-01-01' }],
  records: [{ id: 'r1', assetId: 'bike', componentId: 'chain', date: '2026-01-01', mileage: 9900, cost: 10, serviceProvider: 'Me', taskType: 'Service' }] });
const TASKLESS = JSON.stringify({ version: 1,
  bikes: [{ id: 'bike', name: 'Road bike', category: 'bikes', active: true, currentMileage: 10000, createdAt: '2025-01-01' }],
  components: [], records: [] });

async function openSeeded(page, seed) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(s => { if (!localStorage.getItem('lando-world:maintenance-total:v1')) localStorage.setItem('lando-world:maintenance-total:v1', s); }, seed);
  await page.goto('/#/maintenance-total');
  await page.waitForSelector('#maintenance-total-root');
}

test('greeting header and flat backgrounds in both themes', async ({ page }) => {
  await openSeeded(page, RICH);
  await expect(page.locator('.imt_header').first()).toContainText(/Good (morning|afternoon|evening), Chief\./);
  const view = page.locator('#maintenance-total-view');
  await expect(view).toHaveCSS('background-color', 'rgb(246, 247, 244)');
  await page.evaluate(() => window.LandosTheme.setPreference('dark'));
  await expect(view).toHaveCSS('background-color', 'rgb(13, 19, 17)');
});

test('health ring track, progress stroke and card radius', async ({ page }) => {
  await openSeeded(page, RICH);
  await expect(page.locator('.imt_health')).toHaveCSS('border-radius', '20px');
  const circles = page.locator('.imt_health_ring svg circle');
  await expect(circles.nth(0)).toHaveAttribute('stroke', '#2A3B35');
  await expect(circles.nth(1)).toHaveAttribute('stroke', '#E9A23B');
});

test('Plan groups carry the amber left border', async ({ page }) => {
  await openSeeded(page, RICH);
  await page.locator('.imt_floating_controls [data-imt-nav="plan"]').click();
  // The RICH chain task is mileage-first (milesLeft 50, no time axis), so it
  // lands in Plan's 'By mileage' group; every group section carries the border.
  const group = page.locator('.imt_section', { has: page.getByRole('heading', { name: 'By mileage' }) });
  await expect(group).toHaveCSS('border-left-width', '3px');
  await expect(group).toHaveCSS('border-left-color', 'rgb(233, 162, 59)');
});

test('History shows its sub-line and mini stat cards', async ({ page }) => {
  await openSeeded(page, RICH);
  await page.locator('.imt_floating_controls [data-imt-nav="history"]').click();
  await expect(page.getByText('Every log, receipt, and dollar')).toBeVisible();
  await expect(page.locator('.imt_history_stats .imt_stat')).toHaveCount(2);
});

test('clean board: Today is current and Plan shows the nothing-due state', async ({ page }) => {
  await openSeeded(page, CLEAN);
  await expect(page.getByText('Everything is current.')).toBeVisible();
  await page.locator('.imt_floating_controls [data-imt-nav="plan"]').click();
  await expect(page.getByText('Nothing known due in the next 90 days or 250 miles.')).toBeVisible();
});

test('starter template offer appears on a task-less asset', async ({ page }) => {
  await openSeeded(page, TASKLESS);
  await page.locator('.imt_floating_controls [data-imt-nav="assets"]').click();
  await page.locator('[data-bike="bike"]').click();
  await expect(page.getByRole('heading', { name: 'Start a maintenance plan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply starter template' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No thanks' })).toBeVisible();
});
