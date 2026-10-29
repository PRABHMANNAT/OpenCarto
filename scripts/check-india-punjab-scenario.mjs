import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const model=await loadMapModel(),scenario=await loadLocalModule(new URL('../app/india-punjab-scenario.ts',import.meta.url)),scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url)),search=await loadLocalModule(new URL('../app/area-search-model.ts',import.meta.url)),names=await loadLocalModule(new URL('../app/area-name-model.ts',import.meta.url)),visibility=await loadLocalModule(new URL('../app/area-visibility-model.ts',import.meta.url)),style=await loadLocalModule(new URL('../app/world-style-model.ts',import.meta.url));
const m=scenario.indiaPunjabScenario;
const sourceDoc={...model.initial,...scope.scopePreset(model.initial,'world')};
const doc={...sourceDoc,indiaPunjabScenario:true};
const area=id=>model.areaById.get(id),active=d=>model.areas.filter(a=>model.visible(a,d));
assert.equal(model.initial.indiaPunjabScenario,false);
assert.equal(model.validate(JSON.parse(JSON.stringify(doc))).indiaPunjabScenario,true);
assert.equal(names.areaDisplayName(area(m.punjabId),doc),'United Punjab');
assert.equal(names.areaDisplayName(area(m.ladakhId),doc),'Ladakh');
assert.ok(search.findAreas('Aksai Chin','all','world',doc).some(a=>a.id===m.ladakhId));
assert.ok(!search.findAreas('Aksai Chin','all','world',doc).some(a=>a.id===m.aksaiId));
assert.equal(model.visible(area(m.aksaiId),doc),false);
assert.equal(names.areaDisplayName(area(m.punjabId),{...doc,areaNames:{[m.punjabId]:'My Punjab'}}),'My Punjab');
assert.equal(active(sourceDoc).length,3420);
assert.equal(active(doc).filter(a=>a.level==='region').length,216);
assert.equal(active(doc).filter(a=>a.level==='province').length,3200);
const children=(id,d)=>visibility.areaChildren(area(id),d).map(a=>a.id);
assert.equal(children(m.indiaId,sourceDoc).length,36);
assert.equal(children(m.indiaId,doc).length,39);
assert.equal(children('world-c-pak',sourceDoc).length,7);
assert.equal(children('world-c-pak',doc).length,2);
assert.equal(children(m.balochistanId,doc).length,0);
for(const id of m.addedIds){assert.equal(model.visible(area(id),sourceDoc),false);assert.equal(model.visible(area(id),doc),true);assert.ok(!search.findAreas(area(id).name,'all','world',sourceDoc).some(a=>a.id===id));}
for(const id of [m.sindhId,m.multanId,m.bahawalpurId]){
 const updated=scenario.indiaScenarioArea(area(id),doc);assert.equal(updated.parent,m.indiaId);assert.equal(updated.country,'India');
 assert.ok(children(m.indiaId,doc).includes(id));assert.ok(!children('world-c-pak',doc).includes(id));
 assert.ok(search.findAreas(updated.name+' India','all','world',doc).some(a=>a.id===id));
 assert.equal(model.visible(area(id),{...doc,scopeAreas:[m.indiaId]}),true);
 assert.equal(model.visible(area(id),{...doc,scopeAreas:['world-c-pak']}),false);
 assert.equal(model.visible(area(id),{...doc,hidden:['world-c-pak']}),true);
 assert.equal(model.visible(area(id),{...doc,hidden:[m.indiaId]}),false);
 const paint={color:'#123456',pattern:'solid'};
 assert.deepEqual(model.effectivePaint(area(id),{...doc,fills:{[m.indiaId]:paint,'world-c-pak':{color:'#abcdef',pattern:'dots'}}}),paint);
}
assert.equal(scenario.indiaScenarioArea(area(m.sindhId),sourceDoc).parent,'world-c-pak');
assert.ok(visibility.selectableAreas(doc).some(a=>a.id===m.balochistanId));
assert.ok(!visibility.selectableAreas(doc).some(a=>a.id===m.indiaId));
assert.deepEqual(model.validate({...doc,scopeAreas:[m.balochistanId]}).scopeAreas,[m.balochistanId]);
for(const level of ['region','province']){
 const original=JSON.parse(await fs.readFile(`public/data/world-${level}.geojson`,'utf8')),overrides=JSON.parse(await fs.readFile('server/alternate-world-overrides.geojson','utf8')),before=JSON.stringify(original);
 const changed=scenario.indiaScenarioCollection(original,overrides),points=scenario.indiaScenarioCollection(original,overrides,true);
 assert.equal(new Set(changed.features.map(f=>f.id)).size,changed.features.length);
 assert.equal(changed.features.length,level==='region'?216:3200);
 for(const id of m.addedIds.filter(id=>area(id).level===level)){
  assert.equal(changed.features.filter(f=>f.id===id).length,1);
  assert.deepEqual(changed.features.find(f=>f.id===id).geometry,overrides.features.find(f=>f.id===id).geometry);
  assert.deepEqual(points.features.find(f=>f.id===id).geometry,{type:'Point',coordinates:m.areas[id].center});
 }
 assert.equal(JSON.stringify(original),before,'Source GIS must remain immutable');
}
assert.ok(search.findAreas('Gilgit-Baltistan','all','world',doc).some(a=>a.id===m.kashmirId));
assert.deepEqual(scenario.openIndiaSettings(doc).scopeAreas,[],'Alternate edition opens the complete world');
assert.equal(scope.scopeNavigation(doc).indiaPunjabScenario,true);
assert.deepEqual(scope.scopeFocusBounds({...doc,scopeAreas:[m.indiaId]}),m.areas[m.indiaId].focusBounds);
for(const scheme of ['colorful','muted','pastel','marine','royal','modern','earth']){
 const regular=style.applyWorldScheme(sourceDoc,scheme),alternate=style.applyWorldScheme(doc,scheme);
 assert.equal(Object.keys(regular.fills).filter(id=>id.startsWith('world-c-')).length,218);
 assert.ok(alternate.fills[m.balochistanId]);
 for(const [id,paint] of Object.entries(regular.fills))assert.deepEqual(alternate.fills[id],paint,'Existing country colors unchanged');
 assert.equal(new Set(Object.values(alternate.fills).map(p=>p.color)).size,219);
}
console.log('Verified 216 alternate country outlines, 3,200 provinces, Balochistan country, India 39/Pakistan 2 ADM1, new search/ownership/hiding/painting, unique geometry and label additions, save/load, source restoration and unchanged source-country palettes.');
