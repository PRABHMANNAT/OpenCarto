// Pin the existing fictional settlement weights before changing the scenario.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {districtPopulationTargets} from './punjab-population-model.mjs';
const payload = JSON.parse(await fs.readFile('private/united-atlas/atlas.json', 'utf8'));
const districts = payload.details.punjab.district.features.map(f => f.properties);
if (districts.length !== 48) throw Error('Expected the existing 48-district atlas.');
const path = 'app/united-punjab-population.json';
if (!existsSync(path)) {
  const fallback = districtPopulationTargets(districts);
  const weights = districts.map((p, i) => ({id: p.id,
    weight: p.hypotheticalDemographics?.total || fallback[i],
    basis: p.hypotheticalDemographics ? 'Previous fictional district allocation' : 'Existing settlement/area model fallback; fictional weight'}));
  await fs.writeFile(path, JSON.stringify({revision: 'punjab-population-70m-2026-10-15', total: 70000000,
    method: 'Largest-remainder apportionment of the user-defined 7 crore total using retained district scenario weights. The three missing KP-origin weights use the existing settlement/area model. Population only; no new religious allocations.', weights}, null, 2) + '\n');
}
await fs.mkdir('work', {recursive: true});
await fs.writeFile('work/punjab-stat-boundary.geojson', JSON.stringify(payload.details.punjab.province.features[0]));
console.log('Pinned 48 fictional population weights and exported the unchanged Punjab boundary for raster statistics.');
