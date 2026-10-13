import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { loadLocalModule } from './load-map-model.mjs';
import {
  balancePopulation,
  districtPopulationTargets,
} from './punjab-population-model.mjs';
const atlas = JSON.parse(
  await fs.readFile('private/united-atlas/atlas.json', 'utf8'),
);
const districts = atlas.details.punjab.district.features.map(
  (f) => f.properties,
);
const province = atlas.overview.provinces.find(
  (p) => p.id === 'punjab',
).hypotheticalDemographics;
assert.equal(districts.length, 49);
assert.equal(province.total, 79600000);
assert.deepEqual(
  province.religions.map((r) => r.population),
  [61000000, 16000000, 1700000, 400000, 200000, 150000, 150000],
);
for (const religion of province.religions)
  assert.equal(
    districts.reduce(
      (n, d) =>
        n +
        d.hypotheticalDemographics.religions.find(
          (r) => r.name === religion.name,
        ).population,
      0,
    ),
    religion.population,
  );
const ranks = new Set();
for (const d of districts) {
  const s = d.hypotheticalDemographics;
  assert.equal(
    s.total,
    s.religions.reduce((n, r) => n + r.population, 0),
  );
  assert.ok(
    s.religions.every(
      (r) => Number.isSafeInteger(r.population) && r.population >= 0,
    ),
  );
  assert.match(s.note, /Fictional/);
  ranks.add(d.populationRank);
  assert.ok(
    d.photos.length >= 3 && d.photos.length <= 4,
    d.name + ' needs 3–4 sourced photos',
  );
  assert.equal(new Set(d.photos.map((p) => p.sourceUrl)).size, d.photos.length);
  assert.ok(
    d.photos.every((p) => p.sourceUrl && p.author && p.license && p.retrieved),
  );
  assert.ok(d.summary.length > 80, d.name + ' requires geographic context');
  assert.ok(
    d.keyCities.every((c) => !/^PK\d+/.test(c)),
    'No geometry identifiers in local centres',
  );
}
assert.equal(ranks.size, 49);
assert.equal(districts.find((d) => d.populationRank === 1).name, 'Lahore');
for (const zone of ['Western Punjab', 'Eastern Punjab']) {
  const ds = districts.filter((d) => d.scenarioZone === zone),
    total = ds.reduce((n, d) => n + d.hypotheticalDemographics.total, 0),
    sikh = ds.reduce(
      (n, d) => n + d.hypotheticalDemographics.religions[0].population,
      0,
    );
  assert.ok(sikh / total > 0.5, zone + ' Sikh majority');
  console.log(zone, ((100 * sikh) / total).toFixed(1) + '% Sikh');
}
assert.equal(
  atlas.details.punjab.division.features.reduce(
    (n, f) => n + f.properties.hypotheticalDemographics.total,
    0,
  ),
  province.total,
);
const editor = await loadLocalModule(
  new URL('../app/private-atlas-districts.ts', import.meta.url),
);
const source = atlas.details.punjab.district;
assert.deepEqual(
  districts.map((district) => district.hypotheticalDemographics.total),
  districtPopulationTargets(districts),
  'Religious redistribution preserves every district population',
);
const example = balancePopulation(
  [13, 17, 23],
  [11, 19, 23],
  [
    [9, 1, 3],
    [2, 11, 4],
    [4, 7, 12],
  ],
);
assert.deepEqual(
  example.map((row) => row.reduce((a, b) => a + b, 0)),
  [13, 17, 23],
);
assert.deepEqual(
  [0, 1, 2].map((column) => example.reduce((sum, row) => sum + row[column], 0)),
  [11, 19, 23],
);
assert.ok(
  example.flat().every((value) => Number.isSafeInteger(value) && value >= 0),
);
assert.deepEqual(
  balancePopulation(
    [13, 17, 23],
    [11, 19, 23],
    [
      [9, 1, 3],
      [2, 11, 4],
      [4, 7, 12],
    ],
  ),
  example,
  'Integer allocations are deterministic',
);
assert.throws(() => balancePopulation([3], [2], [[1]]), /Invalid population/);
const edits = editor.defaultDistrictEdits();
const displayed = editor.styleDistrictFeatures(
  editor.mergeDistrictFeatures(source, edits.groups),
  source,
  edits,
);
assert.equal(displayed.features.length, 47);
const religiousCount = (district, religion) =>
  district.hypotheticalDemographics.religions.find(
    (item) => item.name === religion,
  ).population;
const religiousShare = (district, religion) =>
  religiousCount(district, religion) / district.hypotheticalDemographics.total;
const displayedDistricts = displayed.features.map(
  (feature) => feature.properties,
);
const findDistrict = (name) =>
  displayedDistricts.find((district) => district.name === name);
