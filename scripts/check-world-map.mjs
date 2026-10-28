import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadLocalModule,loadMapModel} from './load-map-model.mjs';
const model=await loadMapModel();
const scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url));
const world=await loadLocalModule(new URL('../app/world-map-model.ts',import.meta.url));
const search=await loadLocalModule(new URL('../app/area-search-model.ts',import.meta.url));
const {selectableAreas}=await loadLocalModule(new URL('../app/area-visibility-model.ts',import.meta.url));
const navigation=await loadLocalModule(new URL('../app/map-navigation-model.ts',import.meta.url));
const visibility=await loadLocalModule(new URL('../app/visibility-geometry.ts',import.meta.url));
const before={...model.initial,fills:{'in-d-608':{color:'#123456',pattern:'dots'}}};
const doc={...before,...scope.scopePreset(before,'world',{scopeAreas:[]})};
const visible=model.areas.filter(a=>model.visible(a,doc));
assert.equal(visible.length,3420);
assert.equal(visible.filter(a=>a.level==='region').length,218);
assert.equal(visible.filter(a=>a.level==='province').length,3202);
assert.ok(visible.every(a=>a.region==='world'&&['region','province'].includes(a.level)));
assert.deepEqual(doc.fills,before.fills,'World view preserves regional custom colors');
assert.deepEqual(model.validate(doc).mapScope,'world');
assert.deepEqual(model.validate(doc).regions.world,doc.regions.world);
assert.equal(model.areas.filter(a=>model.visible(a,model.initial)&&a.region==='world').length,0);
assert.deepEqual(scope.scopeFocusBounds(doc),[-180,-90,180,90]);
assert.deepEqual(visibility.hiddenGeometryKeys({...doc,hidden:['in-punjab']}),[],'Regional hidden masks cannot punch holes in the world view');
assert.deepEqual(visibility.hiddenGeometryKeys({...model.initial,hidden:['world-c-ind']}),[],'World hidden masks cannot change the regional map');
const focusedWorld={...doc,scopeAreas:['world-c-gbr']};
const completeWorld={...focusedWorld,...navigation.completeMapPatch(focusedWorld)};
assert.equal(completeWorld.mapScope,'world');assert.deepEqual(completeWorld.scopeAreas,[]);
assert.deepEqual(navigation.selectedMapPatch(completeWorld).scopeAreas,['world-c-gbr']);
for(const code of ['usa','ind','aus','gbr','fra','bra','jpn','zaf']){
  const id='world-c-'+code;
  const selected={...doc,scopeAreas:[id]};
  assert.ok(model.areas.filter(a=>model.visible(a,selected)).every(a=>a.id===id||a.parent===id));
}
const unitedKingdom=model.areas.filter(a=>a.parent==='world-c-gbr');
assert.deepEqual(unitedKingdom.map(a=>a.name).sort(),['England','Northern Ireland','Scotland','Wales']);
assert.equal(model.areas.filter(a=>a.parent==='world-c-usa').length,56,'USA source includes states, DC and five territories');
assert.ok(search.findAreas('California','all','world').some(a=>a.parent==='world-c-usa'));
const outlines={...doc,regions:{...doc.regions,world:{...doc.regions.world,province:false}}};
assert.equal(model.areas.filter(a=>model.visible(a,outlines)).length,218);
assert.equal(selectableAreas(outlines).length,218,'Countries can be painted and selected');
assert.equal(selectableAreas(doc).filter(a=>a.parent==='world-c-gbr').length,4);
const sources=world.worldSource;
for(const [key,manifest] of Object.entries(sources.layers)){
  const bytes=await fs.readFile(new URL('../public/data/'+key+'.geojson',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
  const geo=JSON.parse(bytes);
  const labels=JSON.parse(await fs.readFile(new URL('../public/data/'+key+'-labels.geojson',import.meta.url),'utf8'));
  assert.equal(geo.features.length,manifest.count);
  assert.equal(new Set(geo.features.map(f=>f.id)).size,manifest.count);
  assert.deepEqual(labels.features.map(f=>f.id),geo.features.map(f=>f.id));
  for(const f of geo.features){
    assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type));
    assert.ok(model.areaById.has(f.id));
    assert.ok(f.bbox.every(Number.isFinite));
    if(f.properties.level==='province'){
      assert.equal(f.properties.sourceLevel,'ADM1');
      assert.ok(model.areaById.has(f.properties.parent));
    }
  }
}
console.log('Verified 218 country/context outlines, 3,202 ADM1 divisions, strict two-level world scope, source hashes, parent links, search, country painting, country focus, save compatibility and unchanged default regional map.');
