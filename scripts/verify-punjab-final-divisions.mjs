import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel} from './load-map-model.mjs';
const model = await loadMapModel();
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
await context.addInitScript(seed => {
  localStorage.setItem('punjab-studio-regional-v2', JSON.stringify(seed));
  localStorage.setItem('private-atlas-punjab-districts-v1', JSON.stringify({revision: 'united-punjab-48-amb-2026-10-15', groups: [], names: {'punjab-d-amritsar': 'Amritsar custom'}, colors: {}}));
}, model.initial);
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:4545/';
await fs.mkdir('outputs/private-atlas', {recursive: true});
async function ready() {
  await page.locator('.ua-map[aria-busy=false]').waitFor({timeout: 120000});
  await page.waitForFunction(() => !document.querySelector('.ua-map-caption')?.textContent.includes('Loading'), {timeout: 120000});
}
async function search(term, label) {
  await page.getByLabel('Find a province or capital').fill(term);
  await page.locator('.ua-search li button').filter({hasText: label}).first().click();
  await ready();
}
try {
  await page.goto(url, {waitUntil: 'networkidle', timeout: 120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout: 120000});
  await page.getByRole('button', {name: 'My maps', exact: true}).click();
  await page.getByRole('button', {name: 'Open custom map', exact: true}).click();
  await page.getByRole('button', {name: 'National overview', exact: true}).waitFor();
  await ready();
  await search('Punjab', 'Punjab');
  const profile = page.getByLabel('Punjab province information');
  await profile.waitFor();
  const path = await page.getByLabel('Punjab geographic silhouette').locator('path').getAttribute('d');
  assert.ok(path.length > 500);
  const silhouette = await page.getByLabel('Punjab geographic silhouette').boundingBox();
  assert.ok(silhouette.width > 30 && silhouette.height > 30);
  const facts = await profile.locator('.ua-facts').innerText();
  assert.match(facts, /State area/);
  assert.doesNotMatch(facts, /Polygon area/);
  assert.match(facts, /7(?:\.0+)? crore/);
  assert.match(facts, /5,200 m/);
  assert.match(facts, /15,460 km²/);
  assert.match(facts, /10.2%/);
  await page.setViewportSize({width: 814, height: 715});
  await profile.locator('.ua-facts').scrollIntoViewIfNeeded();
  await page.screenshot({path: 'outputs/private-atlas/punjab-final-state-facts-814.png'});
  await profile.locator('.ua-identity').scrollIntoViewIfNeeded();
  await page.screenshot({path: 'outputs/private-atlas/punjab-restored-silhouette-814.png'});
  await page.setViewportSize({width: 1440, height: 1000});
  await page.getByLabel('Administrative detail view').selectOption('division');
  await ready();
  const picker = page.getByLabel('Choose Punjab division');
  assert.equal(await picker.locator('option').count(), 13);
  for (const [id, name, hq, expected] of [
    ['punjab-div-rawalpindi', 'Rawalpindi', 'Rawalpindi', ['Rawalpindi', 'Taxila', 'Panja Sahib', 'Katas', 'Jhelum']],
    ['punjab-div-hazara', 'Hazara', 'Abbottabad', ['Haripur', 'Hazarawala', 'Akali Phula Singh']],
  ]) {
    await picker.selectOption(id);
    await page.getByRole('heading', {name: `${name} Division`, exact: true}).waitFor();
    const info = page.getByLabel('Punjab division information');
    const names = await info.locator('.ua-division-districts tbody tr td:first-child').allTextContents();
    assert.deepEqual(names.sort(), [...expected].sort());
    assert.match(await info.locator('.ua-division-facts').innerText(), new RegExp(hq));
    assert.equal(await page.locator('.ua-map').getAttribute('data-headquarters-visible'), 'true');
    await page.waitForTimeout(750);
    await page.screenshot({path: `outputs/private-atlas/final-division-${name.toLowerCase()}.png`});
  }
  await search('Rawalpindi Division', 'Rawalpindi Division');
  await page.getByRole('heading', {name: 'Rawalpindi Division', exact: true}).waitFor();
  await page.getByRole('button', {name: 'Punjab only', exact: true}).click();
  await ready();
  const overview = page.getByLabel('Punjab district rankings and directory');
  await overview.waitFor();
  assert.match(await overview.innerText(), /48 districts · 12 divisions/);
  assert.match(await overview.innerText(), /7(?:\.0+)? crore/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download district statistics CSV', exact: true}).click();
  await (await download).saveAs('outputs/private-atlas/final-48-district-statistics.csv');
  const csv = await fs.readFile('outputs/private-atlas/final-48-district-statistics.csv', 'utf8');
  const lines = csv.trim().split(/\r?\n/);
  assert.equal(lines.length, 49);
  const rows = lines.slice(1).map(line => line.match(/"([^"]*)"/g).map(cell => cell.slice(1, -1)));
  assert.equal(rows.reduce((sum, row) => sum + Number(row[5]), 0), 70000000);
  assert.equal(new Set(rows.map(row => row[1])).size, 12);
  assert.equal(rows.find(row => row[0] === 'Akali Phula Singh')[1], 'Hazara');
  assert.equal(rows.find(row => row[0] === 'Haripur')[2], 'Abbottabad');
  assert.ok(rows.some(row => row[0] === 'Amritsar custom'), 'Saved custom district name is preserved');
  const mapDownload = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download map', exact: true}).click();
  await page.getByRole('button', {name: /^Current view/}).click();
  await (await mapDownload).saveAs('outputs/private-atlas/final-48-district-map.png');
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: 'outputs/private-atlas/final-12-divisions-mobile.png'});
  assert.ok(await page.locator('.ua-dialog').evaluate(node => node.scrollWidth) <= 392);
  assert.deepEqual(errors, []);
  await fs.writeFile('outputs/private-atlas/final-divisions-browser-check.json', JSON.stringify({districts: 48, divisions: 12, population: 70000000, silhouette: true, stateAreaLabel: true, forestEstimate: true, highestPoint: true, rawalpindi: 5, hazara: 3, divisionSearch: true, csvTotal: 70000000, customNamesPreserved: true, pngDownload: true, desktopAndMobile: true, pageErrors: errors}, null, 2));
  console.log('Verified 48 districts / 12 divisions, Rawalpindi 5 and Hazara 3, existing HQ markers, 7 crore, forest/highest-point estimates, restored silhouette, State area label, division search, custom names and CSV/PNG downloads on desktop/mobile.');
} finally {await browser.close();}
