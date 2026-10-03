import { test, expect } from '@playwright/test';
import { unzipSync, strFromU8 } from 'fflate';
import fs from 'node:fs';
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    console.log((await page.locator('body').innerText()).slice(-1500));
});
test('complete browser journey: flight, switch, pause, debrief, export, design, persistence', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole('button', { name: 'Arm & fly' })).toBeVisible();
  await expect(page.locator('.scene-host canvas')).toBeVisible();
  await page.screenshot({ path: 'outputs/flight-deck.png', fullPage: true });
  await page.getByRole('button', { name: 'Watch demonstration' }).click();
  await expect(page.getByText('DEMO PILOT', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Flight instruments', exact: true }).click();
  await expect(page.locator('.instrument-strip')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Flight paused' }),
  ).toBeVisible();
  const frozen = await page.locator('.telemetry-strip').innerText();
  await page.waitForTimeout(600);
  expect(await page.locator('.telemetry-strip').innerText()).toBe(frozen);
  await page
    .getByRole('button', { name: 'Resume flight', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Demo speed' }).click();
  await page.getByRole('option', { name: '4×', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mission accomplished' }),
  ).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'outputs/hover-complete.png', fullPage: true });
  await page.getByRole('button', { name: 'Open flight debrief' }).click();
  await expect(
    page.getByRole('heading', { name: 'Mission completed', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.telemetry-chart')).toHaveCount(7);
  await page.screenshot({
    path: 'outputs/flight-analysis.png',
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export run bundle' }).click();
  const d = await downloadPromise;
  await d.saveAs('outputs/browser-hover.zip');
  const files = unzipSync(fs.readFileSync('outputs/browser-hover.zip'));
  expect(Object.keys(files)).toEqual(
    expect.arrayContaining([
      'metadata.json',
      'telemetry.csv',
      'events.json',
      'inputs.json',
    ]),
  );
  expect(
    JSON.parse(strFromU8(files['events.json'])).some(
      (e) => e.type === 'pause',
    ),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Open recorded playback' }).click();
  await expect(page.locator('.replay-scene canvas')).toBeVisible();
  await page.getByRole('slider', { name: 'Playback time' }).focus();
  await page.keyboard.press('ArrowRight');
  await page
    .getByRole('tab', { name: 'Aircraft designer', exact: true })
    .click();
  await expect(page.locator('main[data-ready=true]')).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByText('Configuration ready for flight', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Design name' })
    .fill('Browser QA design');
  await page.getByRole('button', { name: 'Save design', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'Saved Browser QA design',
  );
  await page.screenshot({
    path: 'outputs/aircraft-designer.png',
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Run history', exact: true }).click();
  await expect(page.getByText('1 RECORDED RUNS')).toBeVisible();
  await page.reload();
  await expect(page.locator('main[data-ready=true]')).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('tab', { name: 'Run history', exact: true }).click();
  await expect(page.getByText('1 RECORDED RUNS')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Browser QA design/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('manual flight controls and responsive layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Arm & fly' }).click();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1300);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('.scene-tags')).toContainText('ACTIVE');
  await page.getByRole('button', { name: 'Flight instruments', exact: true }).click();
  await expect(page.locator('.instrument-strip')).toBeVisible();
  await page.getByRole('button', { name: 'End flight' }).click();
  await expect(
    page.getByRole('heading', { name: 'Flight ended' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Prepare another flight' }).click();
  await expect(page.getByRole('button', { name: 'Arm & fly' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: 'outputs/mobile-flight.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('invalid aircraft cannot launch and scenario validation rejects bad thresholds', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole('tab', { name: 'Aircraft designer', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Battery', exact: true }).click();
  await page
    .getByRole('option', { name: '4S / 4,000 mAh (incompatible)' })
    .click();
  await expect(page.getByText('Configuration cannot launch')).toBeVisible();
  await page.getByRole('tab', { name: 'Flight deck', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Arm & fly' })).toBeDisabled();
  await page
    .getByRole('button', { name: 'Scenario settings', exact: true })
    .click();
  await page.getByText('Edit all thresholds as JSON').click();
  const input = page.getByRole('textbox', { name: 'Scenario JSON' });
  const s = JSON.parse(await input.inputValue());
  s.hold = 0;
  await input.fill(JSON.stringify(s));
  await page.getByRole('button', { name: 'Apply JSON thresholds' }).click();
  await expect(
    page.getByText('hold must be between 1 and 120.', { exact: false }),
  ).toBeVisible();
});

for (const [id, name] of [
  ['obstacle', 'Obstacle course'],
  ['delivery', 'Delivery'],
  ['inspection', 'Inspection'],
  ['wind', 'Wind challenge'],
])
  test(`${name}: browser demonstration, live mode switch and bundle`, async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('main[data-ready=true]')).toBeVisible({
      timeout: 30000,
    });
    await page
      .getByRole('button', { name: new RegExp('^' + name + ' ') })
      .click();
    await page.getByRole('button', { name: 'Watch demonstration' }).click();
    await page.getByRole('combobox', { name: 'Demo speed' }).click();
    await page.getByRole('option', { name: '4×', exact: true }).click();
    await expect(page.locator('.scene-tags')).toContainText('ACTIVE');
    await page.getByRole('button', { name: 'Flight instruments', exact: true }).click();
    await expect(page.locator('.instrument-strip')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Mission accomplished' }),
    ).toBeVisible({ timeout: 60000 });
    await page.screenshot({
      path: `outputs/${id}-complete.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Open flight debrief' }).click();
    await expect(
      page.getByRole('heading', { name: 'Mission completed', exact: true }),
    ).toBeVisible();
    if (id === 'inspection') {
      expect(await page.locator('.capture-gallery img').count()).toBe(5);
      await page
        .locator('.capture-gallery')
        .screenshot({ path: 'outputs/inspection-gallery.png' });
    }
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export run bundle' }).click();
    await (await promise).saveAs(`outputs/browser-${id}.zip`);
    const files = unzipSync(fs.readFileSync(`outputs/browser-${id}.zip`)),
      metadata = JSON.parse(strFromU8(files['metadata.json']));
    expect(metadata.outcome.status).toBe('completed');
    expect(metadata.outcome.score.total).toBeGreaterThanOrEqual(70);
    if (id === 'inspection')
      expect(Object.keys(files).filter((k) => k.endsWith('.png'))).toHaveLength(
        5,
      );
    expect(errors).toEqual([]);
  });
test('two-run comparison shows configuration differences and playback does not freeze a new flight', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({
    timeout: 30000,
  });
  async function demo() {
    await page.getByRole('button', { name: 'Watch demonstration' }).click();
    await page.getByRole('combobox', { name: 'Demo speed' }).click();
    await page.getByRole('option', { name: '4×', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Mission accomplished' }),
    ).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Open flight debrief' }).click();
  }
  await demo();
  await page
    .getByRole('tab', { name: 'Aircraft designer', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Start with an aircraft' }).click();
  await page
    .getByRole('option', { name: 'DL–550 Carrier', exact: true })
    .click();
  await page.getByRole('button', { name: 'Use on the flight deck' }).click();
  await demo();
  await page.getByRole('combobox', { name: 'Compare with a run' }).click();
  await page.getByRole('option', { name: /DL–450 Baseline/ }).click();
  await expect(
    page.getByRole('heading', { name: 'A / B comparison' }),
  ).toBeVisible();
  await expect(page.locator('.comparison-info')).toContainText(
    'frame: cargo → standard',
  );
  await page.getByRole('button', { name: 'Open recorded playback' }).click();
  await expect(page.locator('.replay-scene canvas')).toBeVisible();
  await page.getByRole('tab', { name: 'Flight deck', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare another flight' }).click();
  await page.getByRole('button', { name: 'Arm & fly' }).click();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('.scene-tags')).toContainText('ACTIVE');
});
test('frame samples with game instruments hidden and shown', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({
    timeout: 30000,
  });
  const measures = {
    browser: browser.version(),
    viewport: { width: 1440, height: 1000 },
    runtime: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      cores: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      navigation: performance
        .getEntriesByType('navigation')
        .map((e) => ({
          domContentLoaded: e.domContentLoadedEventEnd,
          load: e.loadEventEnd,
        })),
      memory: performance.memory
        ? { usedJSHeapSize: performance.memory.usedJSHeapSize }
        : null,
    })),
  };
  for (const mode of ['Game', 'Instruments']) {
    if (mode === 'Instruments') await page.getByRole('button', { name: 'Flight instruments', exact: true }).click();
    await page.waitForTimeout(1500);
    const hud = await page.locator('.flight-footer').innerText();
    measures[mode] = { hudSample: hud.match(/\d+ FPS/)?.[0] ?? 'not reported' };
  }
  fs.writeFileSync(
    'outputs/browser-performance.json',
    JSON.stringify(measures, null, 2),
  );
});

test('mission sidebar expands the same canvas and preserves keyboard, live and paused flights', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('main[data-ready=true]')).toBeVisible({
    timeout: 30000,
  });
  const host = page.locator('.scene-host'),
    canvas = await host.locator('canvas').elementHandle(),
    initial = await host.boundingBox();
  await page
    .getByRole('button', { name: 'Hide missions', exact: true })
    .focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#mission-sidebar')).toBeHidden();
  await expect(page.locator('.scene-tags')).toContainText('READY');
  await expect
    .poll(async () => (await host.boundingBox()).width)
    .toBeGreaterThan(initial.width + 250);
  expect(await canvas.evaluate((node) => node.isConnected)).toBeTruthy();
  await page.screenshot({
    path: 'outputs/flight-expanded.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Show missions', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mission-sidebar')).toBeVisible();
  await expect(page.locator('.scene-tags')).toContainText('READY');
  await page.getByRole('button', { name: 'Arm & fly' }).click();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('.scene-tags')).toContainText('ACTIVE');
  await page
    .getByRole('button', { name: 'Hide missions', exact: true })
    .click();
  await expect(page.locator('.scene-tags')).toContainText('ACTIVE');
  await expect(page.locator('.scene-tags')).not.toContainText('PAUSED');
  expect(await canvas.evaluate((node) => node.isConnected)).toBeTruthy();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Flight paused' }),
  ).toBeVisible();
  const frozen = await page.locator('.telemetry-strip').innerText(),
    position = await page.locator('.minimap>small').innerText();
  await page
    .getByRole('button', { name: 'Show missions', exact: true })
    .focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#mission-sidebar')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Flight paused' }),
  ).toBeVisible();
  expect(await page.locator('.telemetry-strip').innerText()).toBe(frozen);
  expect(await page.locator('.minimap>small').innerText()).toBe(position);
  await page.getByRole('button', { name: 'Flight instruments', exact: true }).click();
  await page
    .getByRole('button', { name: 'Hide missions', exact: true })
    .click();
  expect(await page.locator('.telemetry-strip').innerText()).toBe(frozen);
  expect(await canvas.evaluate((node) => node.isConnected)).toBeTruthy();
  for (const width of [1200, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole('button', { name: 'Show missions', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await expect.poll(async () => (await host.boundingBox()).width).toBe(width);
  }
  await page
    .getByRole('button', { name: 'Show missions', exact: true })
    .click();
  const openY = (await host.boundingBox()).y;
  await page
    .getByRole('button', { name: 'Hide missions', exact: true })
    .click();
  expect((await host.boundingBox()).y).toBeLessThan(openY);
  await page
    .getByRole('button', { name: 'Resume flight', exact: true })
    .click();
  await expect(page.locator('.scene-tags')).not.toContainText('PAUSED');
  expect(errors).toEqual([]);
});
