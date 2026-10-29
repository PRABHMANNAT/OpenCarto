import raw from './world-areas.json';
import {worldSchemeColor,type WorldStyleSettings} from './world-style-model';
import {indiaScenarioArea,scenarioAreaVisible,scenarioAddedAreas} from './india-punjab-scenario';
import sources from './world-sources.json';
import type {Area, MapDoc} from './map-model';

export const worldAreas = [...raw,...scenarioAddedAreas] as Area[];
export const worldCountries = [...sources.countries,...scenarioAddedAreas.filter(a=>a.level==='region').map(a=>({id:a.id,name:a.name,code:a.sourceCode||a.id,divisions:0}))];
export const worldSource = sources;
export const worldBounds = [-180, -90, 180, 90];
export const worldNotice = 'World countries & first-level divisions · geoBoundaries CGAZ · Runfola et al. (2020), https://doi.org/10.1371/journal.pone.0231866 · CC BY 4.0. Simplified source snapshot; disputed areas follow US Department of State definitions. No ADM2 or lower units.';
export const isWorldArea = (area: Area) => area.region === 'world';
export function worldDefaultPaint(area: Area, doc: Pick<MapDoc,'paintPalette'>&Partial<WorldStyleSettings>&{indiaPunjabScenario?:boolean}) {
  if (!isWorldArea(area)) return undefined;
  area=indiaScenarioArea(area,doc);
  const code=area.parent||area.id;
  if(doc.worldColorScheme&&doc.worldColorScheme!=='custom')return {color:worldSchemeColor(code,doc.worldColorScheme),pattern:'solid'};
  if(!doc.paintPalette.length)return undefined;
  const hash=Array.from(code).reduce((value,letter)=>(value*31+letter.charCodeAt(0))>>>0,0);
  return {color:doc.paintPalette[hash%doc.paintPalette.length].hex,pattern:'solid'};
}
export function worldAreaAllowed(area: Area, doc: Pick<MapDoc, 'scopeAreas'>&{indiaPunjabScenario?:boolean}) {
  area=indiaScenarioArea(area,doc);
  return isWorldArea(area) && scenarioAreaVisible(area.id,doc) && (!doc.scopeAreas.length || doc.scopeAreas.includes(area.id) || doc.scopeAreas.includes(area.parent));
}
export function worldFocusBounds(area?: Area,doc:{indiaPunjabScenario?:boolean}={}) {
  const updated=area?indiaScenarioArea(area,doc):undefined;
  const b = updated?.focusBounds || updated?.bbox || worldBounds;
  return [Math.max(-180,b[0]),Math.max(-90,b[1]),Math.min(180,b[2]),Math.min(90,b[3])];
}
