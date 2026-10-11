import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import { privateAtlasHandler } from '../server/private-atlas.mjs';
import { loadLocalModule } from './load-map-model.mjs';
process.loadEnvFile('.env.local');
let populationFixture;
try {
  populationFixture = JSON.parse(
    await fs.readFile('private/united-atlas/population-check.json', 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const server = createServer(privateAtlasHandler);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port + '/api/private-atlas';
async function call(action, options = {}) {
  const r = await fetch(base + '?action=' + action, options);
  assert.match(r.headers.get('cache-control'), /private, no-store/);
  return r;
}
function ringContains(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function contains(geometry, point) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    ([outer, ...holes]) =>
      ringContains(outer, point) &&
      !holes.some((ring) => ringContains(ring, point)),
  );
}
try {
  // No password hash or session secret is needed to serve this custom map.
  delete process.env.PRIVATE_ATLAS_PASSWORD_HASH;
  delete process.env.PRIVATE_ATLAS_SESSION_SECRET;
  const headers = {};
  assert.equal(
    (
      await call('overview', {
        headers: { Cookie: 'opencarto_private_atlas=obsolete' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call('overview', {
        headers: { Origin: 'https://unrelated.example' },
      })
    ).status,
    403,
  );
  assert.equal((await call('unlock', { method: 'POST' })).status, 405);
  const response = await call('overview', { headers });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(
    Buffer.byteLength(text) < 4_500_000,
    'Overview fits function response limit',
  );
  const data = JSON.parse(text);
  assert.equal(data.provinces.length, 42);
  assert.equal(data.geometry.features.length, 42);
  assert.equal(new Set(data.provinces.map((p) => p.id)).size, 42);
  assert.equal(data.auditSummary.provinceCount, 42);
  assert.equal(data.auditSummary.exactOverlapKm2, 0);
  assert.equal(data.auditSummary.unassignedSourceFootprintKm2, 0);
  for (const p of data.provinces) {
    assert.ok(p.areaKm2 > 0);
    assert.ok(p.overview.split(/\s+/).length >= 150, p.name + ' overview');
    assert.ok(p.photos.length >= 1, p.name + ' licensed photo');
    for (const photo of p.photos) {
      assert.ok(photo.author);
      assert.match(photo.license, /CC BY|Public domain|CC0/);
      assert.ok(photo.sourceUrl.startsWith('https://commons.wikimedia.org/'));
    }
    assert.equal(p.forestArea, null);
    assert.equal(p.forestPercent, null);
    if (p.population !== null) assert.equal(p.census.year, 2011);
  }
  assert.equal(data.provinces.find((p) => p.id === 'punjab').population, null);
  assert.equal(data.provinces.find((p) => p.id === 'punjab').color, '#4A86BD');
  const punjab = data.provinces.find((p) => p.id === 'punjab');
  const scenario = punjab.hypotheticalDemographics;
  assert.ok(Number.isSafeInteger(scenario.total) && scenario.total > 0);
  assert.equal(
    scenario.total,
    scenario.religions.reduce((sum, r) => sum + r.population, 0),
  );
  if (populationFixture) {
    assert.equal(scenario.total, populationFixture.total);
    assert.deepEqual(scenario.religions, populationFixture.religions);
  }
  assert.equal(
    punjab.census,
    null,
    'Hypothetical figures must not become a real census',
  );
  assert.ok(
    data.provinces
      .filter((p) => p.id !== 'punjab')
      .every((p) => !p.hypotheticalDemographics),
  );
  assert.deepEqual(punjab.officialLanguages, [
    'Punjabi (Gurmukhi)',
    'Hindi',
    'Urdu',
  ]);
  assert.equal(punjab.photos.length, 5);
  assert.match(punjab.overview, /hypothetical heart of Sikhs in India/);
  for (const [i, subject] of [
    'Golden Temple at night',
    'Nankana Sahib',
    'Lahore Fort',
    'Murree',
    'Kartarpur',
  ].entries())
    assert.ok(punjab.photos[i].caption.includes(subject));
  assert.ok(!data.provinces.some((p) => p.id === 'gilgit-baltistan'));
  const kashmir = data.provinces.find((p) => p.id === 'jammu-kashmir');
  assert.ok(kashmir.aliases.includes('Gilgit-Baltistan'));
  assert.ok(kashmir.aliases.includes('Siachen'));
  assert.ok(kashmir.aliases.includes('Shaksgam Valley'));
  assert.equal(
    data.contextLabels.features.find(
      (f) => f.properties.id === 'shaksam-valley',
    ).properties.outside,
    false,
  );
  assert.equal(kashmir.detailCounts.district, 44);
  assert.equal(
    data.provinces.find((p) => p.id === 'ladakh').name,
    'Ladakh–Aksai Chin',
  );
  assert.equal(
    data.context.features.find((f) => f.properties.id === 'aksai-chin')
      .properties.outside,
    false,
  );
  assert.ok(data.provinces.some((p) => p.id === 'in-tamil-nadu'));
  assert.ok(data.provinces.some((p) => p.id === 'in-lakshadweep'));
  assert.ok(data.provinces.some((p) => p.id === 'islamabad'));
  const analysis = await (await call('analysis', { headers })).json();
  assert.equal(
    analysis.audit.northernGrouping.secondProvince,
    'Ladakh–Aksai Chin',
  );
  assert.equal(analysis.kpReview.length, 72);
  assert.equal(
    analysis.kpReview.filter((r) => r.decision === 'Transfer proposed').length,
    5,
  );
  assert.ok(
    analysis.kpReview
      .filter((r) => ['Swabi', 'Nowshera'].includes(r.district))
      .every((r) => r.proposedProvince === 'Khyber Pakhtunkhwa'),
  );
  assert.ok(
    analysis.changes
      .filter((r) => r.currentDistrict === 'Rahim Yar Khan')
      .every((r) => r.proposedProvince === 'Bahawalpur'),
  );
  const expected = [
    'Panja Sahib',
    'Kartarpur–Ravi',
    'Katas Raj–Salt Range',
    'Sri Anandpur Sahib',
    'Yazman–Cholistan',
  ];
  for (const name of expected)
    assert.ok(
      analysis.changes.some((r) => r.proposedDistrict === name),
      name + ' assignment documented',
    );
  const punjabDistricts = [];
  for (const id of [
    'punjab',
    'bahawalpur',
    'multan',
    'in-rajasthan',
    'in-tamil-nadu',
    'jammu-kashmir',
    'ladakh',
  ])
    for (const level of ['province', 'division', 'district', 'tehsil']) {
      let offset = 0,
        total = 0;
      do {
        const r = await call(
          'detail&province=' + id + '&level=' + level + '&offset=' + offset,
          { headers },
        );
        assert.equal(r.status, 200);
        const text = await r.text();
        assert.ok(
          Buffer.byteLength(text) < 4_500_000,
          id + ' ' + level + ' page fits response limit',
        );
        const d = JSON.parse(text);
        if (level === 'province' && id === 'jammu-kashmir') {
          const glacier = data.contextLabels.features.find(
            (f) => f.properties.id === 'siachen-glacier',
          ).geometry.coordinates;
          const shaksgam = data.contextLabels.features.find(
            (f) => f.properties.id === 'shaksam-valley',
          ).geometry.coordinates;
          for (const point of [
            [74.3088, 35.9208],
            [74.7973, 34.0837],
            glacier,
            shaksgam,
          ])
            assert.ok(
              contains(d.features[0].geometry, point),
              'Gilgit, Srinagar, Siachen and Shaksgam share one rendered province',
            );
        }
        if (level === 'province' && id === 'ladakh') {
          const plateau = data.contextLabels.features.find(
            (f) => f.properties.id === 'aksai-chin',
          ).geometry.coordinates;
          for (const point of [[77.5771, 34.1526], plateau])
            assert.ok(
              contains(d.features[0].geometry, point),
              'Leh and Aksai Chin share one rendered province',
            );
        }
        assert.ok(d.features.length <= 20);
        if (id === 'punjab' && level === 'district')
          punjabDistricts.push(...d.features);
        total += d.features.length;
        offset = d.next;
        if (offset === null) assert.equal(total, d.total);
      } while (offset !== null);
    }
  const districtEditor = await loadLocalModule(
    new URL('../app/private-atlas-districts.ts', import.meta.url),
  );
  const originalDistricts = {
    type: 'FeatureCollection',
    features: punjabDistricts,
  };
  const edits = districtEditor.defaultDistrictEdits();
  const mergedDistricts = districtEditor.mergeDistrictFeatures(
    originalDistricts,
    edits.groups,
  );
  const styledDistricts = districtEditor.styleDistrictFeatures(
    mergedDistricts,
    originalDistricts,
    edits,
  );
  assert.equal(punjabDistricts.length, 52);
  assert.equal(styledDistricts.features.length, 49);
  assert.deepEqual(
    [
      'punjab-d-panja-sahib',
      'punjab-d-katas-raj-salt-range',
      'punjab-d-kartarpur-ravi',
      'punjab-d-kasur-bulleh-shah',
    ].map(
      (id) =>
        styledDistricts.features.find((feature) => feature.properties.id === id)
          ?.properties.name,
    ),
    ['Panja Sahib', 'Katas Raj', 'Kartarpur Sahib', 'Bulleh Shah'],
  );
  assert.equal(
    new Set(styledDistricts.features.map((feature) => feature.properties.color))
      .size,
    49,
    'Each displayed district starts with a distinct color',
  );
  for (const id of ['punjab-d-attock', 'punjab-d-chakwal', 'punjab-d-narowal'])
    assert.ok(
      !styledDistricts.features.some((feature) => feature.properties.id === id),
      id + ' is merged into the requested district',
    );
  assert.equal(
    (await call('detail&province=__proto__&level=district', { headers }))
      .status,
    400,
  );
  assert.equal(
    (await call('detail&province=punjab&level=district&offset=-1', { headers }))
      .status,
    400,
  );
  assert.equal((await call('overview')).status, 200);
  assert.equal((await call('session')).status, 404);
  const encrypted = await fs.readFile('server/private-atlas.enc');
  assert.equal(encrypted.subarray(0, 4).toString(), 'UAT1');
  assert.ok(!encrypted.includes(Buffer.from('Havelian–Lora')));
  const assets = await fs.readdir('dist-vercel/assets');
  for (const file of assets.filter((p) => p.endsWith('.js'))) {
    const text = await fs.readFile('dist-vercel/assets/' + file, 'utf8');
    for (const value of [
      process.env.PRIVATE_ATLAS_PASSWORD_HASH,
      process.env.PRIVATE_ATLAS_DATA_KEY,
      process.env.PRIVATE_ATLAS_SESSION_SECRET,
    ])
      if (value)
        assert.ok(!text.includes(value), 'No credential in client assets');
    assert.ok(
      !text.includes('Transfer all three contiguous source tehsils'),
      'No private profile in client assets',
    );
  }
  console.log(
    'Verified password-free access without session credentials, origin checks, 42 profiles, northern regrouping, five attributed Punjab photos, proposed official languages, coverage audit, paged detail and absence of credentials/private data in client assets.',
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
