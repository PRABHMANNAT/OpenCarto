import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {generateScenario} from './punjab-2026-model.mjs';
import {loadLocalModule} from './load-map-model.mjs';
export async function checkDemographicApi(call,overview) {
  const config=JSON.parse(await fs.readFile('app/punjab-demographic-scenario.json','utf8'));
  const response=await call('demographics');assert.equal(response.status,200);
  const text=await response.text();assert.ok(Buffer.byteLength(text)<4500000);
  const data=JSON.parse(text);assert.equal(data.version,config.version);assert.equal(data.rows.length,259);
  const p=data.province.hypotheticalDemographics;
  assert.equal(p.total,67536450);assert.equal(p.urbanPopulation,27014580);assert.equal(p.urbanPercent,40);
  assert.equal(p.religions.find(r=>r.key==='hindu').population*100,22*p.total);
  assert.deepEqual(p.religions.map(r=>r.population),[49805065,14858019,2700000,45000,52000,76366]);
  for(const [level,count] of Object.entries({district:48,tehsil:193,division:12,region:6})) {
    const rows=data.rows.filter(row=>row.level===level);assert.equal(rows.length,count);
    assert.equal(rows.reduce((sum,row)=>sum+row.hypotheticalDemographics.total,0),p.total);
    for(const religion of config.religions)assert.equal(rows.reduce((sum,row)=>sum+row.hypotheticalDemographics.religions.find(r=>r.key===religion.key).population,0),religion.population);
    for(const row of rows){const s=row.hypotheticalDemographics;assert.ok(Number.isSafeInteger(s.total)&&s.total>0);assert.equal(s.religions.reduce((sum,r)=>sum+r.population,0),s.total);assert.equal(s.urbanPopulation+s.ruralPopulation,s.total);}
  }
  assert.equal(data.rows.filter(r=>r.level==='region').find(r=>r.id==='punjab-region-pothohar').name,'Pothohar–Gandhara');
  const model=await loadLocalModule(new URL('../app/private-atlas-demography.ts',import.meta.url));
  assert.equal(model.indianCount(49805065),'4,98,05,065');assert.equal(model.indianCount(67536450),'6,75,36,450');
  assert.equal(model.demographicMetrics.length,13);
  const fc={type:'FeatureCollection',features:data.rows.filter(r=>r.level==='district').map(row=>({type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:row}))};
  for(const metric of model.demographicMetrics){const styled=model.demographicChoropleth(fc,metric.id);assert.ok(styled.legend.items.length>0);assert.ok(styled.collection.features.every(f=>/^#[0-9A-F]{6}$/i.test(f.properties.color)));}
  const csv=model.demographicCsv(data.rows.filter(r=>r.level==='tehsil'));assert.equal(csv.trim().split(/\r?\n/).length,194);
  const sumModule=await loadLocalModule(new URL('../app/private-atlas-districts.ts',import.meta.url));
  const aggregated=sumModule.sumDistrictDemographics(fc.features);assert.equal(aggregated.total,p.total);assert.equal(aggregated.urbanPopulation,p.urbanPopulation);assert.deepEqual(aggregated.religions.map(r=>r.population),p.religions.map(r=>r.population));
  assert.equal(overview.provinces.find(r=>r.id==='amb').hypotheticalDemographics,undefined);
  for(const term of ['Pothohar','Pothohar–Gandhara','Lower Tanawal','Khado Khel'])assert.ok((await (await call('search&q='+encodeURIComponent(term))).json()).length>0);
  const input=JSON.parse(await fs.readFile('work/punjab-demographic-input.json','utf8'));
  const first=generateScenario(input,config),second=generateScenario(input,config);
  assert.deepEqual(first,second,'The model is deterministic');
  const reset=structuredClone(input);for(const row of [...reset.districts,...reset.tehsils]){row.hypotheticalPopulation={total:1,note:'Ignored previous scenario'};delete row.hypotheticalDemographics;}
  assert.deepEqual(generateScenario(reset,config).tehsils.map(r=>r.hypotheticalDemographics),first.tehsils.map(r=>r.hypotheticalDemographics),'No previous population totals are allocation inputs');
  console.log('Verified exact 2026 religious margins, 22% Hindu share, 40% urbanization, all 259 administrative rows, deterministic recalculation, 13 map metrics, exact Indian formatting, CSV and live search aliases.');
}
