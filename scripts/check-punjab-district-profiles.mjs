import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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
console.log(
  '49 district allocations, exact province totals, geography and attributed galleries verified.',
);
