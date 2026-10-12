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
    'Kartarpur Sahib',
    'Katas',
    'Sri Anandpur Sahib',
    'Yazman–Cholistan',
    'Sacha Sauda',
    'Nanaksar',
    'Kair Sahib',
    'Babe Di Ber',
    'Rori Sahib',
    'Chenab',
  ];
  for (const name of expected)
    assert.ok(
      analysis.changes.some((r) => r.proposedDistrict === name),
      name + ' assignment documented',
    );
  const punjabDivisions = [];
  const punjabDistricts = [];
  const punjabTehsils = [];
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
        if (id === 'punjab' && level === 'division')
          punjabDivisions.push(...d.features);
        if (id === 'punjab' && level === 'district')
          punjabDistricts.push(...d.features);
        if (id === 'punjab' && level === 'tehsil')
          punjabTehsils.push(...d.features);
        total += d.features.length;
        offset = d.next;
        if (offset === null) assert.equal(total, d.total);
      } while (offset !== null);
    }
  const divisionPlan = JSON.parse(
    await fs.readFile('scripts/punjab-divisions.json', 'utf8'),
  );
  assert.equal(
    data.provinces.find((p) => p.id === 'punjab').detailCounts.division,
    11,
  );
  assert.equal(punjabDivisions.length, 11);
  assert.equal(punjabDistricts.length, 49);
  assert.equal(divisionPlan.flatMap((spec) => spec.districts).length, 49);
  const plannedDistricts = new Map(
    divisionPlan.flatMap((spec) => spec.districts.map((name) => [name, spec])),
  );
  assert.equal(plannedDistricts.size, 49);
  for (const spec of divisionPlan) {
    const division = punjabDivisions.find(
      (feature) => feature.properties.name === spec.name,
    );
    assert.ok(division, spec.name + ' division exists');
    assert.equal(division.properties.capital, spec.headquarters);
    assert.deepEqual(division.properties.memberDistricts, spec.districts);
    const props = division.properties;
    assert.ok(props.areaKm2 > 0);
    assert.ok(contains(division.geometry, props.headquartersCoordinates));
    assert.equal(props.districtCount, spec.districts.length);
    assert.equal(
      props.tehsilCount,
      punjabTehsils.filter((feature) =>
        spec.districts.includes(feature.properties.district),
      ).length,
    );
    assert.deepEqual(
      props.districtStats.map((district) => district.name),
      spec.districts,
    );
    assert.equal(
      props.districtStats.reduce(
        (total, district) => total + district.tehsilCount,
        0,
      ),
      props.tehsilCount,
    );
    assert.ok(
      Math.abs(
        props.districtStats.reduce(
          (total, district) => total + district.areaKm2,
          0,
        ) - props.areaKm2,
      ) < 1,
    );
    for (const field of [
      'description',
      'wikiUrl',
      'landmark',
      'landmarkSource',
      'headquartersSource',
    ])
      assert.ok(props[field]);
    for (const field of ['url', 'sourceUrl', 'author', 'license', 'licenseUrl'])
      assert.ok(props.photo[field]);
  }
  assert.equal(
    punjabDivisions.reduce(
      (total, feature) => total + feature.properties.tehsilCount,
      0,
    ),
    punjabTehsils.length,
  );
  assert.ok(
    Math.abs(
      punjabDivisions.reduce(
        (total, feature) => total + feature.properties.provinceAreaShare,
        0,
      ) - 100,
    ) < 0.1,
  );
  for (const district of punjabDistricts) {
    const spec = plannedDistricts.get(district.properties.name);
    assert.ok(spec, district.properties.name + ' is assigned once');
    assert.equal(district.properties.division, spec.name);
    assert.equal(district.properties.divisionCapital, spec.headquarters);
    const division = punjabDivisions.find(
      (feature) => feature.properties.name === spec.name,
    );
    assert.ok(contains(division.geometry, district.properties.center));
  }
  for (const tehsil of punjabTehsils)
    assert.equal(
      tehsil.properties.division,
      plannedDistricts.get(tehsil.properties.district)?.name,
    );
  for (const change of analysis.changes.filter(
    (row) => row.provinceId === 'punjab',
  )) {
    const spec = plannedDistricts.get(change.proposedDistrict);
    assert.equal(change.proposedDivision, spec?.name);
    assert.equal(change.divisionCapital, spec?.headquarters);
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
  assert.equal(punjabDistricts.length, 49);
  assert.equal(styledDistricts.features.length, 47);
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
    ['Panja Sahib', 'Katas', 'Kartarpur Sahib', 'Bulleh Shah'],
  );
  const palette = [
    '#AFC7B1',
    '#A9C7DD',
    '#E5B48F',
    '#C4AED2',
    '#D8A6AD',
    '#C2C58F',
    '#93C2BE',
    '#DCC89F',
    '#ABB6D7',
    '#9EBA9A',
    '#BDD5E3',
    '#E8C3AA',
    '#D7C5E2',
    '#E3BDC3',
    '#E5D792',
    '#B7D8C5',
    '#CFA68C',
    '#91AEC8',
    '#D1DAB2',
    '#CA97A5',
    '#A0D0D0',
    '#DCC078',
    '#B49FC4',
    '#A5D2B5',
    '#D69D88',
    '#9AAED0',
    '#C3D5C5',
    '#C8B0BB',
    '#E2D5B6',
    '#B2B8C9',
    '#B3C392',
    '#AFBDDD',
    '#E0AE9D',
    '#CEB3D5',
    '#DEBCC0',
    '#D8DCA1',
    '#8FB9B3',
    '#D4B18A',
    '#B7AFCB',
    '#A8BAA0',
    '#C5DBDC',
    '#D79DA0',
    '#E3C69A',
    '#C2B5D9',
    '#AFCDD1',
  ];
  assert.deepEqual(
    districtEditor.punjabPalette.map((entry) => entry.color),
    palette,
  );
  const sortedDistricts = [...styledDistricts.features].sort((a, b) =>
    a.properties.name.localeCompare(b.properties.name),
  );
  assert.deepEqual(
    sortedDistricts.map((feature) => feature.properties.color),
    sortedDistricts.map((_, index) => palette[index % palette.length]),
    'Punjab districts follow the supplied palette in name order',
  );
  const tehsilsByDistrict = districtEditor.styleTehsilFeatures(
    { type: 'FeatureCollection', features: punjabTehsils },
    originalDistricts,
    edits,
    'district',
  );
  const districtColors = new Map(
    sortedDistricts.map((feature) => [
      feature.properties.id,
      feature.properties.color,
    ]),
  );
  for (const feature of tehsilsByDistrict.features)
    assert.equal(
      feature.properties.color,
      districtColors.get(feature.properties.parentDistrictId),
    );
  const individuallyColoredTehsils = districtEditor.styleTehsilFeatures(
    { type: 'FeatureCollection', features: punjabTehsils },
    originalDistricts,
    edits,
    'tehsil',
  );
  const sortedTehsils = [...individuallyColoredTehsils.features].sort(
    (a, b) =>
      a.properties.name.localeCompare(b.properties.name) ||
      a.properties.id.localeCompare(b.properties.id),
  );
  assert.deepEqual(
    sortedTehsils.map((feature) => feature.properties.color),
    sortedTehsils.map((_, index) => palette[index % palette.length]),
    'Individual tehsils follow the same repeating palette',
  );
  for (const id of [
    'punjab-d-attock',
    'punjab-d-chakwal',
    'punjab-d-narowal',
    'punjab-d-havelian-lora',
    'punjab-d-okara',
    'punjab-d-malerkotla',
  ])
    assert.ok(
      !styledDistricts.features.some((feature) => feature.properties.id === id),
      id + ' is merged into the requested district',
    );
  for (const [id, name] of Object.entries({
    'punjab-d-taxila': 'Taxila',
    'punjab-d-haripur-hazara': 'Haripur',
    'punjab-d-sahiwal': 'Harappa',
    'punjab-d-sangrur': 'Sangrur',
    'punjab-d-gujrat': 'Dinga',
    'punjab-d-gujranwala': 'Ranjitgarh',
    'punjab-d-faisalabad': 'Sandalbar',
    'punjab-d-pakpattan': 'Nanaksar',
    'punjab-d-sheikhupura': 'Sacha Sauda',
    'punjab-d-mandi-bahauddin': 'Kair Sahib',
    'punjab-d-sialkot': 'Babe Di Ber',
    'punjab-d-hafizabad': 'Rori Sahib',
    'punjab-d-chiniot': 'Chenab',
  }))
    assert.equal(
      styledDistricts.features.find((feature) => feature.properties.id === id)
        ?.properties.name,
      name,
    );
  assert.equal(punjabTehsils.length, 181);
  const reviewRows = JSON.parse(
    await fs.readFile('scripts/punjab-tehsil-heritage-names.json', 'utf8'),
  ).rows;
  const reviewed = new Map(reviewRows.map((row) => [row.sourceId, row]));
  assert.equal(reviewed.size, 181);
  assert.equal(reviewed.get('PK61602')?.newName, 'Naushera');
  assert.equal(reviewed.get('PK60904')?.newName, 'Wazirabad');
  assert.equal(
    reviewRows.filter(
      (row) => row.provenance === 'User-provided Western Panjab rename list',
    ).length,
    19,
  );
  assert.equal(
    reviewRows.filter(
      (row) => row.provenance === 'User-requested name restoration',
    ).length,
    2,
  );
  assert.equal(
    reviewRows.filter(
      (row) => row.provenance === 'Project review of requested tehsil renames',
    ).length,
    32,
  );
  for (const [district, tehsil] of [
    ['Rori Sahib', 'Rori Sahib'],
    ['Babe Di Ber', 'Babe Di Ber'],
    ['Dinga', 'Dinga'],
    ['Kair Sahib', 'Kair Sahib'],
    ['Ranjitgarh', 'Ranjitgarh'],
    ['Sacha Sauda', 'Sacha Sauda'],
    ['Sandalbar', 'Sandalbar'],
    ['Kartarpur Sahib', 'Kartarpur Sahib'],
  ]) {
    assert.ok(
      reviewRows.some(
        (row) => row.proposedDistrict === district && row.newName === tehsil,
      ),
    );
  }
  let documentedRenames = 0;
  for (const feature of punjabTehsils) {
    const props = feature.properties;
    const row = reviewed.get(props.sourceId);
    assert.ok(row, props.sourceId + ' appears in the supplied review');
    assert.ok(props.sourceName, props.sourceId + ' retains its old name');
    assert.ok(
      !/[·-]/.test(props.name),
      props.sourceId + ' has one genuine name',
    );
    assert.equal(props.sourceName, row.oldName);
    assert.equal(props.name, row.newName);
    const displayedDistrict =
      {
        Chakwal: 'Katas',
        Narowal: 'Kartarpur Sahib',
        'Kartarpur–Ravi': 'Kartarpur Sahib',
      }[props.district] || props.district;
    assert.equal(displayedDistrict, row.proposedDistrict);
    assert.equal(props.nameMeaning, row.meaning);
    assert.equal(props.namingReason, row.history);
    assert.equal(
      props.namingProvenance,
      row.provenance || 'User-provided United Panjab heritage review',
    );
    assert.equal(
      props.namingStatus,
      { Renamed: 'renamed', Retained: 'source', Added: 'restored' }[
        row.decision
      ],
    );
    if (props.namingStatus === 'renamed') documentedRenames++;
    assert.ok(
      analysis.changes.some(
        (row) =>
          row.provinceId === 'punjab' &&
          row.sourceId === props.sourceId &&
          row.proposedTehsil === props.name,
      ),
      props.sourceId + ' proposed tehsil is in the research audit',
    );
  }
  assert.equal(documentedRenames, 60);
  const guruHarSahai = punjabTehsils.find(
    (feature) => feature.properties.sourceId === 'in-t-guru-har-sahai',
  );
  assert.ok(guruHarSahai);
  assert.equal(guruHarSahai.properties.district, 'Ferozepur');
  assert.ok(contains(guruHarSahai.geometry, [74.3998, 30.7113]));
  for (const point of [
    [74.14104, 31.43777],
    [74.27249, 31.63669],
    [74.03426, 31.35891],
  ])
    assert.ok(
      punjabTehsils.some(
        (feature) =>
          feature.properties.district === 'Lahore' &&
          contains(feature.geometry, point),
      ),
      'the visible gaps around Lahore are covered',
    );
  const taxila = punjabDistricts.find(
    (feature) => feature.properties.id === 'punjab-d-taxila',
  );
  const rawalpindi = punjabDistricts.find(
    (feature) => feature.properties.id === 'punjab-d-rawalpindi',
  );
  const taxilaTehsil = punjabTehsils.find(
    (feature) => feature.properties.sourceId === 'PK63007',
  );
  assert.equal(taxilaTehsil.properties.district, 'Taxila');
  assert.ok(contains(taxila.geometry, taxilaTehsil.properties.center));
  assert.ok(!contains(rawalpindi.geometry, taxilaTehsil.properties.center));
  for (const [sources, district] of [
    [['PK60101', 'PK60103'], 'Panja Sahib'],
    [['PK50102', 'PK50103', 'PK51101', 'PK51102', 'PK51103'], 'Haripur'],
    [['PK62602', 'PK63102'], 'Harappa'],
    [['in-t-269', 'in-t-271'], 'Sangrur'],
  ])
    for (const sourceId of sources)
      assert.equal(
        punjabTehsils.find(
          (feature) => feature.properties.sourceId === sourceId,
        )?.properties.district,
        district,
        sourceId + ' belongs to ' + district,
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
