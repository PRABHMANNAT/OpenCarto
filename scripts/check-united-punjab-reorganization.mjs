import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadLocalModule} from './load-map-model.mjs';

export async function checkReorganizationApi(call, overview) {
  const spec = JSON.parse(await fs.readFile('app/united-punjab-reorganization.json', 'utf8'));
  const analysis = await (await call('analysis')).json();
  const revised2026 = !!analysis.audit.currentDemographicScenario;
  const currentTotal = revised2026 ? 67536450 : 70000000;
  const audit = analysis.audit.administrativeReorganization;
  assert.equal(audit.revision, spec.revision);
  assert.equal(audit.districtCount, 48);
  assert.equal(overview.provinces.length, 43);
  assert.equal(overview.geometry.features.length, 43);
  assert.equal(overview.auditSummary.provinceCount, 43);
  const punjab = overview.provinces.find(p => p.id === 'punjab');
  const amb = overview.provinces.find(p => p.id === 'amb');
  assert.equal(punjab.detailCounts.district, 48);
  assert.equal(punjab.detailCounts.tehsil, 193);
  assert.equal(amb.classification, 'Union territory');
  assert.equal(amb.capital, 'Darband');
  assert.equal(amb.detailCounts.district, 0);
  assert.equal(amb.detailCounts.tehsil, 2);
  assert.ok(amb.areaKm2 > 0);
  for (const p of [punjab, amb, overview.provinces.find(p => p.id === 'kp')]) {
    assert.equal(p.population, null);
    if (p.id !== 'punjab' || !analysis.audit.divisionFinalization) assert.equal(p.density, null);
    if(p.id!=='punjab'||!revised2026)assert.ok(!p.hypotheticalDemographics);
  }
  async function detail(province, level) {
    const features = [];
    let offset = 0;
    do {
      const response = await call(`detail&province=${province}&level=${level}&offset=${offset}`);
      assert.equal(response.status, 200);
      const page = await response.json();
      features.push(...page.features);
      offset = page.next;
    } while (offset !== null);
    return {type: 'FeatureCollection', features};
  }
  const [districts, tehsils, ambTehsils, kpDistricts] = await Promise.all([
    detail('punjab', 'district'), detail('punjab', 'tehsil'), detail('amb', 'tehsil'), detail('kp', 'district'),
  ]);
  const kpDivisions = await detail('kp', 'division');
  assert.equal(kpDivisions.features.reduce((sum, f) => sum + f.properties.districtCount, 0), 31);
  assert.equal(kpDivisions.features.reduce((sum, f) => sum + f.properties.tehsilCount, 0), 134);
  assert.equal(districts.features.length, 48);
  assert.equal(new Set(tehsils.features.map(f => f.properties.id)).size, 193);
  for (const district of spec.districts) {
    const feature = districts.features.find(f => f.properties.id === district.id);
    assert.equal(feature.properties.capital, district.capital);
    assert.equal(feature.properties.tehsilCount, Object.keys(district.members).length);
    assert.deepEqual(feature.properties.memberTehsils.map(t => t.name).sort(), Object.values(district.members).sort());
    assert.ok(feature.properties.heritage.length >= 8);
  }
  assert.ok(!districts.features.some(f => ['Swabi', 'Abbottabad', 'Barnala'].includes(f.properties.name)));
  assert.ok(!kpDistricts.features.some(f => f.properties.name === 'Mansehra'));
  assert.deepEqual(ambTehsils.features.map(f => f.properties.name).sort(), ['Darband', 'Oghi']);
  const model = await loadLocalModule(new URL('../app/private-atlas-districts.ts', import.meta.url));
  const edits = model.defaultDistrictEdits();
  assert.equal(model.mergeDistrictFeatures(districts, edits.groups).features.length, 48);
  const migrated = model.migrateDistrictEdits({groups: [
    {id: 'punjab-d-katas-raj-salt-range', name: 'Katas', members: ['punjab-d-katas-raj-salt-range', 'punjab-d-chakwal']},
    {id: 'punjab-d-swabi', name: 'Swabi', members: ['punjab-d-swabi', 'punjab-d-akali-phula-singh']},
  ], names: {'punjab-d-swabi': 'Old Swabi', 'punjab-d-haripur-hazara': 'Old Haripur'}, colors: {'punjab-d-swabi': '#ffffff'}});
  assert.equal(migrated.groups.length, 0);
  assert.deepEqual(Object.keys(migrated.names), []);
  assert.deepEqual(Object.keys(migrated.colors), []);
  const palette = [{color: '#123456'}, {color: '#ABCDEF'}, {color: '#FEDCBA'}];
  const styled = model.styleDistrictFeatures(districts, districts, edits, palette);
  assert.ok(styled.features.every(f => palette.some(c => c.color === f.properties.color)));
  const byId = new Map(styled.features.map(f => [f.properties.id, f.properties]));
  const styledTehsils = model.styleTehsilFeatures(tehsils, districts, edits, 'district', palette);
  assert.ok(styledTehsils.features.every(f => f.properties.color === byId.get(f.properties.parentDistrictId).color));
  const ranked = model.mergeDistrictFeatures(districts, []).features;
  assert.ok(ranked.filter(f => !model.populationScenario(f.properties)).every(f => f.properties.populationRank === undefined));
  if(revised2026)assert.equal(model.sumDistrictDemographics(districts.features).total,currentTotal);
  else assert.equal(model.sumDistrictDemographics(districts.features), undefined);
  if (analysis.audit.divisionFinalization) {
    const divisions = await detail('punjab', 'division');
    assert.equal(divisions.features.length, 12);
    assert.equal(model.sumDistrictPopulation(districts.features).total, currentTotal);
    assert.equal(model.sumDistrictPopulation(divisions.features).total, currentTotal);
    assert.equal(model.summarizeDistrictDivisions(districts.features).length, 12);
    assert.equal(punjab.hypotheticalPopulation.total, currentTotal);
    assert.ok(punjab.silhouette.length > 500);
    assert.ok(punjab.forestArea > 0 && punjab.forestPercent > 0);
    assert.ok(punjab.highestPoint.elevationMeters > 4000);
    const config = JSON.parse(await fs.readFile('app/united-punjab-divisions.json', 'utf8'));
    for (const target of config.updatedDivisions) {
      const division = divisions.features.find(f => f.properties.name === target.name);
      assert.equal(division.properties.capital, target.capital);
      assert.deepEqual([...division.properties.memberDistricts].sort(), [...target.districts].sort());
      assert.deepEqual(districts.features.filter(f => f.properties.division === target.name).map(f => f.properties.name).sort(), [...target.districts].sort());
      const results = await (await call('search&q=' + encodeURIComponent(target.name + ' Division'))).json();
      assert.ok(results.some(item => item.level === 'division' && item.id === target.id));
    }
  }
  for (const aliases of Object.values(spec.aliases)) {
    for (const alias of aliases) {
      const results = await (await call('search&q=' + encodeURIComponent(alias))).json();
      assert.ok(results.some(item => item.aliases.includes(alias)), alias);
    }
  }
  assert.equal((await call('detail&province=__proto__&level=district')).status, 400);
  assert.equal((await call('detail&province=punjab&level=district&offset=-1')).status, 400);
  assert.equal((await call('session')).status, 404);
  assert.equal((await call('search&q=x')).status, 400);
  assert.equal(overview.places.features.find(f => f.properties.id === 'up-phulra').properties.province, 'punjab');
  const encoded = await fs.readFile('server/private-atlas.enc');
  assert.equal(encoded.subarray(0, 4).toString(), 'UAT1');
  for (const file of (await fs.readdir('dist-vercel/assets')).filter(name => name.endsWith('.js'))) {
    const source = await fs.readFile('dist-vercel/assets/' + file, 'utf8');
    if (process.env.PRIVATE_ATLAS_DATA_KEY) assert.ok(!source.includes(process.env.PRIVATE_ATLAS_DATA_KEY));
  }
  console.log('Verified 43 province/UT profiles, 48 districts, 193 Punjab tehsils, independent Amb, population provenance and totals, division assignments, aliases, palette inheritance, API pagination and server-key isolation.');
}
