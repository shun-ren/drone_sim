import { test, expect } from '@playwright/test';

test('training flight pause banner appears across the scene and clears on resume', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Watch demonstration', exact: true }).click();
  await expect(page.locator('.scene-tags')).toContainText('ACTIVE');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const banner = page.getByTestId('flight-paused-banner');
  await expect(banner).toContainText('Flight paused');
  await expect(banner).toContainText('Simulation frozen');
  const bounds = await banner.boundingBox();
  const scene = await page.locator('.scene-wrap').boundingBox();
  expect(bounds.x).toBeLessThanOrEqual(scene.x + 1);
  expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(scene.x + scene.width - 1);
  await page.getByRole('button', { name: 'Resume flight', exact: true }).click();
  await expect(banner).toHaveCount(0);
  expect(errors).toEqual([]);
});
