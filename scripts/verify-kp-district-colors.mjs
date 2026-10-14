import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadLocalModule} from './load-map-model.mjs';

const {styleKpDetailFeatures, nationalBorderColor} = await loadLocalModule(new URL('../app/private-atlas-detail.ts', import.meta.url));
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1600, height: 1100}, acceptDownloads: true});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:4545/';
await fs.mkdir('outputs/kp-colors', {recursive: true});

async function detail(id, level) {
  const features = [];
  let offset = 0;
  do {
    const response = await context.request.get(url + `api/private-atlas?action=detail&province=${id}&level=${level}&offset=${offset}`);
    assert.equal(response.status(), 200);
    const result = await response.json();
    features.push(...result.features);
    offset = result.next;
  } while (offset !== null);
  return {type: 'FeatureCollection', features};
}
async function open() {
  await page.getByRole('button', {name: 'My maps', exact: true}).click();
  await page.getByRole('button', {name: 'Open custom map', exact: true}).click();
  await page.getByRole('button', {name: 'National overview', exact: true}).waitFor();
}
async function choose(name) {
  await page.getByLabel('Find a province or capital').fill(name);
  await page.locator('.ua-search li button').filter({hasText: name}).first().click();
}
async function ready(level) {
  await page.waitForFunction(level => {
    const map = document.querySelector('.ua-map');
    return JSON.parse(map?.getAttribute('data-province-details') || '{}').kp === level &&
      map?.getAttribute('aria-busy') === 'false' &&
      !document.querySelector('.ua-map-caption')?.textContent.includes('Loading');
  }, level, {timeout: 120000});
}
function project(coordinates, bounds, box) {
  const x = lon => (lon + 180) / 360;
  const y = lat => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2;
  const [west, south, east, north] = bounds;
  const scale = Math.min((box.width - 140) / (x(east) - x(west)), (box.height - 140) / (y(south) - y(north)));
  return [box.width / 2 + (x(coordinates[0]) - (x(west) + x(east)) / 2) * scale,
    box.height / 2 + (y(coordinates[1]) - (y(south) + y(north)) / 2) * scale];
}
function vertices(collection) {
  return collection.features.flatMap(feature => feature.geometry.type === 'Polygon' ?
    feature.geometry.coordinates.flat() : feature.geometry.coordinates.flat(2));
}
const rgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
function displayedRgb(hex, province) {
  return rgb(hex).map((channel, index) => Math.round(channel * 0.9 +
    (rgb(province.color)[index] * 0.84 + rgb('#eaf0f2')[index] * 0.16) * 0.1));
}
async function pixelMatches(probes, radius = 3) {
  const buffer = await page.locator('.ua-map canvas').first().screenshot();
  return page.evaluate(async ({encoded, probes, radius}) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + encoded;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return probes.map(({point, color}) => {
      let matches = 0;
      for (let y = Math.round(point[1]) - radius; y <= Math.round(point[1]) + radius; y++)
        for (let x = Math.round(point[0]) - radius; x <= Math.round(point[0]) + radius; x++) {
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
          const offset = (y * canvas.width + x) * 4;
          if (color.every((channel, index) => Math.abs(channel - pixels[offset + index]) <= 4)) matches++;
        }
      return matches;
    });
  }, {encoded: buffer.toString('base64'), probes, radius});
}

