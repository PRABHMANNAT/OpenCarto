import fs from 'node:fs/promises';
import {generateScenario} from './punjab-2026-model.mjs';
const input=JSON.parse(await fs.readFile('work/punjab-demographic-input.json','utf8'));
const config=JSON.parse(await fs.readFile('app/punjab-demographic-scenario.json','utf8'));
const output=generateScenario(input,config);
await fs.writeFile('work/punjab-demographic-result.json',JSON.stringify(output));
const share=r=>r.hypotheticalDemographics.religions[0].percentage;
console.log(JSON.stringify({total:output.province.hypotheticalDemographics.total,urban:output.province.hypotheticalDemographics.urbanPercent,
  districtTopSikh:[...output.districts].sort((a,b)=>share(b)-share(a)).slice(0,13).map(d=>[d.name,share(d)]),
  tehsilTopSikh:[...output.tehsils].sort((a,b)=>share(b)-share(a)).slice(0,12).map(d=>[d.name,share(d)]),
  lahore:output.districts.find(d=>d.name==='Lahore').hypotheticalDemographics,
  cities:output.cities.map(c=>[c.name,c.hypotheticalDemographics.total,c.hypotheticalDemographics.religions[0].population])},null,2));
