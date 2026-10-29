import assert from 'node:assert/strict';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const m=await loadMapModel(),s=await loadLocalModule(new URL('../app/world-style-model.ts',import.meta.url));
const countries=m.areas.filter(a=>a.region==='world'&&a.level==='region'&&m.visible(a,{...m.initial,mapScope:'world',regions:{...m.initial.regions,world:{...m.initial.regions.world,show:true}}}));
assert.equal(countries.length,218,'Source edition keeps all 218 source outlines');
const old={...m.initial,legend:true,fills:{'world-c-ind':{color:'#123456',pattern:'dots'},'world-a1-1811400B91946361694107':{color:'#abcdef',pattern:'solid'},'in-d-608':{color:'#aabbcc',pattern:'solid'}}};
for(const scheme of ['colorful','pastel','white','gray','white-gray']){
 const doc={...old,...s.applyWorldScheme(old,scheme)};
 const colors=countries.map(a=>doc.fills[a.id].color);
 if(scheme==='colorful'||scheme==='pastel')assert.equal(new Set(colors).size,countries.length);
 if(scheme==='white')assert.deepEqual([...new Set(colors)],['#ffffff']);
 if(scheme==='gray')assert.deepEqual([...new Set(colors)],['#e5e7eb']);
 if(scheme==='white-gray')assert.equal(new Set(colors).size,3);
 assert.deepEqual(doc.fills['in-d-608'],old.fills['in-d-608']);
 assert.equal(doc.fills['world-a1-1811400B91946361694107'],undefined,'Provinces inherit the country scheme');
 const round=m.validate(JSON.parse(JSON.stringify(doc)));assert.equal(round.worldColorScheme,scheme);
 const changed={...round,...s.applyWorldScheme(round,'gray')};const restored={...changed,...s.applyWorldScheme(changed,'custom')};assert.deepEqual(restored.fills,old.fills);assert.equal(restored.legend,true);
}
const before=JSON.stringify(old);s.applyWorldScheme(old,'white');assert.equal(JSON.stringify(old),before);
assert.equal(s.worldCountryLine(old).color,'#000000');assert.equal(s.worldProvinceLine(old).color,'#9ca3af');assert.ok(s.worldCountryLine(old).width>s.worldProvinceLine(old).width);
assert.equal(s.worldInternalVisible(old,false),false);assert.equal(s.worldInternalVisible({...old,worldInternalBorders:'always'},false),true);assert.equal(s.worldInternalVisible({...old,worldInternalBorders:'hidden'},true),false);
assert.deepEqual(s.validateWorldStyle({worldColorScheme:'invalid',worldProvinceBorder:'bad',worldSavedFills:{invalid:{color:'#ffffff',pattern:'solid'}}}),{...s.worldStyleDefaults,worldSavedFills:{}});
console.log('Verified unique country palettes, white/gray schemes, province inheritance, original-color restoration, save/load, malformed settings and black/gray border hierarchy.');