try {
  await page.goto(url, {waitUntil: 'networkidle', timeout: 120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout: 120000});
  const overviewResponse = await context.request.get(url + 'api/private-atlas?action=overview');
  assert.equal(overviewResponse.status(), 200);
  const overview = await overviewResponse.json();
  const kp = overview.provinces.find(province => province.id === 'kp');
  const [districts, tehsils, kpOutline, punjabOutline] = await Promise.all([
    detail('kp', 'district'), detail('kp', 'tehsil'), detail('kp', 'province'), detail('punjab', 'province'),
  ]);
  const kpStyle = {...kp, color: kpOutline.features[0].properties.color};
  const original = JSON.stringify([districts, tehsils]);
  const styledDistricts = styleKpDetailFeatures(districts, districts, 'district', {});
  const districtColors = new Map(styledDistricts.features.map(feature => [feature.properties.id, feature.properties.color]));
  assert.equal(new Set(districtColors.values()).size, districts.features.length, 'Every KP district has a distinct default color');
  const styledTehsils = styleKpDetailFeatures(tehsils, districts, 'tehsil', {});
  for (const feature of styledTehsils.features)
    assert.equal(feature.properties.color, districtColors.get(feature.properties.parentDistrictId), feature.properties.name + ' inherits its district color');
  const reordered = styleKpDetailFeatures({...districts, features: [...districts.features].reverse()}, districts, 'district', {});
  for (const feature of reordered.features) assert.equal(feature.properties.color, districtColors.get(feature.properties.id));
  const legacy = {...tehsils, features: tehsils.features.map(feature => ({...feature, properties: {...feature.properties, parentDistrictId: undefined}}))};
  const legacyStyled = styleKpDetailFeatures(legacy, districts, 'tehsil', {});
  assert.deepEqual(legacyStyled.features.map(feature => feature.properties.color), styledTehsils.features.map(feature => feature.properties.color));
  assert.equal(JSON.stringify([districts, tehsils]), original, 'Geometry and source records are unchanged');
  console.log(`Verified ${districts.features.length} distinct district colors and all ${tehsils.features.length} linked tehsil colors, including legacy parent links.`);

  await open();
  await choose(kp.name);
  await page.getByLabel('Administrative detail view').selectOption('district');
  await ready('district');
  await page.getByRole('button', {name: 'Explore province', exact: true}).click();
  await ready('district');
  await page.getByRole('button', {name: 'Names on', exact: true}).click();
  if (await page.getByRole('button', {name: 'Places on', exact: true}).count())
    await page.getByRole('button', {name: 'Places on', exact: true}).click();
  await page.mouse.move(0, 0);
  await page.locator('.ua-map[aria-busy=false]').waitFor();
  await page.screenshot({path: 'outputs/kp-colors/kp-districts.png'});
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  await ready('tehsil');
  const box = await page.locator('.ua-map').boundingBox();
  const siblings = styledTehsils.features.filter(feature => feature.properties.district === 'Mardan');
  const examples = siblings.filter(feature => ['Katlang', 'Rustam'].includes(feature.properties.name));
  assert.equal(examples.length, 2);
  const probes = examples.map(feature => ({point: project(feature.properties.center, kp.bbox, box), color: displayedRgb(feature.properties.color, kpStyle)}));
  const siblingPixels = await pixelMatches(probes);
  await page.screenshot({path: 'outputs/kp-colors/kp-tehsils.png'});
  assert.ok(siblingPixels.every(count => count > 5), 'Two rendered Mardan tehsils share their district color: ' + JSON.stringify({probes, siblingPixels}));

  const punjabVertices = new Set(vertices(punjabOutline).map(point => point.map(value => value.toFixed(6)).join(',')));
  const shared = vertices(kpOutline).filter(point => punjabVertices.has(point.map(value => value.toFixed(6)).join(',')));
  assert.ok(shared.length > 10, 'Source provinces have a shared border');
  const borderProbes = shared.filter((_, index) => index % Math.max(1, Math.floor(shared.length / 100)) === 0)
    .map(point => ({point: project(point, kp.bbox, box), color: rgb(nationalBorderColor)}));
  assert.ok((await pixelMatches(borderProbes)).filter(count => count > 0).length > 10, 'Dark Punjab/KP border remains above colored tehsil fills');
  await page.screenshot({path: 'outputs/kp-colors/kp-tehsils.png'});

  const target = examples[0];
  const clickBox = await page.locator('.ua-map').boundingBox();
  const point = project(target.properties.center, kp.bbox, clickBox);
  await page.mouse.click(clickBox.x + point[0], clickBox.y + point[1]);
  await page.locator('.ua-detail-popup strong').filter({hasText: target.properties.name}).waitFor();
  const input = page.getByLabel('Area fill color');
  assert.equal((await input.inputValue()).toLowerCase(), target.properties.color.toLowerCase());
  await input.fill('#cc3344');
  await page.waitForFunction(id => JSON.parse(localStorage.getItem('private-atlas-map-colors-v1')).fills[id] === '#cc3344', target.properties.parentDistrictId);
  await page.getByRole('button', {name: 'Close area detail', exact: true}).click();
  await page.mouse.move(0, 0);
  await page.locator('.ua-map[aria-busy=false]').waitFor();
  assert.ok((await pixelMatches(probes.map(probe => ({...probe, color: displayedRgb('#cc3344', kpStyle)})))).every(count => count > 5), 'Editing one tehsil recolors both sibling tehsils');
  await page.getByLabel('Administrative detail view').selectOption('district');
  await ready('district');
  assert.ok((await pixelMatches([{point, color: displayedRgb('#cc3344', kpStyle)}]))[0] > 5, 'District view retains the inherited custom color');

  await choose('Punjab');
  await page.getByLabel('Administrative detail view').selectOption('district');
  await page.waitForFunction(() => {
    const map = document.querySelector('.ua-map');
    const levels = JSON.parse(map?.getAttribute('data-province-details') || '{}');
    return levels.punjab === 'district' && levels.kp === 'district' && map?.getAttribute('aria-busy') === 'false';
  });
  await page.getByRole('button', {name: 'National overview', exact: true}).click();
  await page.locator('.ua-map[aria-busy=false]').waitFor();
  await page.screenshot({path: 'outputs/kp-colors/national-punjab-kp.png'});
  await page.getByRole('button', {name: 'Download map', exact: true}).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('group', {name: 'Map download options'}).getByRole('button', {name: 'Current view'}).click();
  const download = await downloadEvent;
  await download.saveAs('outputs/kp-colors/national-punjab-kp-export.png');
  const bytes = await fs.readFile('outputs/kp-colors/national-punjab-kp-export.png');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

  await page.reload({waitUntil: 'networkidle', timeout: 120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout: 120000});
  await open();
  await ready('district');
  await choose(kp.name);
  await page.getByRole('button', {name: 'Explore province', exact: true}).click();
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  await ready('tehsil');
  await page.getByRole('button', {name: 'Names on', exact: true}).click();
  if (await page.getByRole('button', {name: 'Places on', exact: true}).count())
    await page.getByRole('button', {name: 'Places on', exact: true}).click();
  await page.mouse.move(0, 0);
  await page.locator('.ua-map[aria-busy=false]').waitFor();
  const restoredBox = await page.locator('.ua-map').boundingBox();
  const restoredProbes = examples.map(feature => ({point: project(feature.properties.center, kp.bbox, restoredBox), color: displayedRgb('#cc3344', kpStyle)}));
  assert.ok((await pixelMatches(restoredProbes)).every(count => count > 5), 'Custom district color survives reload in tehsil view');
  assert.equal(await page.locator('.ua-map-error').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Verified actual canvas colors, sibling recoloring, dark shared state border, mixed national detail, PNG export and saved colors after reload.');
} catch (cause) {
  await page.screenshot({path: 'outputs/kp-colors/failure.png'}).catch(() => {});
  console.error('Visible selection:', await page.locator('.ua-breadcrumb').innerText().catch(() => 'none'));
  console.error('Area popup:', await page.locator('.ua-detail-popup').innerText().catch(() => 'none'));
  throw cause;
} finally {
  await browser.close();
}
