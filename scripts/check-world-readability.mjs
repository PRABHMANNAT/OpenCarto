import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const m=await loadMapModel(),h=await loadLocalModule(new URL('../app/world-equal-earth.ts',import.meta.url)),s=await loadLocalModule(new URL('../app/world-style-model.ts',import.meta.url)),search=await loadLocalModule(new URL('../app/area-search-model.ts',import.meta.url));
const names=JSON.parse(await fs.readFile('app/world-name-corrections.json','utf8')),meta=JSON.parse(await fs.readFile('app/world-sources.json','utf8'));
assert.equal(Object.keys(names.records).length,177);
for(const row of m.areas.filter(a=>a.region==='world'))assert.ok(!/[?\ufffd]/.test(row.name),row.name);
for(const [query,id] of [['Haryana','world-a1-1811400B68407848780347'],['Himachal Pradesh','world-a1-1811400B21086746745937'],['Maharashtra','world-a1-1811400B15614733245507'],['Hà Nội','world-a1-63759600B97268694287734'],['Dong Nai','world-a1-63759600B12839449494422'],['Lodz','world-a1-17162690B86810837764805']])assert.ok(search.findAreas(query,'all','world').some(a=>a.id===id),query);
for(const audit of meta.nameCorrections.geometryAudit){
 const geo=JSON.parse(await fs.readFile('public/data/'+audit.layer+'.geojson','utf8'));
 assert.equal(geo.features.length,audit.features);
 for(const f of geo.features){assert.ok(!/[?\ufffd]/.test(f.properties.name));assert.equal(f.properties.name,m.areaById.get(f.id).name);}
}
const data=JSON.parse(await fs.readFile('public/data/world-region.geojson','utf8'));const canada=data.features.find(f=>f.id==='world-c-can'),indonesia=data.features.find(f=>f.id==='world-c-idn');
for(const f of [canada,indonesia]){
 const before=JSON.stringify(f.geometry),raw=h.worldRenderedGeometry(f.geometry).path,small=h.worldBorderPath(f.geometry,1),large=h.worldBorderPath(f.geometry,64);
 const rings=p=>(p.match(/M/g)||[]).length;assert.ok(rings(small)<rings(raw)*.25,'Small outlines declutter '+f.id);assert.ok(rings(large)>rings(small),'Small islands return with zoom '+f.id);assert.ok(small.length<raw.length*.5,'Coastlines simplify '+f.id);assert.ok(!/NaN|Infinity/.test(small+large));assert.equal(JSON.stringify(f.geometry),before,'Canonical coordinates unchanged');
}
for(const f of data.features)assert.ok(h.worldBorderPath(f.geometry,1).length>0,'Every country retains an outline');
for(const theme of Object.keys(s.worldThemePalettes)){const colors=data.features.map(f=>s.worldSchemeColor(f.id,theme));assert.equal(new Set(colors).size,data.features.length,theme);}
const old={...m.initial,worldPaletteVersion:1,worldColorScheme:'colorful',worldSavedFills:{},fills:{'world-c-aus':{color:'#123456',pattern:'solid'}}};const migrated=m.validate(old);assert.equal(migrated.worldPaletteVersion,2);assert.equal(migrated.fills['world-c-aus'].color,'#123456');
console.log('Verified 177 restored names and search, synchronized labels, zoom-dependent coastline decluttering, island return, unchanged coordinates, coordinated unique palettes and preservation of manual colors during migration.');
