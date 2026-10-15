import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadLocalModule} from './load-map-model.mjs';

export async function checkHistoricalRegionsApi(call, overview) {
  const config = JSON.parse(await fs.readFile('app/united-punjab-regions.json', 'utf8'));
  assert.equal(overview.provinces.find(p => p.id === 'punjab').detailCounts.region, 6);
  assert.ok(!overview.provinces.find(p => p.id === 'amb').detailCounts.region);
  async function details(level) {
    const result = [];
    let offset = 0;
    do {
      const response = await call(`detail&province=punjab&level=${level}&offset=${offset}`);
      assert.equal(response.status, 200);
      const content = await response.text();
      assert.ok(Buffer.byteLength(content) < 4500000, 'Region/detail page fits hosting response limit');
      const page = JSON.parse(content);
      result.push(...page.features);
      offset = page.next;
    } while (offset !== null);
    return result;
  }
  const [regions, districts] = await Promise.all([details('region'), details('district')]);
  assert.equal(regions.length, 6);
  const members = new Set();
  for (const [index, spec] of config.regions.entries()) {
    const p = regions[index].properties;
    assert.equal(p.id, spec.id);
    assert.deepEqual(p.memberDistricts, spec.districts);
    assert.equal(p.districtCount, spec.districts.length);
    assert.equal(p.districtStats.length, spec.districts.length);
    for (const id of p.memberDistrictIds) {
      assert.ok(!members.has(id));
      members.add(id);
      assert.equal(districts.find(f => f.properties.id === id).properties.historicalRegion, spec.name);
    }
    assert.equal(p.hypotheticalPopulation.total, p.memberDistrictIds.reduce((sum, id) => sum + districts.find(f => f.properties.id === id).properties.hypotheticalPopulation.total, 0));
    const result = await (await call('search&q=' + encodeURIComponent(spec.name + ' Historical Region'))).json();
    assert.ok(result.some(item => item.level === 'region' && item.id === spec.id));
    const shortName = await (await call('search&q=' + encodeURIComponent(spec.name))).json();
    assert.ok(shortName.some(item => item.level === 'region' && item.id === spec.id), spec.name + ' is discoverable by its short name');
  }
  assert.equal(members.size, 48);
  assert.equal(regions.reduce((sum, feature) => sum + feature.properties.hypotheticalPopulation.total, 0), 70000000);
  const model = await loadLocalModule(new URL('../app/private-atlas-detail.ts', import.meta.url));
  assert.equal(model.atlasDetailLabels.region, 'Historical Regions');
  assert.equal(model.tagAtlasDetail({type: 'FeatureCollection', features: regions}, 'punjab', 'region').features[0].properties.atlasLevel, 'region');
  console.log('Verified six historical regions through the encrypted API: exact 13/10/4/4/9/8 membership, 48 unique districts, 7-crore aggregate, region search, response sizes and independent Amb.');
}
