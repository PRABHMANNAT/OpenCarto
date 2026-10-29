import {indiaScenarioArea} from './india-punjab-scenario';
import type {Area,MapDoc} from './map-model';

export const areaNameDefaults={areaNames:{} as Record<string,string>};
export const areaDisplayName=(area:Area,doc:Pick<MapDoc,'areaNames'>&{indiaPunjabScenario?:boolean})=>doc.areaNames?.[area.id]||indiaScenarioArea(area,doc).name;
export const cleanAreaName=(value:string)=>value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,100);
export function renamedArea(doc:Pick<MapDoc,'areaNames'>,area:Area,name:string){
 const next={...doc.areaNames},clean=cleanAreaName(name);
 if(clean&&clean!==area.name)next[area.id]=clean;else delete next[area.id];
 return next;
}
export function validateAreaNames(value:unknown,known:ReadonlyMap<string,Area>){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).flatMap(([id,name])=>{const area=known.get(id),clean=typeof name==='string'?cleanAreaName(name):'';return area&&clean&&clean!==area.name?[[id,clean]]:[];}));
}
