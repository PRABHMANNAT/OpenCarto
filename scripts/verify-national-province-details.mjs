import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:4545/';
const storageKey = 'private-atlas-province-details-v1';
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1600, height: 1100}, acceptDownloads: true});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await fs.mkdir('outputs/multi-province', {recursive: true});

async function open(target = page) {
  await target.getByRole('button', {name: 'My maps', exact: true}).click();
  await target.getByRole('button', {name: 'Open custom map', exact: true}).click();
  await target.getByRole('button', {name: 'National overview', exact: true}).waitFor();
}
async function choose(name) {
  await page.getByLabel('Find a province or capital').fill(name);
  await page.locator('.ua-search li button').filter({hasText: name}).first().click();
}
async function ready(expected, target = page) {
  await target.waitForFunction(expected => {
    const map = document.querySelector('.ua-map');
    const levels = JSON.parse(map?.getAttribute('data-province-details') || '{}');
    const order = ([a], [b]) => a.localeCompare(b);
    return JSON.stringify(Object.entries(levels).sort(order)) === JSON.stringify(Object.entries(expected).sort(order)) &&
      map?.getAttribute('aria-busy') === 'false' &&
      !document.querySelector('.ua-map-caption')?.textContent.includes('Loading');
  }, expected, {timeout: 120000});
}
async function detail(province, level) {
  const features = [];
  let offset = 0;
  do {
    const response = await context.request.get(url + `api/private-atlas?action=detail&province=${province}&level=${level}&offset=${offset}`);
    assert.equal(response.status(), 200);
    const data = await response.json();
    features.push(...data.features);
    offset = data.next;
  } while (offset !== null);
  return features;
}
async function clickNationalPoint(coordinates, bounds) {
  const box = await page.locator('.ua-map').boundingBox();
  const x = lon => (lon + 180) / 360;
  const y = lat => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2;
  const [west, south, east, north] = bounds;
  const scale = Math.min((box.width - 140) / (x(east) - x(west)), (box.height - 140) / (y(south) - y(north)));
  await page.mouse.click(
    box.x + box.width / 2 + (x(coordinates[0]) - (x(west) + x(east)) / 2) * scale,
    box.y + box.height / 2 + (y(coordinates[1]) - (y(south) + y(north)) / 2) * scale,
  );
}