const taxila = findDistrict('Taxila');
assert.ok(
  religiousShare(taxila, 'Buddhism') >= 0.2,
  'Taxila needs a substantial Buddhist share',
);
assert.ok(
  religiousCount(taxila, 'Buddhism') > 75000,
  'Taxila holds over half the scenario Buddhist population',
);
assert.equal(
  [...displayedDistricts].sort(
    (a, b) => religiousCount(b, 'Buddhism') - religiousCount(a, 'Buddhism'),
  )[0].name,
  'Taxila',
);
assert.ok(religiousShare(findDistrict('Haripur'), 'Buddhism') >= 0.03);
assert.ok(religiousShare(findDistrict('Rawalpindi'), 'Buddhism') >= 0.003);
assert.ok(
  religiousShare(findDistrict('Katas'), 'Hinduism') >= 0.35,
  'Merged Katas needs a substantial Hindu community',
);
assert.ok(religiousCount(findDistrict('Katas'), 'Hinduism') >= 500000);
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
    religiousShare(findDistrict(name), 'Sikhism') >= 0.9,
    name + ' needs a strong Sikh majority',
  );
const sikhRanked = [...displayedDistricts].sort(
  (a, b) => religiousCount(b, 'Sikhism') - religiousCount(a, 'Sikhism'),
);
assert.deepEqual(
  sikhRanked.slice(0, 2).map((district) => district.name),
  ['Lahore', 'Sandalbar'],
);
assert.ok(religiousCount(findDistrict('Lahore'), 'Sikhism') >= 9000000);
assert.ok(religiousCount(findDistrict('Sandalbar'), 'Sikhism') >= 5000000);
assert.ok(
  religiousShare(findDistrict('Sangrur'), 'Islam') >= 0.05,
  'Retained Malerkotla area increases the Sangrur Muslim allocation',
);
assert.ok(religiousShare(findDistrict('Ludhiana'), 'Hinduism') >= 0.3);
assert.ok(
  religiousShare(findDistrict('Gurdaspur'), 'Christianity') >
    400000 / province.total,
);
assert.ok(
  religiousShare(findDistrict('Ludhiana'), 'Jainism') > 200000 / province.total,
);
assert.equal(
  editor.sumDistrictDemographics(displayed.features).total,
  province.total,
);
assert.deepEqual(
  editor.sumDistrictDemographics(displayed.features).religions,
  province.religions,
);
assert.equal(
  new Set(displayed.features.map((f) => f.properties.populationRank)).size,
  47,
);
assert.equal(
  Math.max(...displayed.features.map((f) => f.properties.populationRank)),
  47,
);
for (const group of edits.groups) {
  const members = source.features.filter((f) =>
    group.members.includes(f.properties.id),
  );
  const merged = displayed.features.find(
    (f) => f.properties.id === group.id,
  ).properties;
  const total = members.reduce(
    (n, f) => n + f.properties.hypotheticalDemographics.total,
    0,
  );
  assert.equal(merged.hypotheticalDemographics.total, total);
  assert.deepEqual(
    merged.hypotheticalDemographics,
    editor.sumDistrictDemographics(members),
  );
  assert.equal(
    merged.areaKm2,
    members.reduce((n, f) => n + f.properties.areaKm2, 0),
  );
  assert.equal(
    merged.tehsilCount,
    members.reduce((n, f) => n + f.properties.tehsilCount, 0),
  );
  assert.equal(merged.density, Math.round(total / merged.areaKm2));
  assert.ok(
    !displayed.features.some((f) =>
      group.members.slice(1).includes(f.properties.id),
    ),
  );
}
const summaries = editor.summarizeDistrictDivisions(displayed.features);
assert.equal(summaries.length, 11);
assert.equal(
  summaries.reduce((n, d) => n + d.districtCount, 0),
  47,
);
assert.equal(
  summaries.reduce((n, d) => n + d.hypotheticalDemographics.total, 0),
  province.total,
);
assert.equal(summaries.find((d) => d.name === 'Rawalpindi').districtCount, 6);
assert.equal(summaries.find((d) => d.name === 'Kartarpur').districtCount, 5);
for (const division of atlas.details.punjab.division.features) {
  const summary = summaries.find((d) => d.name === division.properties.name);
  assert.equal(
    summary.hypotheticalDemographics.total,
    division.properties.hypotheticalDemographics.total,
  );
  assert.deepEqual(
    summary.hypotheticalDemographics.religions,
    division.properties.hypotheticalDemographics.religions,
  );
  assert.ok(Math.abs(summary.areaKm2 - division.properties.areaKm2) < 0.1);
}
// Additional saved merges and renames must keep rankings and totals aligned with the map.
const custom = editor.mergeEditedDistricts(
  edits,
  'punjab-d-lahore',
  'punjab-d-nankana-sahib',
  displayed,
);
custom.names['punjab-d-lahore'] = 'Lahore union';
const customized = editor.styleDistrictFeatures(
  editor.mergeDistrictFeatures(source, custom.groups),
  source,
  custom,
);
assert.equal(customized.features.length, 46);
assert.equal(
  customized.features.find((f) => f.properties.id === 'punjab-d-lahore')
    .properties.name,
  'Lahore union',
);
assert.equal(
  editor.sumDistrictDemographics(customized.features).total,
  province.total,
);
assert.equal(
  Math.max(...customized.features.map((f) => f.properties.populationRank)),
  46,
);
assert.equal(source.features.length, 49, 'Original source records stay intact');
console.log(
  '47 displayed districts, heritage-centred religious distribution, exact district and province totals, integer balancing, density, 11 division aggregates and attributed galleries verified.',
);
