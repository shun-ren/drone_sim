import { test, expect } from '@playwright/test';
import { utimes } from 'node:fs/promises';

test('hot updates upgrade an existing city flight without resetting its position or battery', async ({ page }) => {
  test.skip(!!process.env.DRONELAB_TEST_URL, 'Fast Refresh requires the local development server.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let legacyURL, moduleLoads = 0;
  // Start this browser with the old API shape. Only the test's response changes;
  // the source file and every other browser keep the current implementation.
  await page.route('**/lib/city-flight.mjs*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    if (moduleLoads++ === 0) {
      legacyURL = route.request().url();
      body = body.replace('teleport(coordinates)', 'legacyTeleport(coordinates)')
        .replace('canTeleport(coordinates)', 'legacyCanTeleport(coordinates)')
        .replace('undoTeleport()', 'legacyUndoTeleport()')
        .replace(/this\.flightSpeeds = \{[^}]+\};/, '');
    }
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('tab', { name: 'Simulator', exact: true }).click();
  const city = page.locator('.city-explorer');
  await expect(city).toHaveAttribute('data-map-status', 'ready', { timeout: 45000 });
  expect(await page.evaluate(async url => typeof (await import(url)).CityFlight.prototype.teleport, legacyURL)).toBe('undefined');
  await city.getByRole('textbox', { name: 'LATITUDE' }).fill('60.1695');
  await city.getByRole('textbox', { name: 'LONGITUDE' }).fill('24.9355');
  await city.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(city).toHaveAttribute('data-map-status', 'ready', { timeout: 45000 });
  await city.getByRole('button', { name: 'Fly the city', exact: true }).click();
  await city.locator('.city-map').focus();
  await page.keyboard.down('KeyW');
  await expect.poll(() => city.getByTestId('city-gps').innerText()).not.toBe('60.169500, 24.935500');
  await page.keyboard.up('KeyW');
  await city.getByRole('button', { name: 'Map view', exact: true }).click();
  await expect(city.locator('.city-map-label')).toContainText('PAUSED');
  const before = await city.getByTestId('city-gps').innerText();
  const altitude = await city.getByTestId('city-altitude').innerText();
  const battery = await city.locator('.city-instruments div').nth(2).locator('strong').innerText();
  const sentinel = await page.evaluate(() => window.__cityRefreshSentinel = Math.random());

  // A timestamp-only touch triggers a real Vite update without editing source.
  const now = new Date();
  await utimes(new URL('../../lib/city-flight.mjs', import.meta.url), now, now);
  await expect.poll(() => moduleLoads, { timeout: 30000 }).toBeGreaterThan(1);
  await expect(city).toHaveAttribute('data-map-status', 'ready', { timeout: 45000 });
  expect(await page.evaluate(() => window.__cityRefreshSentinel)).toBe(sentinel);
  await expect(city.getByTestId('city-gps')).toHaveText(before);
  await expect(city.getByTestId('city-altitude')).toHaveText(altitude);
  await expect(city.locator('.city-instruments div').nth(2).locator('strong')).toHaveText(battery);
  await expect(city.locator('.city-map-label')).toContainText('PAUSED');

  await city.locator('.city-map').click({ button: 'middle', position: { x: 900, y: 200 } });
  await expect(city.getByTestId('city-gps')).not.toHaveText(before);
  await city.getByRole('button', { name: 'Undo jump', exact: true }).click();
  await expect(city.getByTestId('city-gps')).toHaveText(before);
  await city.getByRole('button', { name: 'Teleport', exact: true }).click();
  await city.locator('.city-map').click({ position: { x: 900, y: 200 } });
  await city.getByRole('button', { name: 'Jump here', exact: true }).click();
  await expect(city.getByTestId('city-gps')).not.toHaveText(before);
  expect(errors).toEqual([]);
});
