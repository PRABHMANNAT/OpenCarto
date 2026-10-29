import fs from 'node:fs/promises';
import {atlasStore} from '../server/atlas-store.mjs';
process.loadEnvFile('.env.local');
const store=await atlasStore(process.env.PRIVATE_ATLAS_DATA_KEY),input={};
for(const level of ['district','division','tehsil']){
  const features=[];let offset=0;
  do{const page=await store.detail('punjab',level,offset);features.push(...page.features);offset=page.next;}while(offset!==null);
  input[level]={type:'FeatureCollection',features};
}
await fs.mkdir('work/india-punjab',{recursive:true});
await fs.writeFile('work/india-punjab/punjab-source.json',JSON.stringify(input));
console.log('Prepared canonical Punjab geometries:',Object.fromEntries(Object.entries(input).map(([level,c])=>[level,c.features.length])));
