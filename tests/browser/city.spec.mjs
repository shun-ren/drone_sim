import { test, expect } from '@playwright/test';

test.describe('Map navigation', () => {
test.use({ hasTouch: true });
test('city map pans independently, teleports by middle-click and touch, and flies faster', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('tab', { name: 'Simulator', exact: true }).click();
  const city = page.locator('.city-explorer');
  await expect(city).toHaveAttribute('data-map-status', 'ready', { timeout: 45000 });
  await city.getByRole('button', { name: 'Fly the city', exact: true }).click();
  await city.locator('.city-map').focus();
  await page.keyboard.down('KeyW');
  try {
    await expect.poll(async () => parseFloat(await city.getByTestId('city-speed').innerText()), { timeout: 20000 }).toBeGreaterThan(7.5);
  } finally { await page.keyboard.up('KeyW'); }
  await city.getByRole('button', { name: 'Map view', exact: true }).click();
  await expect(city.locator('.city-map-label')).toContainText('PAUSED');
  const before = await city.getByTestId('city-gps').innerText();
  const altitude = await city.getByTestId('city-altitude').innerText();
  const battery = await city.locator('.city-instruments div').nth(2).locator('strong').innerText();
  const map = city.locator('.city-map');
  const marker = city.locator('.city-drone-marker');
  await expect(marker).toBeVisible();
  await map.scrollIntoViewIfNeeded();
  const bounds = await map.boundingBox();
  const markerBefore = await marker.boundingBox();
  const x = bounds.x + bounds.width * .65, y = bounds.y + bounds.height * .4;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 130, y + 60, { steps: 12 }); await page.mouse.up();
  await expect.poll(async () => (await marker.boundingBox()).x).toBeGreaterThan(markerBefore.x + 60);
  await page.waitForTimeout(600);
  const panned = await marker.boundingBox();
  await page.waitForTimeout(400);
  expect(Math.abs((await marker.boundingBox()).x - panned.x)).toBeLessThan(2);
  await expect(city.getByTestId('city-gps')).toHaveText(before);
  await page.mouse.move(x, y); await page.mouse.wheel(0, -400);
  await expect.poll(async () => Math.abs((await marker.boundingBox()).x - panned.x)).toBeGreaterThan(5);
  await expect(city.getByTestId('city-gps')).toHaveText(before);
  await page.mouse.click(x, y, { button: 'middle' });
  await expect(city.getByTestId('city-gps')).not.toHaveText(before);
  await expect(city.getByTestId('city-altitude')).toHaveText(altitude);
  await expect(city.locator('.city-instruments div').nth(2).locator('strong')).toHaveText(battery);
  await expect(city.getByTestId('city-speed')).toContainText('0.0');
  await city.getByRole('button', { name: 'Undo jump', exact: true }).click();
  await expect(city.getByTestId('city-gps')).toHaveText(before);
  await expect(city.getByRole('button', { name: 'Undo jump', exact: true })).toBeDisabled();
  await city.getByRole('button', { name: 'Centre on drone', exact: true }).click();
  await expect.poll(async () => {
    const currentMap = await map.boundingBox(), pin = await marker.boundingBox();
    return Math.abs(pin.x + pin.width / 2 - currentMap.x - currentMap.width / 2);
  }).toBeLessThan(2);
  await page.screenshot({ path: 'outputs/city-teleport-desktop.png', fullPage: true });

  // Button + ordinary click also works without a middle mouse button.
  await page.setViewportSize({ width: 390, height: 850 });
  await city.getByRole('button', { name: 'Teleport', exact: true }).click();
  await map.scrollIntoViewIfNeeded();
  const mobileMap = await map.boundingBox();
  await page.touchscreen.tap(mobileMap.x + 270, mobileMap.y + 165);
  await expect(city.locator('.city-destination-marker')).toBeVisible();
  await expect(city.getByTestId('city-gps')).toHaveText(before);
  await city.getByRole('button', { name: 'Jump here', exact: true }).click();
  await expect(city.getByTestId('city-gps')).not.toHaveText(before);
  await expect(city.getByTestId('city-altitude')).toHaveText(altitude);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'outputs/city-teleport-mobile.png', fullPage: true });
  await city.getByRole('button', { name: 'Drone view', exact: true }).click();
  await expect(marker).toBeHidden();
  await city.getByRole('button', { name: 'Resume city flight', exact: true }).click();
  await expect(city.locator('.city-map-label')).toContainText('FLYING');
  expect(errors).toEqual([]);
});
});

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

test('separate latitude and longitude fields validate and relocate on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('tab', { name: 'Simulator', exact: true }).click();
  const city = page.locator('.city-explorer');
  await expect(city).toHaveAttribute('data-map-status', 'ready', { timeout: 45000 });
  const latitude = city.getByRole('textbox', { name: 'LATITUDE' });
  const longitude = city.getByRole('textbox', { name: 'LONGITUDE' });
  await expect(latitude).toHaveValue('1.2868');
  await expect(longitude).toHaveValue('103.8544');
  const before = await city.getByTestId('city-gps').innerText();

  await latitude.fill('60.1695');
  await longitude.fill('200');
  await city.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(city.getByRole('alert')).toContainText('longitude from −180 to 180');
  await expect(longitude).toHaveAttribute('aria-invalid', 'true');
  await expect(city.getByTestId('city-gps')).toHaveText(before);

  await longitude.fill('24.9355');
  await expect(city.getByRole('alert')).toHaveCount(0);
  await city.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(city.getByRole('combobox', { name: 'City location' })).toHaveValue('custom');
  await expect(city.getByTestId('city-gps')).toHaveText('60.169500, 24.935500');
  await expect(city).toHaveAttribute('data-map-status', 'ready', { timeout: 45000 });

  await page.setViewportSize({ width: 390, height: 700 });
  await expect(latitude).toBeVisible();
  await expect(longitude).toBeVisible();
  await expect(city.getByRole('button', { name: 'Go', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
