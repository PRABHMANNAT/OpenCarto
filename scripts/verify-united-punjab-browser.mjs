import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel} from './load-map-model.mjs';

const model = await loadMapModel();
const palette = [{name: 'Uploaded blue', hex: '#123456'}, {name: 'Uploaded pink', hex: '#ABCDEF'}, {name: 'Uploaded gold', hex: '#FEDCBA'}];
const seed = model.validate({...model.initial, paintPalette: palette, title: 'Reorganization verification'});
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
await context.addInitScript(({seed}) => {
  localStorage.setItem('punjab-studio-regional-v2', JSON.stringify(seed));
  localStorage.setItem('private-atlas-punjab-districts-v1', JSON.stringify({groups: [
    {id: 'punjab-d-katas-raj-salt-range', name: 'Katas', members: ['punjab-d-katas-raj-salt-range', 'punjab-d-chakwal']},
  ], names: {}, colors: {'punjab-d-swabi': '#ffffff'}}));
}, {seed});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', error => errors.push(error.stack || error.message));
await fs.mkdir('outputs/private-atlas', {recursive: true});
const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:4545/';
async function ready() {
  await page.waitForFunction(() => !document.querySelector('.ua-map-caption')?.textContent.includes('Loading'), {timeout: 120000});
  await page.locator('.ua-map[aria-busy=false]').waitFor({timeout: 120000});
}
async function search(term, name, level) {
  await page.getByLabel('Find a province or capital').fill(term);
  const results = page.locator('.ua-search li button').filter({hasText: name});
  await (level ? results.filter({hasText: level}) : results).first().click();
  await ready();
}
async function snapshot(name) {
  await page.screenshot({path: `outputs/private-atlas/${name}.png`});
}
try {
  await page.goto(url, {waitUntil: 'networkidle', timeout: 120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout: 120000});
  await page.getByRole('button', {name: 'My maps', exact: true}).click();
  await page.getByRole('button', {name: 'Open custom map', exact: true}).click();
  await page.getByRole('button', {name: 'National overview', exact: true}).waitFor();
  await ready();
  assert.equal(await page.getByRole('button', {name: 'Punjab & KP decisions', exact: true}).count(), 0);
  const overview = await (await context.request.get(new URL('/api/private-atlas?action=overview', url).href)).json();
  assert.equal(overview.provinces.find(p => p.id === 'punjab').detailCounts.district, 48);
  assert.equal(overview.places.features.find(f => f.properties.id === 'up-phulra').properties.province, 'punjab');
  assert.equal(overview.capitals.features.find(f => f.properties.id === 'amb').properties.sourceUrl, 'https://www.openstreetmap.org/node/745365492');
  await page.getByRole('button', {name: 'Punjab only', exact: true}).click();
  await ready();
  const picker = page.getByLabel('Show separate Punjab district');
  await picker.waitFor();
  assert.equal(await picker.locator('option').count(), 49);
  assert.deepEqual(await page.getByLabel('Punjab palette color').locator('option').evaluateAll(options => options.slice(1).map(option => option.value)), palette.map(color => color.hex));
  for (const [id, name, capital, tehsils] of [
    ['punjab-d-akali-phula-singh', 'Akali Phula Singh', 'Nowshera', ['Nowshera', 'Jehangira', 'Hund', 'Razar', 'Swabi', 'Mahabanpur', 'Ranigat']],
    ['punjab-d-haripur-hazara', 'Haripur', 'Abbottabad', ['Haripur', 'Ghazi', 'Khanpur', 'Abbottabad', 'Havelian', 'Haro', 'Sherwan']],
    ['punjab-d-hazarawala', 'Hazarawala', 'Mansehra', ['Mansehra', 'Pakhli', 'Balakot']],
  ]) {
    await picker.selectOption(id);
    const profile = page.getByLabel(`${name} district profile`);
    await profile.getByRole('heading', {name, exact: true}).waitFor();
    assert.match(await profile.locator('.ua-division-facts').innerText(), new RegExp(capital));
    const names = await profile.locator('h3').filter({hasText: 'Constituent tehsils'}).evaluate(heading => [...heading.nextElementSibling.querySelectorAll('li')].map(li => li.childNodes[0].textContent.trim()));
    assert.deepEqual(names.sort(), [...tehsils].sort());
    assert.match(await profile.innerText(), overview.provinces.find(p => p.id === 'punjab').hypotheticalPopulation ? /Estimated population · fictional/ : /Population, density and religious totals are unavailable/);
    if (name === 'Hazarawala') assert.match(await profile.innerText(), /new fictional commemorative district name|not an ancient name/);
    assert.equal(JSON.parse(await page.locator('.ua-map').getAttribute('data-province-details')).punjab, 'district');
    await page.waitForTimeout(750); // Let the existing fit-bounds animation finish.
    await snapshot('district-' + id.replace('punjab-d-', ''));
  }
  await picker.selectOption('');
  const overviewPanel = page.getByLabel('Punjab district rankings and directory');
  await overviewPanel.waitFor();
  assert.match(await overviewPanel.innerText(), /48 districts/);
  assert.match(await overviewPanel.innerText(), overview.provinces.find(p => p.id === 'punjab').hypotheticalPopulation ? /7(?:\.0+)? crore/ : /Unavailable for the current boundaries/);
  await snapshot('punjab-48-directory');
  for (const [term, name] of [['Khado Khel', 'Ranigat'], ['Khudu Khel', 'Ranigat'], ['Lahor', 'Hund'], ['Topi', 'Mahabanpur'], ['Lower Tanawal', 'Sherwan'], ['Lora', 'Haro'], ['Baffa-Pakhal', 'Pakhli']]) {
    await search(term, name, 'Tehsil / subdistrict');
    const profile = page.getByLabel('Punjab tehsil name history');
    await profile.getByRole('heading', {name, exact: true}).waitFor();
    assert.match(await profile.innerText(), /Old name:/);
  }
  await snapshot('renamed-tehsil-pakhli');
  await page.getByRole('button', {name: 'National overview', exact: true}).click();
  await search('Khyber Pakhtunkhwa', 'Khyber Pakhtunkhwa');
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  await ready();
  await search('Amb', 'Amb');
  const ambProfile = page.getByLabel('Amb province information');
  await ambProfile.waitFor();
  assert.match(await ambProfile.innerText(), /Union territory/);
  assert.match(await ambProfile.innerText(), /Darband/);
  assert.match(await ambProfile.innerText(), /Shergarh/);
  assert.match(await ambProfile.innerText(), /Phulra/);
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  await ready();
  const enabled = JSON.parse(await page.locator('.ua-map').getAttribute('data-province-details'));
  assert.equal(enabled.punjab, 'tehsil');
  assert.equal(enabled.kp, 'tehsil');
  assert.equal(enabled.amb, 'tehsil');
  await snapshot('amb-ut-national-detail');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download map', exact: true}).click();
  await page.getByRole('button', {name: /^Current view/}).click();
  const download = await downloadPromise;
  await download.saveAs('outputs/private-atlas/amb-national.png');
  const png = await fs.readFile('outputs/private-atlas/amb-national.png');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  await page.getByRole('button', {name: 'Collapse information panel', exact: true}).click();
  assert.equal(await page.locator('.ua-sidebar').isVisible(), false);
  await page.getByRole('button', {name: 'Expand information panel', exact: true}).click();
  await search('Abbottabad', 'Haripur', 'District');
  await page.getByLabel('Haripur district profile').waitFor();
  await page.setViewportSize({width: 390, height: 844});
  await snapshot('haripur-mobile');
  const bodyWidth = await page.evaluate(() => document.querySelector('.ua-dialog').scrollWidth);
  assert.ok(bodyWidth <= 392, 'Mobile dialog does not overflow');
  assert.deepEqual(errors, []);
  await fs.writeFile('outputs/private-atlas/reorganization-browser-check.json', JSON.stringify({districts: 48, oldNameSearches: 7, multiProvinceDetail: enabled, uploadedPalette: true, pngExport: true, independentAmb: true, sidebarToggle: true, mobile: true, pageErrors: errors}, null, 2));
  console.log('Verified 48-district directory, 7/7/3 tehsil profiles and capitals, seven old-name searches, Amb UT, simultaneous Punjab/KP/Amb detail, uploaded hex palette, PNG download, sidebar collapse/expand and mobile layout.');
} finally {
  await browser.close();
}
