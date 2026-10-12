import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { loadMapModel, loadLocalModule } from './load-map-model.mjs';
let populationFixture;
try {
  populationFixture = JSON.parse(
    await fs.readFile('private/united-atlas/population-check.json', 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:4546/';
const model = await loadMapModel(),
  scope = await loadLocalModule(
    new URL('../app/scope-model.ts', import.meta.url),
  );
const area = model.areas.find(
  (a) => a.region === 'in-punjab' && a.level === 'district',
);
const seed = model.validate({
  ...model.initial,
  ...scope.scopePreset(model.initial, 'single', { scopeRegion: 'in-punjab' }),
  title: 'Private atlas regression draft',
  fills: { [area.id]: { color: '#AFC7B1', pattern: 'solid' } },
});
const key = 'punjab-studio-regional-v2',
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
await context.addInitScript(
  ({ key, seed }) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify(seed));
  },
  { key, seed },
);
const page = await context.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await fs.mkdir('outputs/private-atlas', { recursive: true });
async function open() {
  await page.getByRole('button', { name: 'My maps', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open custom map', exact: true })
    .click();
}
async function login(target = page) {
  await target
    .getByRole('button', { name: 'National overview', exact: true })
    .waitFor();
  await target.waitForFunction(
    () =>
      !document
        .querySelector('.ua-map-caption')
        ?.textContent.includes('Loading'),
  );
  await target.locator('.ua-map[aria-busy=false]').waitFor();
}
async function choose(name) {
  await page.getByLabel('Find a province or capital').fill(name);
  await page
    .locator('.ua-search li button')
    .filter({ hasText: name })
    .first()
    .click();
  await page.locator('.ua-profile h2').filter({ hasText: name }).waitFor();
}
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('.gl-host[aria-busy=false]').waitFor({ timeout: 120000 });
  const draft = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    key,
  );
  await open();
  assert.equal(await page.getByLabel('Access password').count(), 0);
  assert.equal(
    await page.getByRole('button', { name: 'Lock map', exact: true }).count(),
    0,
  );
  await login();
  const api = await context.request.get(
    url + 'api/private-atlas?action=overview',
  );
  assert.equal(api.status(), 200);
  const data = await api.json();
  assert.equal(data.provinces.length, 42);
  const atlasBounds = await page.locator('.ua-dialog').first().boundingBox();
  assert.equal(Math.round(atlasBounds.x), 0);
  assert.equal(Math.round(atlasBounds.y), 0);
  assert.equal(Math.round(atlasBounds.width), 1440);
  assert.equal(Math.round(atlasBounds.height), 1000);
  await page.screenshot({ path: 'outputs/private-atlas/national-desktop.png' });
  assert.equal(
    await page.getByLabel('Administrative detail view').inputValue(),
    'province',
  );
  assert.ok(await page.getByLabel('Administrative detail view').isDisabled());
  // Desktop hover is a real pointer operation over a calculated inside point.
  const box = await page.locator('.ua-map').boundingBox(),
    p = data.provinces.find((p) => p.id === 'in-maharashtra');
  const x = (lon) => (lon + 180) / 360,
    y = (lat) =>
      (1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
      2;
  const [a, b, c, d] = data.bbox,
    scale = Math.min(
      (box.width - 140) / (x(c) - x(a)),
      (box.height - 140) / (y(b) - y(d)),
    );
  await page.mouse.move(
    box.x + box.width / 2 + (x(p.center[0]) - (x(a) + x(c)) / 2) * scale,
    box.y + box.height / 2 + (y(p.center[1]) - (y(b) + y(d)) / 2) * scale,
  );
  await page
    .locator('.ua-profile h2')
    .filter({ hasText: 'Maharashtra' })
    .waitFor();
  await choose('Punjab');
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.ua-map-caption')
        ?.textContent.includes('Loading'),
  );
  await page
    .locator('.ua-gallery img')
    .evaluate((img) => img.decode().catch(() => {}));
  await page.screenshot({ path: 'outputs/private-atlas/punjab-desktop.png' });
  const profileText = await page.locator('.ua-profile').innerText();
  assert.ok(profileText.includes('hypothetical heart of Sikhs in India'));
  assert.ok(profileText.includes('Proposed official languages'));
  assert.ok(profileText.includes('Punjabi (Gurmukhi), Hindi, Urdu'));
  assert.ok(profileText.includes('Hypothetical population'));
  for (const label of populationFixture?.totalLabels || [])
    assert.ok(profileText.includes(label));
  const populationPanel = page.locator('.ua-scenario-population');
  for (const expected of populationFixture?.religionLabels || [])
    assert.ok((await populationPanel.innerText()).includes(expected));
  await populationPanel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'outputs/private-atlas/punjab-population-desktop.png',
  });
  assert.ok(!profileText.includes('Flag / emblem'));
  assert.ok(!profileText.includes('Area method'));
  for (const subject of [
    'Golden Temple at night',
    'Nankana Sahib',
    'Lahore Fort',
    'Murree',
    'Kartarpur',
  ]) {
    assert.ok(
      (await page.locator('.ua-gallery figcaption').innerText()).includes(
        subject,
      ),
    );
    await page.locator('.ua-gallery img').evaluate((img) => img.decode());
    assert.ok(
      await page
        .locator('.ua-gallery img')
        .evaluate((img) => img.naturalWidth > 0 && !img.hidden),
    );
    await page
      .getByRole('button', { name: 'Next province photograph', exact: true })
      .click();
  }
  assert.ok(
    (await page.locator('.ua-gallery figcaption').innerText()).includes(
      'Golden Temple at night',
    ),
  );
  await page.getByLabel('Administrative detail view').selectOption('division');
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.ua-map-caption')
        ?.textContent.includes('Loading'),
  );
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'outputs/private-atlas/divisions-desktop.png',
  });
  await page.getByLabel('Administrative detail view').selectOption('district');
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.ua-map-caption')
        ?.textContent.includes('Loading'),
  );
  await page.getByLabel('Administrative detail view').selectOption('tehsil');
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.ua-map-caption')
        ?.textContent.includes('Loading'),
  );
  const tehsilColorMode = page.getByLabel('Punjab tehsil color mode');
  assert.equal(await tehsilColorMode.inputValue(), 'district');
  assert.ok(
    (await page.locator('.ua-map-caption').innerText()).includes(
      'color by district',
    ),
  );
  await tehsilColorMode.selectOption('tehsil');
  assert.ok(
    (await page.locator('.ua-map-caption').innerText()).includes(
      'color by tehsil',
    ),
  );
  await tehsilColorMode.selectOption('district');
  await page.waitForTimeout(400); // MapLibre applies paged source changes asynchronously.
  const tehsilCanvas = page.locator('.ua-map canvas').first();
  const tehsilBounds = await tehsilCanvas.boundingBox();
  for (const [x, y] of [
    [0.5, 0.5],
    [0.35, 0.5],
    [0.65, 0.5],
    [0.5, 0.35],
    [0.5, 0.65],
  ]) {
    await tehsilCanvas.click({
      position: { x: tehsilBounds.width * x, y: tehsilBounds.height * y },
    });
    if (
      (await page.getByLabel('Punjab tehsil name history').count()) &&
      (await page.getByLabel('Punjab palette color').isEnabled())
    )
      break;
  }
  const tehsilProfile = page.getByLabel('Punjab tehsil name history');
  assert.ok(
    await tehsilProfile.count(),
    'selecting a tehsil opens its sidebar history',
  );
  const tehsilText = await tehsilProfile.innerText();
  assert.ok(
    tehsilText.includes('Old name:') && tehsilText.includes('Meaning:'),
  );
  assert.match(tehsilText, /Old name:\s+\S/);
  assert.ok(tehsilText.includes('Name and history'));
  const palettePicker = page.getByLabel('Punjab palette color');
  assert.ok(await palettePicker.isEnabled());
  assert.equal(await palettePicker.locator('option').count(), 46);
  await palettePicker.selectOption('#D79DA0');
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Area fill color"]')?.value ===
      '#d79da0',
  );
  await tehsilColorMode.selectOption('tehsil');
  await palettePicker.selectOption('#A9C7DD');
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Area fill color"]')?.value ===
      '#a9c7dd',
  );
  await tehsilColorMode.selectOption('district');
  await tehsilProfile
    .getByRole('button', { name: 'Back to Punjab tehsils' })
    .click();
  await page
    .getByRole('button', { name: 'National overview', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('Administrative detail view').inputValue(),
    'province',
  );
  for (const [term, provinceName] of [
    ['Gilgit-Baltistan', 'United Jammu and Kashmir'],
    ['Siachen', 'United Jammu and Kashmir'],
    ['Shaksgam Valley', 'United Jammu and Kashmir'],
    ['Aksai Chin', 'Ladakh–Aksai Chin'],
  ]) {
    await page.getByLabel('Find a province or capital').fill(term);
    await page
      .locator('.ua-search li button')
      .filter({ hasText: provinceName })
      .click();
    await page
      .locator('.ua-profile h2')
      .filter({ hasText: provinceName })
      .waitFor();
    if (term === 'Shaksgam Valley') {
      await page.waitForFunction(
        () =>
          !document
            .querySelector('.ua-map-caption')
            ?.textContent.includes('Loading'),
      );
      // Let the province fit animation finish before inspecting its new extent.
      await page.waitForTimeout(800);
      assert.ok(
        (await page.locator('.ua-profile').innerText()).includes(
          'Shaksgam Valley',
        ),
      );
    }
    await page.screenshot({
      path: 'outputs/private-atlas/north-' + term.replace(/\W/g, '-') + '.png',
    });
  }
  await choose('Tamil Nadu');
  await page
    .getByRole('button', { name: 'Use dark map theme', exact: true })
    .click();
  await page.getByRole('button', { name: 'Names on', exact: true }).click();
  await page
    .getByRole('button', { name: 'Boundary context', exact: true })
    .click();
  await page.screenshot({ path: 'outputs/private-atlas/south-dark.png' });
  assert.equal(
    await page
      .getByRole('button', { name: 'Boundary context', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page
    .getByRole('button', { name: 'Research & changes', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Administrative change table', exact: true })
    .waitFor();
  await page.getByLabel('Search administrative changes').fill('Panja');
  assert.ok(
    await page
      .locator('.ua-research tbody')
      .last()
      .innerText()
      .then((s) => s.includes('Panja Sahib')),
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  await (
    await download
  ).saveAs('outputs/private-atlas/administrative-changes.csv');
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page
    .getByRole('button', { name: 'Close custom atlas', exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key),
    draft,
  );
  await open();
  await page
    .getByRole('button', { name: 'National overview', exact: true })
    .waitFor();
  assert.equal(await page.getByLabel('Access password').count(), 0);
  assert.equal(
    (
      await context.request.get(url + 'api/private-atlas?action=overview')
    ).status(),
    200,
  );
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  mobilePage.setDefaultTimeout(45000);
  mobilePage.on('pageerror', (e) => errors.push(e.message));
  await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await mobilePage
    .locator('.gl-host[aria-busy=false]')
    .waitFor({ timeout: 120000 });
  await mobilePage
    .getByRole('button', { name: 'My maps', exact: true })
    .click();
  await mobilePage
    .getByRole('button', { name: 'Open custom map', exact: true })
    .click();
  await login(mobilePage);
  // Tap an actual interior point using a real touch-enabled mobile context.
  const mobileBox = await mobilePage.locator('.ua-map').boundingBox();
  const pp = data.provinces.find((p) => p.id === 'punjab');
  const ms = Math.min(
    (mobileBox.width - 60) / (x(c) - x(a)),
    (mobileBox.height - 95) / (y(b) - y(d)),
  );
  await mobilePage.touchscreen.tap(
    mobileBox.x +
      mobileBox.width / 2 +
      (x(pp.center[0]) - (x(a) + x(c)) / 2) * ms,
    mobileBox.y +
      mobileBox.height / 2 -
      2.5 +
      (y(pp.center[1]) - (y(b) + y(d)) / 2) * ms,
  );
  await mobilePage
    .locator('.ua-profile h2')
    .filter({ hasText: 'Punjab' })
    .waitFor();
  await mobilePage.screenshot({
    path: 'outputs/private-atlas/punjab-mobile.png',
  });
  await mobilePage.locator('.ua-scenario-population').scrollIntoViewIfNeeded();
  for (const label of populationFixture?.religionLabels || [])
    assert.ok(
      (
        await mobilePage.locator('.ua-scenario-population').innerText()
      ).includes(label),
    );
  await mobilePage.screenshot({
    path: 'outputs/private-atlas/punjab-population-mobile.png',
  });
  assert.ok(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  const bounds = await mobilePage.locator('.ua-dialog').first().boundingBox();
  assert.equal(Math.round(bounds.width), 390);
  await mobilePage.getByLabel('Find a province or capital').fill('Bahawalpur');
  await mobilePage.locator('.ua-search li button').first().click();
  assert.ok(
    await mobilePage
      .locator('.ua-profile')
      .innerText()
      .then((s) => s.includes('Rahim Yar Khan')),
  );
  await mobile.close();
  for (const path of [
    'private/united-atlas/atlas.json',
    'server/private-atlas.enc',
    '.env.local',
  ]) {
    const r = await context.request.get(url + path);
    assert.ok([403, 404].includes(r.status()), path + ' denied');
  }
  assert.deepEqual(errors, []);
  console.log(
    'Verified direct password-free opening, national map, desktop hover, province search, detail layers, photos, themes, source research/CSV, close/reopen, mobile layout and preserved editor draft.',
  );
} catch (error) {
  console.error('Private atlas browser errors:', errors);
  await page
    .screenshot({ path: 'outputs/private-atlas/failure.png' })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
