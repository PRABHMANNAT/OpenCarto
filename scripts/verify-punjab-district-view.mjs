import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const atlas = JSON.parse(
  await fs.readFile('private/united-atlas/atlas.json', 'utf8'),
);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const x = (lon) => (lon + 180) / 360;
const y = (lat) =>
  (1 -
    Math.log(
      Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
    ) /
      Math.PI) /
  2;
try {
  await page.goto(process.env.MAP_TEST_URL || 'http://127.0.0.1:4545/', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.locator('.gl-host[aria-busy=false]').waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'My maps', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open custom map', exact: true })
    .click();
  await page.getByRole('button', { name: 'Punjab only', exact: true }).click();
  await page.getByLabel('Administrative detail view').selectOption('district');
  const picker = page.getByLabel('Show separate Punjab district'),
    map = page.locator('.ua-map');
  await picker.locator('option').nth(47).waitFor({ state: 'attached' });
  const count = Number(await map.getAttribute('data-detail-count'));
  assert.equal(count, 47);
  assert.equal(await picker.inputValue(), '');
  const ranking = page.getByRole('article', {
    name: 'Punjab district rankings and directory',
  });
  await ranking
    .locator('.ua-district-population-ranking')
    .getByRole('button')
    .filter({ has: page.getByText('Lahore', { exact: true }) })
    .click();
  await page
    .getByRole('article', { name: 'Lahore district profile' })
    .waitFor();
  assert.equal(await map.getAttribute('data-district-id'), '');
  assert.equal(Number(await map.getAttribute('data-detail-count')), count);
  await page
    .getByRole('button', { name: 'Show all Punjab districts', exact: true })
    .click();
  const bounds = atlas.overview.provinces.find((p) => p.id === 'punjab').bbox;
  const coordinates = atlas.details.punjab.district.features.find(
    (f) => f.properties.name === 'Jhang',
  ).properties.center;
  const [west, south, east, north] = bounds;
  await page.waitForTimeout(800);
  const box = await map.boundingBox();
  const scale = Math.min(
    (box.width - 140) / (x(east) - x(west)),
    (box.height - 140) / (y(south) - y(north)),
  );
  await page.mouse.click(
    box.x +
      box.width / 2 +
      (x(coordinates[0]) - (x(west) + x(east)) / 2) * scale,
    box.y +
      box.height / 2 +
      (y(coordinates[1]) - (y(south) + y(north)) / 2) * scale,
  );
  await page.getByRole('article', { name: 'Jhang district profile' }).waitFor();
  assert.equal(await picker.inputValue(), '');
  assert.equal(Number(await map.getAttribute('data-detail-count')), count);
  await page
    .getByRole('button', { name: 'Show only this district', exact: true })
    .click();
  assert.equal(await picker.inputValue(), 'punjab-d-jhang');
  assert.equal(Number(await map.getAttribute('data-detail-count')), 1);
  await page
    .getByRole('button', { name: 'Show all Punjab districts', exact: true })
    .click();
  assert.equal(Number(await map.getAttribute('data-detail-count')), count);
  await picker.selectOption('punjab-d-lahore');
  assert.equal(Number(await map.getAttribute('data-detail-count')), 1);
  await picker.selectOption('');
  await ranking.waitFor();
  assert.equal(Number(await map.getAttribute('data-detail-count')), count);
  assert.deepEqual(errors, []);
  console.log(
    'Verified full district map by default and during profile inspection, map clicks preserve all districts, explicit isolation and all-district reset.',
  );
} finally {
  await browser.close();
}
