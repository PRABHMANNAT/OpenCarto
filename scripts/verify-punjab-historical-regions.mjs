import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel} from './load-map-model.mjs';

const spec = JSON.parse(await fs.readFile('app/united-punjab-regions.json', 'utf8'));
const model = await loadMapModel();
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
await context.addInitScript(seed => {
  if (localStorage.getItem('regions-test-seeded')) return;
  localStorage.setItem('regions-test-seeded', 'true');
  localStorage.setItem('punjab-studio-regional-v2', JSON.stringify(seed));
  localStorage.setItem('private-atlas-punjab-districts-v1', JSON.stringify({revision: 'united-punjab-48-amb-2026-10-15', groups: [], names: {'punjab-d-lahore': 'Lahore custom'}, colors: {}}));
}, model.initial);
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [], responses = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {if (response.url().includes('level=region')) responses.push(response.status());});
const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:4545/';
await fs.mkdir('outputs/private-atlas', {recursive: true});
async function ready() {
  await page.locator('.ua-map[aria-busy=false]').waitFor({timeout: 120000});
  await page.waitForFunction(() => !document.querySelector('.ua-map-caption')?.textContent.includes('Loading'), {timeout: 120000});
}
async function open() {
  await page.goto(url, {waitUntil: 'networkidle', timeout: 120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout: 120000});
  await page.getByRole('button', {name: 'My maps', exact: true}).click();
  await page.getByRole('button', {name: 'Open custom map', exact: true}).click();
  await ready();
}
async function search(term, label) {
  await page.getByLabel('Find a province or capital').fill(term);
  await page.locator('.ua-search li button').filter({hasText: label}).first().click();
  await ready();
}
try {
  await open();
  await search('Punjab', 'Punjab');
  const view = page.getByLabel('Administrative detail view');
  const options = await view.locator('option').evaluateAll(items => items.map(item => item.value));
  assert.deepEqual(options, ['province', 'region', 'division', 'district', 'tehsil']);
  await view.selectOption('region');
  await ready();
  const panel = page.getByLabel('Punjab historical region information');
  await panel.waitFor();
  const picker = page.getByLabel('Choose Punjab historical region');
  assert.equal(await picker.locator('option').count(), 7);
  assert.equal(await page.getByLabel('Historical region legend').locator('button').count(), 6);
  assert.equal(await page.getByRole('button', {name: /^HQ cities/}).count(), 0);
  for (const region of spec.regions) {
    await picker.selectOption(region.id);
    await panel.getByRole('heading', {name: region.name, exact: true}).waitFor();
    const names = await panel.locator('.ua-region-districts tbody td:first-child').allTextContents();
    assert.deepEqual(names, region.districts.map(name => name === 'Lahore' ? 'Lahore custom' : name));
    assert.equal(await panel.locator('.ua-region-districts tbody tr').count(), region.districts.length);
  }
  await panel.getByRole('button', {name: 'Show all historical regions', exact: true}).click();
  await page.waitForTimeout(850);
  await page.screenshot({path: 'outputs/private-atlas/historical-regions-desktop.png'});
  // Click an actual region polygon at its verified interior point, projected
  // through the same unpitched Web Mercator bounds fit used by the map.
  const overview = await (await context.request.get(url + 'api/private-atlas?action=overview')).json();
  const collection = await (await context.request.get(url + 'api/private-atlas?action=detail&province=punjab&level=region')).json();
  const doaba = collection.features.find(feature => feature.properties.name === 'Doaba').properties;
  const bounds = overview.provinces.find(province => province.id === 'punjab').bbox;
  const mercator = ([lon, lat]) => [(lon + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2];
  const [west, north] = mercator([bounds[0], bounds[3]]), [east, south] = mercator([bounds[2], bounds[1]]);
  const [px, py] = mercator(doaba.center);
  const canvas = page.locator('.ua-map canvas.maplibregl-canvas');
  const box = await canvas.boundingBox();
  const scale = Math.min((box.width - 140) / (east - west), (box.height - 140) / (south - north));
  await canvas.click({position: {x: box.width / 2 + (px - (west + east) / 2) * scale, y: box.height / 2 + (py - (north + south) / 2) * scale}});
  await panel.getByRole('heading', {name: 'Doaba', exact: true}).waitFor();
  await page.getByLabel('Area fill color').evaluate(input => {input.value = '#123456'; input.dispatchEvent(new Event('input', {bubbles: true}));});
  await panel.getByRole('button', {name: 'Show all historical regions', exact: true}).click();
  assert.equal(await page.getByRole('button', {name: 'Doaba · 4 districts', exact: true}).locator('i').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(18, 52, 86)');
  await search('Bar', 'Bar Historical Region');
  await panel.getByRole('heading', {name: 'Bar', exact: true}).waitFor();
  await search('Pothohar Historical Region', 'Pothohar Historical Region');
  await panel.getByRole('heading', {name: 'Pothohar', exact: true}).waitFor();
  await panel.getByRole('button', {name: 'Haripur', exact: true}).click();
  await ready();
  const district = page.getByLabel('Haripur district profile');
  await district.waitFor();
  assert.match(await district.innerText(), /Abbottabad/);
  assert.match(await district.innerText(), /Historical region · Pothohar/);
  await view.selectOption('region');
  await ready();
  const download = page.waitForEvent('download');
  await panel.getByRole('button', {name: 'Download historical regions CSV', exact: true}).click();
  await (await download).saveAs('outputs/private-atlas/historical-regions.csv');
  const lines = (await fs.readFile('outputs/private-atlas/historical-regions.csv', 'utf8')).trim().split(/\r?\n/);
  assert.equal(lines.length, 7);
  const rows = lines.slice(1).map(line => line.match(/"([^"]*)"/g).map(cell => cell.slice(1, -1)));
  assert.deepEqual(rows.map(row => Number(row[1])), [13, 10, 4, 4, 9, 8]);
  assert.equal(rows.reduce((sum, row) => sum + Number(row[4]), 0), 70000000);
  assert.match(rows[0][5], /Lahore custom/);
  const png = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download map', exact: true}).click();
  await page.getByRole('button', {name: /^Current view/}).click();
  await (await png).saveAs('outputs/private-atlas/historical-regions-map.png');
  await view.selectOption('division');
  await ready();
  assert.equal(await page.getByLabel('Choose Punjab division').locator('option').count(), 13);
  await page.getByLabel('Choose Punjab division').selectOption('punjab-div-hazara');
  assert.match(await page.getByLabel('Punjab division information').innerText(), /Abbottabad/);
  await view.selectOption('region');
  await ready();
  await search('Amb', 'Amb');
  await page.getByLabel('Amb province information').waitFor();
  assert.equal(await view.locator('option[value=region]').evaluate(option => option.disabled), true);
  await view.selectOption('tehsil');
  await ready();
  const enabled = JSON.parse(await page.locator('.ua-map').getAttribute('data-province-details'));
  assert.equal(enabled.punjab, 'region');
  assert.equal(enabled.amb, 'tehsil');
  await open();
  await search('Punjab', 'Punjab');
  assert.equal(await view.inputValue(), 'region', 'Historical region selection persists across reopening');
  await ready();
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: 'outputs/private-atlas/historical-regions-mobile.png'});
  assert.ok(await page.locator('.ua-dialog').evaluate(node => node.scrollWidth) <= 392);
  assert.ok(responses.length > 0 && responses.every(status => status === 200));
  assert.deepEqual(errors, []);
  await fs.writeFile('outputs/private-atlas/historical-regions-browser-check.json', JSON.stringify({regions: 6, districtCounts: [13, 10, 4, 4, 9, 8], viewAboveDivisions: true, polygonClick: true, regionSearch: true, customNamesAndColors: true, districtDrilldown: true, csvPopulation: 70000000, pngDownload: true, divisionsRetained: 12, ambIndependent: true, viewPersists: true, desktopAndMobile: true, regionResponseStatuses: responses, pageErrors: errors}, null, 2));
  console.log('Verified six historical regions above Divisions, exact membership, polygon selection, search, custom names/colors, district drilldown, CSV/PNG exports, 12 retained divisions, independent Amb and persisted desktop/mobile views.');
} catch (error) {
  await page.screenshot({path: 'outputs/private-atlas/historical-regions-failure.png'});
  throw error;
} finally {await browser.close();}