try {
  await page.goto(url, {waitUntil: 'networkidle', timeout: 120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout: 120000});
  await open();
  await ready({});
  const overviewResponse = await context.request.get(url + 'api/private-atlas?action=overview');
  assert.equal(overviewResponse.status(), 200);
  const overview = await overviewResponse.json();

  // Use actual map clicks to select an outline while another province has detail.
  await clickNationalPoint(overview.provinces.find(p => p.id === 'in-rajasthan').center, overview.bbox);
  await page.waitForFunction(() => document.querySelector('.ua-breadcrumb')?.textContent.includes('Rajasthan'));
  await page.getByLabel('Administrative detail view').selectOption('district');
  await ready({'in-rajasthan': 'district'});
  const rajasthan = await detail('in-rajasthan', 'district');
  assert.equal(Number(await page.locator('.ua-map').getAttribute('data-detail-count')), rajasthan.length);

  await clickNationalPoint(overview.provinces.find(p => p.id === 'in-uttar-pradesh').center, overview.bbox);
  await page.waitForFunction(() => document.querySelector('.ua-breadcrumb')?.textContent.includes('Uttar Pradesh'));
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  const both = {'in-rajasthan': 'district', 'in-uttar-pradesh': 'tehsil'};
  await ready(both);
  const upTehsils = await detail('in-uttar-pradesh', 'tehsil');
  assert.equal(Number(await page.locator('.ua-map').getAttribute('data-detail-count')), rajasthan.length + upTehsils.length);
  await page.getByRole('button', {name: 'National overview', exact: true}).click();
  await ready(both);
  await page.screenshot({path: 'outputs/multi-province/national-mixed-details.png'});

  // Click rendered district detail to reselect its owner without losing the other state's tehsils.
  await clickNationalPoint(rajasthan.find(f => f.properties.name === 'Ajmer').properties.center, overview.bbox);
  assert.equal(await page.getByLabel('Administrative detail view').inputValue(), 'district');
  await ready(both);

  // Change only one province; cached detail and the other province remain available.
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  const tehsils = {'in-rajasthan': 'tehsil', 'in-uttar-pradesh': 'tehsil'};
  await ready(tehsils);
  await page.getByLabel('Administrative detail view').selectOption('province');
  await ready({'in-uttar-pradesh': 'tehsil'});
  await choose('Punjab');
  await page.getByLabel('Administrative detail view').selectOption('district');
  await ready({'punjab': 'district', 'in-uttar-pradesh': 'tehsil'});
  const punjabCount = Number(await page.locator('.ua-map').getAttribute('data-detail-count')) - upTehsils.length;
  assert.ok(punjabCount > 40, 'Punjab merged district styling stays present');
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  await ready({'punjab': 'tehsil', 'in-uttar-pradesh': 'tehsil'});
  await page.getByLabel('Administrative detail view').selectOption('division');
  const restored = {'punjab': 'division', 'in-uttar-pradesh': 'tehsil'};
  await ready(restored);
  await page.getByRole('button', {name: 'National overview', exact: true}).click();
  await ready(restored);

  // Export the national composition, then restore it across a page reload.
  await page.getByRole('button', {name: 'Download map', exact: true}).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('group', {name: 'Map download options'}).getByRole('button', {name: 'Current view'}).click();
  const download = await pending;
  await download.saveAs('outputs/multi-province/national-mixed-export.png');
  const png = await fs.readFile('outputs/multi-province/national-mixed-export.png');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(png.length > 10000);
  await page.reload({waitUntil: 'networkidle', timeout: 120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout: 120000});
  await open();
  await ready(restored);
  assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey), restored);

  const mobile = await context.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.setViewportSize({width: 390, height: 844});
  await mobile.goto(url, {waitUntil: 'networkidle', timeout: 120000});
  await mobile.locator('.gl-host[aria-busy=false]').waitFor({timeout: 120000});
  await open(mobile);
  await ready(restored, mobile);
  assert.ok(await mobile.locator('.ua-map').isVisible());
  assert.equal(await mobile.locator('.ua-province-detail').count(), 2);
  assert.ok(await mobile.evaluate(() => document.querySelector('.ua-dialog').scrollWidth <= innerWidth + 1));
  await mobile.screenshot({path: 'outputs/multi-province/national-mobile.png'});
  await mobile.close();

  await page.getByRole('button', {name: 'Remove Punjab detail', exact: true}).click();
  await ready({'in-uttar-pradesh': 'tehsil'});
  // Navigation and removal during delayed requests must not restore stale layers.
  await page.route('**/api/private-atlas?**province=in-bihar**', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.continue().catch(() => {});
  });
  await choose('Bihar');
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  await choose('Uttar Pradesh');
  await page.getByLabel('Administrative detail view').selectOption('district');
  await ready({'in-bihar': 'tehsil', 'in-uttar-pradesh': 'district'});
  await choose('Bihar');
  await page.getByLabel('Administrative detail view').selectOption('district');
  await page.getByRole('button', {name: 'Remove Bihar detail', exact: true}).click();
  await ready({'in-uttar-pradesh': 'district'});
  await page.waitForTimeout(1500);
  await ready({'in-uttar-pradesh': 'district'});
  await page.getByRole('button', {name: 'Clear all province detail', exact: true}).click();
  await ready({});
  assert.equal(Number(await page.locator('.ua-map').getAttribute('data-detail-count')), 0);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('.ua-map-error').count(), 0);
  console.log(`Verified national map clicks, ${rajasthan.length} Rajasthan districts + ${upTehsils.length} UP tehsils, independent switching/removal, Punjab district/tehsil/division styles, national reset, PNG export, reload, mobile and navigation/removal during delayed requests.`);
} finally {
  await browser.close();
}
