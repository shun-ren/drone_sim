import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.DRONELAB_TEST_URL || 'http://localhost:3000';
const browserPath =
  process.env.DRONELAB_BROWSER ||
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const root = path.resolve('docs/images/mission-demos');
const frameRoot = path.resolve('outputs/mission-demo-frames');
const missions = [
  ['hover', 'Hover test'],
  ['obstacle', 'Obstacle course'],
  ['delivery', 'Delivery'],
  ['inspection', 'Inspection'],
  ['wind', 'Wind challenge'],
];
const requested = process.argv.slice(2);
const selected = requested.length
  ? missions.filter(([id]) => requested.includes(id))
  : missions;

if (!selected.length)
  throw new Error(`Unknown mission. Choose one of: ${missions.map(([id]) => id).join(', ')}.`);

async function recordMission(browser, [id, name]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await context.newPage();
  const frames = path.join(frameRoot, id);
  await fs.rm(frames, { recursive: true, force: true });
  await fs.mkdir(frames, { recursive: true });

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('main[data-ready=true]').waitFor({ timeout: 30000 });
  if (id !== 'hover') await page.locator(`[data-mission="${id}"]`).click();
  await page.getByRole('button', { name: 'Watch demonstration' }).click();
  await page.getByRole('combobox', { name: 'Demo speed' }).click();
  await page.getByRole('option', { name: /^4/ }).click();
  await page.getByRole('button', { name: 'Flight instruments', exact: true }).click();

  let frame = 0;
  let completed = false;
  for (let elapsed = 0; elapsed < 60000; elapsed += 400) {
    await page.screenshot({
      path: path.join(frames, `${String(frame++).padStart(3, '0')}.png`),
    });
    if (completed) break;
    completed = await page
      .getByRole('heading', { name: 'Mission accomplished' })
      .isVisible()
      .catch(() => false);
    await page.waitForTimeout(400);
  }
  if (!completed) throw new Error(`${name} did not complete within 60 seconds.`);

  const output = path.join(root, `${id}.gif`);
  const result = spawnSync('python', ['scripts/frames-to-gif.py', frames, output], {
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`Could not build ${output}.`);
  await context.close();
}

await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: browserPath,
  args: ['--enable-unsafe-swiftshader'],
});
try {
  for (const mission of selected) await recordMission(browser, mission);
} finally {
  await browser.close();
}
