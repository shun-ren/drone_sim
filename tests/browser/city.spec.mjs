import { test, expect } from '@playwright/test';

test('city simulator loads real map data, flies, and returns to the paused game', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Arm & fly' }).click();
  await page.getByRole('tab', { name: 'Simulator', exact: true }).click();
  const city = page.locator('.city-explorer');
  await expect(city).toHaveAttribute('data-map-status', 'ready', { timeout: 45000 });
  await expect(city.locator('.maplibregl-canvas')).toBeVisible();
  await expect(city.locator('.maplibregl-ctrl-attrib')).toContainText(/OpenStreetMap/i);
  await expect(page.locator('.workspace')).toBeHidden();
  await page.screenshot({ path: 'outputs/city-simulator.png', fullPage: true });

  const before = await city.getByTestId('city-gps').innerText();
  await page.getByRole('button', { name: 'Fly the city' }).click();
  await expect(city.locator('.city-map-label')).toContainText('FLYING');
  await city.locator('.city-map').focus();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyW');
  await expect.poll(() => city.getByTestId('city-gps').innerText()).not.toBe(before);
  await page.getByRole('button', { name: 'Pause city flight' }).click();
  await expect(city.locator('.city-map-label')).toContainText('PAUSED');
  await page.getByRole('tab', { name: 'Game', exact: true }).click();
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('.scene-tags')).toContainText('PAUSED');
  expect(errors).toEqual([]);
});

test('narrow layout keeps designer reachable and delivery actions above telemetry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({ timeout: 30000 });
  await page.locator('[data-mission=delivery]').click();
  const actions = page.locator('.launch-actions');
  await expect(actions.getByRole('button', { name: 'Arm & fly' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Watch demonstration' })).toBeVisible();
  const card = await page.locator('.launch-card').boundingBox();
  const strip = await page.locator('.telemetry-strip').boundingBox();
  expect(card.y + card.height).toBeLessThanOrEqual(strip.y + 1);
  await page.getByRole('button', { name: 'Fullscreen flight view' }).click();
  await expect(page.getByRole('tab', { name: 'Aircraft designer', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Aircraft designer', exact: true }).click();
  await expect(page.getByText('Configuration ready for flight', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
