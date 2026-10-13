import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { loadLocalModule } from './load-map-model.mjs';
const atlas = JSON.parse(
  await fs.readFile('private/united-atlas/atlas.json', 'utf8'),
);
const editor = await loadLocalModule(
  new URL('../app/private-atlas-districts.ts', import.meta.url),
);
const source = atlas.details.punjab.district;
const edits = editor.defaultDistrictEdits();
const districts = editor.styleDistrictFeatures(
  editor.mergeDistrictFeatures(source, edits.groups),
  source,
  edits,
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
  const picker = page.getByLabel('Show separate Punjab district');
  await picker.locator('option').nth(47).waitFor({ state: 'attached' });
  assert.equal(await picker.locator('option').count(), 48);
  for (const f of districts.features) {
    const d = f.properties;
    await picker.selectOption(d.id);
    const article = page.getByRole('article', {
      name: d.name + ' district profile',
    });
    await article.waitFor();
    const text = await article.innerText();
    assert.match(text, /Religion and population · fictional scenario/);
    assert.ok(
      text.includes(d.hypotheticalDemographics.total.toLocaleString('en-IN')),
    );
    assert.ok(text.includes('#' + d.populationRank + ' of 47'));
    assert.ok(!text.includes('of 49'));
    assert.equal(await article.locator('.ua-demographic').count(), 7);
    assert.equal(await article.locator('.ua-gallery img').count(), 1);
  }
  await picker.selectOption('punjab-d-lahore');
  const image = page.locator('.ua-gallery img');
  await image.evaluate((img) => img.decode());
  for (let i = 1; i < 4; i++) {
    await page
      .getByRole('button', { name: 'Next district photograph' })
      .click();
    await image.evaluate((img) => img.decode());
  }
  await page.getByRole('button', { name: 'Next district photograph' }).click();
  await image.evaluate((img) => img.decode());
  await fs.mkdir('outputs/punjab-districts', { recursive: true });
  await page.screenshot({
    path: 'outputs/punjab-districts/lahore-desktop.png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await picker.selectOption('punjab-d-ludhiana');
  await page
    .getByRole('heading', { name: 'Ludhiana', exact: true })
    .scrollIntoViewIfNeeded();
  await image.evaluate((img) => img.decode());
  await page.screenshot({
    path: 'outputs/punjab-districts/ludhiana-mobile.png',
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    'All 47 displayed district profiles, seven religion rows, merged population, gallery, Lahore photo and mobile layout verified.',
  );
} finally {
  await browser.close();
}
