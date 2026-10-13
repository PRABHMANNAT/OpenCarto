import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { loadLocalModule } from './load-map-model.mjs';

const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:4545/';
const editor = await loadLocalModule(
  new URL('../app/private-atlas-districts.ts', import.meta.url),
);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await fs.mkdir('outputs/punjab-rankings', { recursive: true });

async function checkRanking(selector, records, value) {
  const ranked = [...records].sort(
    (a, b) => value(b) - value(a) || a.name.localeCompare(b.name),
  );
  const list = page.locator(selector);
  assert.equal(await list.locator('li').count(), ranked.length);
  assert.deepEqual(
    await list.locator('strong').allTextContents(),
    ranked.map((record) => record.name),
  );
  assert.deepEqual(
    await list.locator('b').allTextContents(),
    ranked.map((_, i) => String(i + 1)),
  );
  assert.deepEqual(
    await list
      .locator('em')
      .evaluateAll((items) => items.map((item) => item.title)),
    ranked.map((record) => value(record).toLocaleString('en-IN')),
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
  const overview = page.getByRole('article', {
    name: 'Punjab district rankings and directory',
  });
  await overview.locator('.ua-district-area-ranking li').nth(46).waitFor();
  const source = { type: 'FeatureCollection', features: [] };
  let offset = 0;
  do {
    const response = await page.request.get(
      url +
        'api/private-atlas?action=detail&province=punjab&level=district&offset=' +
        offset,
    );
    assert.equal(response.status(), 200);
    const data = await response.json();
    source.features.push(...data.features);
    offset = data.next;
  } while (offset !== null);
  const edits = editor.defaultDistrictEdits();
  const displayed = editor.styleDistrictFeatures(
    editor.mergeDistrictFeatures(source, edits.groups),
    source,
    edits,
  );
  const districts = displayed.features.map((feature) => feature.properties);
  const religiousShare = (name, religion) => {
    const district = districts.find((item) => item.name === name);
    return (
      district.hypotheticalDemographics.religions.find(
        (item) => item.name === religion,
      ).population / district.hypotheticalDemographics.total
    );
  };
  assert.ok(religiousShare('Taxila', 'Buddhism') >= 0.2);
  assert.ok(religiousShare('Katas', 'Hinduism') >= 0.35);
  for (const name of [
    'Amritsar',
    'Kartarpur Sahib',
    'Nankana Sahib',
    'Sri Anandpur Sahib',
    'Tarn Taran',
    'Sandalbar',
    'Lahore',
  ])
    assert.ok(
      religiousShare(name, 'Sikhism') >= 0.9,
      name + ' Sikh majority is served by the API',
    );
  const divisions = editor.summarizeDistrictDivisions(displayed.features);
  assert.equal(districts.length, 47);
  assert.equal(
    await page
      .getByLabel('Show separate Punjab district')
      .locator('option')
      .count(),
    48,
  );
  assert.equal(
    Number(await page.locator('.ua-map').getAttribute('data-detail-count')),
    47,
  );
  assert.match(
    await overview.locator('.ua-profile-heading p').innerText(),
    /47 districts · 11 divisions/,
  );
  assert.deepEqual(
    await overview.locator('.ua-ranking-section h3').allTextContents(),
    [
      'District area ranking',
      'District population ranking · fictional',
      'Division area ranking',
      'Division population ranking · fictional',
      'Top 10 districts by Sikh population',
    ],
  );
  await checkRanking('.ua-district-area-ranking', districts, (d) => d.areaKm2);
  await checkRanking(
    '.ua-district-population-ranking',
    districts,
    (d) => d.hypotheticalDemographics.total,
  );
  await checkRanking('.ua-division-area-ranking', divisions, (d) => d.areaKm2);
  await checkRanking(
    '.ua-division-population-ranking',
    divisions,
    (d) => d.hypotheticalDemographics.total,
  );
  assert.equal(
    districts.reduce((n, d) => n + d.hypotheticalDemographics.total, 0),
    79600000,
  );
  assert.equal(
    divisions.reduce((n, d) => n + d.districtCount, 0),
    47,
  );
  await page.screenshot({
    path: 'outputs/punjab-rankings/district-area-desktop.png',
  });
  const picker = page.getByLabel('Top 10 districts by religion population');
  assert.equal(await picker.inputValue(), 'Sikhism');
  assert.deepEqual(
    await picker
      .locator('option')
      .evaluateAll((options) => options.map((option) => option.value)),
    [
      'Sikhism',
      'Hinduism',
      'Islam',
      'Christianity',
      'Jainism',
      'Buddhism',
      'Other',
    ],
  );
  for (const religion of [
    'Sikhism',
    'Hinduism',
    'Islam',
    'Christianity',
    'Jainism',
    'Buddhism',
    'Other',
  ]) {
    await picker.selectOption(religion);
    const value = (d) =>
      d.hypotheticalDemographics.religions.find((r) => r.name === religion)
        .population;
    const top10 = [...districts]
      .sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name))
      .slice(0, 10);
    await checkRanking('.ua-district-religion-ranking', top10, value);
    if (religion === 'Buddhism')
      assert.equal(
        await page
          .locator('.ua-district-religion-ranking strong')
          .first()
          .innerText(),
        'Taxila',
      );
  }
  await picker.selectOption('Hinduism');
  await picker.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'outputs/punjab-rankings/religion-desktop.png',
  });
  await overview.locator('.ua-district-directory-section summary').click();
  assert.equal(
    await overview.locator('.ua-district-directory tbody tr').count(),
    47,
  );
  const names = await overview
    .locator('.ua-district-directory tbody td:first-child')
    .allTextContents();
  assert.ok(!names.includes('Chakwal') && !names.includes('Narowal'));
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b)),
  );
  // Merged profiles and district isolation must share their totals and map geometry.
  for (const group of edits.groups) {
    await page
      .getByLabel('Show separate Punjab district')
      .selectOption(group.id);
    const district = districts.find((d) => d.id === group.id);
    const profile = page.getByRole('article', {
      name: district.name + ' district profile',
    });
    assert.ok(
      (await profile.innerText()).includes(
        district.hypotheticalDemographics.total.toLocaleString('en-IN'),
      ),
    );
    assert.match(await profile.innerText(), /Area rank\s+#\d+ of 47/);
    assert.match(
      await profile.innerText(),
      /Population rank · fictional\s+#\d+ of 47/,
    );
    assert.equal(
      Number(await page.locator('.ua-map').getAttribute('data-detail-count')),
      1,
    );
  }
  await page.getByLabel('Administrative detail view').selectOption('division');
  await page.locator('.ua-division-area-ranking li').nth(10).waitFor();
  await checkRanking('.ua-division-area-ranking', divisions, (d) => d.areaKm2);
  await checkRanking(
    '.ua-division-population-ranking',
    divisions,
    (d) => d.hypotheticalDemographics.total,
  );
  for (const division of divisions) {
    const divisionPicker = page.getByLabel('Choose Punjab division');
    const id = await divisionPicker
      .locator('option')
      .evaluateAll(
        (options, name) =>
          options.find((option) => option.textContent === name)?.value,
        division.name,
      );
    assert.ok(id);
    await divisionPicker.selectOption(id);
    assert.equal(
      await page.locator('.ua-division-districts tbody tr').count(),
      division.districtCount,
    );
    assert.match(
      await page.locator('.ua-division-facts').innerText(),
      /Population rank · fictional\s+#\d+ of 11/,
    );
  }
  await page.getByLabel('Administrative detail view').selectOption('district');
  await overview.locator('.ua-district-area-ranking li').nth(46).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await picker.selectOption('Buddhism');
  await picker.scrollIntoViewIfNeeded();
  const bounds = await picker.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.screenshot({
    path: 'outputs/punjab-rankings/religion-mobile.png',
  });
  assert.equal(await page.locator('.ua-map-error').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'Verified 47 district area/population rankings, 11 division rankings/profiles, all seven top-10 religion filters, merged profiles, map isolation, directory and mobile layout.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'outputs/punjab-rankings/failure.png' })
    .catch(() => {});
  console.error('Ranking browser errors:', errors);
  throw error;
} finally {
  await browser.close();
}
