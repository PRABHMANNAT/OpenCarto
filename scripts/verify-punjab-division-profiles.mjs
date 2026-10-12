import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:4545/';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.stack || error.message));
await fs.mkdir('outputs/punjab-divisions', { recursive: true });
const x = (longitude) => (longitude + 180) / 360;
const y = (latitude) =>
  (1 -
    Math.log(
      Math.tan((latitude * Math.PI) / 180) +
        1 / Math.cos((latitude * Math.PI) / 180),
    ) /
      Math.PI) /
  2;
async function clickCoordinate(coordinates, bounds) {
  await page.locator('.ua-map[aria-busy=false]').waitFor();
  const box = await page.locator('.ua-map').boundingBox();
  const [west, south, east, north] = bounds;
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
}
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('.gl-host[aria-busy=false]').waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'My maps', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open custom map', exact: true })
    .click();
  await page.getByRole('button', { name: 'Punjab only', exact: true }).click();
  await page.getByLabel('Administrative detail view').selectOption('division');
  await page.getByLabel('Choose Punjab division').waitFor();
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.ua-map-caption')
        ?.textContent.includes('Loading'),
  );
  await page.locator('.ua-map[aria-busy=false]').waitFor();
  const response = await context.request.get(
    url + 'api/private-atlas?action=detail&province=punjab&level=division',
  );
  assert.equal(response.status(), 200);
  const divisions = (await response.json()).features;
  assert.equal(divisions.length, 11);
  assert.deepEqual(
    divisions.map((division) => division.properties.color),
    [
      '#AFC7B1',
      '#A9C7DD',
      '#E5B48F',
      '#C4AED2',
      '#D8A6AD',
      '#C2C58F',
      '#93C2BE',
      '#DCC89F',
      '#ABB6D7',
      '#9EBA9A',
      '#BDD5E3',
    ],
  );
  assert.equal(await page.locator('.ua-area-ranking li').count(), 11);
  const divisionRanking = await page
    .locator('.ua-area-ranking em')
    .allTextContents();
  const rankedAreas = divisionRanking.map((text) =>
    Number(text.replace(/[^0-9.]/g, '')),
  );
  assert.deepEqual(
    rankedAreas,
    [...rankedAreas].sort((a, b) => b - a),
  );
  const headquartersToggle = page.getByRole('button', {
    name: 'HQ cities on',
  });
  await headquartersToggle.click();
  await page.getByRole('button', { name: 'HQ cities off' }).waitFor();
  await page.locator('.ua-map[data-headquarters-visible=false]').waitFor();
  await page.getByRole('button', { name: 'HQ cities off' }).click();
  await page.getByRole('button', { name: 'HQ cities on' }).waitFor();
  await page.locator('.ua-map[data-headquarters-visible=true]').waitFor();
  const overview = await (
    await context.request.get(url + 'api/private-atlas?action=overview')
  ).json();
  const punjab = overview.provinces.find(
    (province) => province.id === 'punjab',
  );
  for (const division of divisions) {
    const info = division.properties;
    await page.getByLabel('Choose Punjab division').selectOption(info.id);
    const profile = page.getByRole('article', {
      name: 'Punjab division information',
    });
    assert.equal(
      await profile.locator('h2').innerText(),
      info.name + ' Division',
    );
    assert.ok(
      (await profile.locator('.ua-division-facts').innerText()).includes(
        info.capital,
      ),
    );
    assert.match(
      await profile.locator('.ua-division-facts').innerText(),
      /Area rank\s+#\d+ of 11/,
    );
    assert.equal(await profile.locator('tbody tr').count(), info.districtCount);
    const rows = await profile.locator('tbody').innerText();
    for (const name of info.memberDistricts) assert.ok(rows.includes(name));
    await profile
      .locator('.ua-gallery img')
      .evaluate((image) => image.decode());
    assert.ok(
      await profile
        .locator('.ua-gallery img')
        .evaluate((image) => image.naturalWidth > 0 && !image.hidden),
    );
    assert.equal(
      await profile
        .getByRole('link', { name: 'Headquarters on Wikipedia' })
        .getAttribute('href'),
      info.wikiUrl,
    );
    await page.getByLabel('Choose Punjab division').selectOption('');
    await clickCoordinate(info.headquartersCoordinates, punjab.bbox);
    await profile
      .locator('h2')
      .filter({ hasText: info.name + ' Division' })
      .waitFor();
  }
  await page.getByLabel('Choose Punjab division').selectOption('');
  const rawalpindi = divisions.find(
    (division) => division.properties.name === 'Rawalpindi',
  );
  await clickCoordinate(rawalpindi.properties.center, punjab.bbox);
  await page
    .locator('.ua-division-profile h2')
    .filter({ hasText: 'Rawalpindi Division' })
    .waitFor();
  await page.screenshot({
    path: 'outputs/punjab-divisions/rawalpindi-desktop.png',
  });
  await page.getByRole('button', { name: 'Download map', exact: true }).click();
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full selected area' }).click();
  const download = await pendingDownload;
  assert.equal(
    download.suggestedFilename(),
    'rawalpindi-full-view-political.png',
  );
  await download.saveAs('outputs/punjab-divisions/rawalpindi-full-view.png');
  await page
    .getByRole('button', { name: 'Download map', exact: true })
    .waitFor();
  await page.getByLabel('Administrative detail view').selectOption('district');
  const districtOverview = page.getByRole('article', {
    name: 'Punjab district rankings and directory',
  });
  await districtOverview.waitFor();
  await districtOverview
    .locator('.ua-district-area-ranking li')
    .first()
    .waitFor();
  assert.equal(
    await districtOverview.locator('.ua-district-area-ranking li').count(),
    49,
  );
  assert.equal(
    await districtOverview.locator('.ua-district-directory tbody tr').count(),
    49,
  );
  const directoryNames = await districtOverview
    .locator('.ua-district-directory tbody td:first-child')
    .allTextContents();
  assert.deepEqual(
    directoryNames,
    [...directoryNames].sort((a, b) => a.localeCompare(b)),
  );
  await page
    .getByLabel('Show separate Punjab district')
    .selectOption('punjab-d-rawalpindi');
  const districtFacts = await page
    .locator('.ua-single-district .ua-division-facts')
    .innerText();
  assert.match(districtFacts, /Headquarters\s+Rawalpindi/);
  assert.match(districtFacts, /Area rank\s+#\d+ of 49/);
  assert.match(districtFacts, /Estimated population · fictional/);
  await page.getByLabel('Administrative detail view').selectOption('division');
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByLabel('Choose Punjab division')
    .selectOption('punjab-div-bathinda');
  await page.locator('.ua-division-profile').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'outputs/punjab-divisions/bathinda-mobile.png',
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  assert.equal(await page.locator('.ua-map-error').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'Verified all 11 division profiles and area rankings, all 49 district rankings and capital-directory rows, selected district statistics, attributed images, headquarters controls, full division PNG export and mobile layout.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'outputs/punjab-divisions/failure.png' })
    .catch(() => {});
  console.error('Division browser errors:', errors);
  throw error;
} finally {
  await browser.close();
}
