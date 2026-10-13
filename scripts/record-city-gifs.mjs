import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.DRONELAB_TEST_URL || 'http://localhost:3000';
const browserPath =
  process.env.DRONELAB_BROWSER ||
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const root = path.resolve('docs/images/city-demos');
const frameRoot = path.resolve('outputs/city-demo-frames');
const flights = [
  {
    id: 'singapore-marina-bay',
    prepare: async (city) => {
      // Between Marina Bay Sands and the Singapore Flyer.
      await city.getByRole('textbox', { name: 'LATITUDE' }).fill('1.2852');
      await city.getByRole('textbox', { name: 'LONGITUDE' }).fill('103.8610');
      await city.getByRole('button', { name: 'Go', exact: true }).click();
    },
  },
  {
    id: 'san-francisco-embarcadero',
    prepare: async (city) => {
      await city.getByRole('combobox', { name: 'City location' }).selectOption('san-francisco');
    },
  },
];
const requested = process.argv.slice(2);
const selected = requested.length
  ? flights.filter(({ id }) => requested.includes(id))
  : flights;

if (!selected.length)
  throw new Error(`Unknown city recording. Choose one of: ${flights.map(({ id }) => id).join(', ')}.`);

async function recordFlight(browser, { id, prepare }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await context.newPage();
  const frames = path.join(frameRoot, id);
  await fs.rm(frames, { recursive: true, force: true });
  await fs.mkdir(frames, { recursive: true });

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('main[data-ready=true]').waitFor({ timeout: 30000 });
  await page.getByRole('tab', { name: 'Simulator', exact: true }).click();
  const city = page.locator('.city-explorer');
  await city.waitFor({ timeout: 30000 });
  await city.getByRole('button', { name: 'Fly the city', exact: true }).waitFor({ timeout: 45000 });
  await prepare(city);
  await city.getByRole('button', { name: 'Fly the city', exact: true }).waitFor({ timeout: 45000 });
  await city.getByRole('button', { name: 'Fly the city', exact: true }).click();
  const map = city.locator('.city-map');
  await map.focus();

  for (let frame = 0; frame < 26; frame++) {
    if (frame === 0) await page.keyboard.down('Space');
    if (frame === 4) {
      await page.keyboard.up('Space');
      await page.keyboard.down('KeyW');
    }
    if (frame === 10) await page.keyboard.down('KeyQ');
    if (frame === 16) await page.keyboard.up('KeyQ');
    if (frame === 21) {
      await page.keyboard.up('KeyW');
      await page.keyboard.down('KeyE');
    }
    if (frame === 24) await page.keyboard.up('KeyE');
    await page.screenshot({ path: path.join(frames, `${String(frame).padStart(3, '0')}.png`) });
    await page.waitForTimeout(400);
  }
  await page.keyboard.up('Space').catch(() => {});
  await page.keyboard.up('KeyW').catch(() => {});
  await page.keyboard.up('KeyQ').catch(() => {});
  await page.keyboard.up('KeyE').catch(() => {});

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
  for (const flight of selected) await recordFlight(browser, flight);
} finally {
  await browser.close();
}
