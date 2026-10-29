import fs from 'node:fs/promises';
import {atlasStore} from '../server/atlas-store.mjs';
process.loadEnvFile('.env.local');const store=await atlasStore(process.env.PRIVATE_ATLAS_DATA_KEY),overview=await store.section('overview');
const result={type:'FeatureCollection',features:[]};
for(const id of ['multan','bahawalpur','sindh','balochistan']){let offset=0;do{const page=await store.detail(id,'province',offset);result.features.push(...page.features);offset=page.next;}while(offset!==null);}
await fs.mkdir('work/india-punjab',{recursive:true});await fs.writeFile('work/india-punjab/western-provinces-source.json',JSON.stringify(result));
await fs.writeFile('work/india-punjab/western-provinces-metadata.json',JSON.stringify(overview.provinces.filter(p=>['multan','bahawalpur','sindh','balochistan'].includes(p.id)).map(({id,name,capital,capitalCoordinates,color})=>({id,name,capital,capitalCoordinates,color}))));
console.log('Prepared canonical western province outlines:',result.features.map(f=>({id:f.properties.id,name:f.properties.name,coordinates:JSON.stringify(f.geometry).length})));
