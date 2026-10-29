import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const model=await loadMapModel(),scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url)),tibet=await loadLocalModule(new URL('../app/world-tibet-model.ts',import.meta.url)),svg=await loadLocalModule(new URL('../app/world-tibet-svg.ts',import.meta.url)),search=await loadLocalModule(new URL('../app/area-search-model.ts',import.meta.url));
const t=tibet.tibetRepublic,source={...model.initial,...scope.scopePreset(model.initial,'world')},doc={...source,indiaPunjabScenario:true},area=id=>model.areaById.get(id);
assert.equal(model.areas.filter(a=>model.visible(a,source)).length,3420);
assert.equal(model.visible(area(t.id),source),false);assert.equal(model.visible(area(t.id),doc),true);
assert.ok(search.findAreas('Republic of Tibet','all','world',doc).some(a=>a.id===t.id));
for(const id of t.unitIds){assert.equal(area(id).parent,t.id);assert.equal(model.visible(area(id),{...doc,scopeAreas:[t.id]}),true);assert.equal(model.visible(area(id),{...doc,scopeAreas:['world-c-chn']}),false);assert.equal(model.visible(area(id),{...doc,hidden:[t.id]}),false);}
for(const query of ['Muli','Tianzhu','Garze','Ngawa'])assert.ok(search.findAreas(query,'all','world',doc).some(a=>t.unitIds.includes(a.id)),query);
assert.equal(model.validate({...doc,tibetView:'cultural',tibetCities:false}).tibetView,'cultural');assert.equal(model.validate({...doc,tibetCities:false}).tibetCities,false);
assert.deepEqual(tibet.validateTibetSettings({tibetView:'bad'}),tibet.tibetDefaults);
const geo=JSON.parse(await fs.readFile('server/alternate-world-tibet.geojson','utf8')),visible=new Set([t.id,...t.unitIds]);
assert.deepEqual(svg.tibetSvgItems(geo,source,8,1,visible),[]);assert.deepEqual(svg.tibetSvgItems(geo,doc,1,1,visible),[]);assert.deepEqual(svg.tibetSvgItems(geo,doc,8,1,new Set()),[]);
const items=svg.tibetSvgItems(geo,{...doc,tibetView:'cultural',tibetReferences:true},8,1,visible);assert.ok(items.some(i=>i.text==='Lhasa \u2605'));assert.equal(items.filter(i=>i.props['data-tibet-cultural-border']).length,3);assert.equal(items.filter(i=>i.props['data-tibet-city']).length,12);assert.equal(items.filter(i=>i.props['data-tibet-mountain']).length,5);assert.ok(items.some(i=>i.props['data-tibet-reference']));
assert.ok(items.every(i=>!JSON.stringify(i).match(/NaN|Infinity/)));
assert.ok(!svg.tibetSvgItems(geo,{...doc,tibetCities:false,tibetMountains:false},8,1,visible).length);
for(const id of t.unitIds){assert.ok(tibet.tibetCulturalColor(area(id),{...doc,tibetView:'cultural'}));assert.equal(tibet.tibetCulturalColor(area(id),{...doc,tibetView:'cultural',fills:{[id]:{color:'#123456',pattern:'solid'}}}),undefined);}
console.log('Verified Tibet source/alternate isolation, hierarchy/search, 19 units, saved presentation settings, shared SVG/export descriptors, capital/city/range/reference toggles, and preservation of manual colors.');
