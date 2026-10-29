import data from './india-punjab-scenario.json';
import type {Area,MapDoc} from './map-model';
import type {FeatureCollection} from 'geojson';
export type PunjabMapLevel='district'|'division'|'tehsil';
type Flags={indiaPunjabScenario?:boolean};
export const indiaPunjabScenario=data;
const areas=data.areas as Record<string,Partial<Area>&{aliases?:string[]}>;
export function indiaScenarioArea(area:Area,doc:Flags):Area{return doc.indiaPunjabScenario&&areas[area.id]?{...area,...areas[area.id]}:area;}
export const scenarioAreaVisible=(id:string,doc:Flags)=>!doc.indiaPunjabScenario||!data.removedIds.includes(id);
export const scenarioAliasText=(id:string,doc:Flags)=>doc.indiaPunjabScenario?[areas[id]?.name,...(areas[id]?.aliases||[])].filter(Boolean).join(' '):'';
let request:Promise<FeatureCollection>|undefined;
export function loadIndiaPunjabOverrides(){
  if(!request)request=fetch('/api/alternate-world',{credentials:'same-origin',cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('The hypothetical India boundaries could not load.');return await response.json() as FeatureCollection;}).catch(error=>{request=undefined;throw error;});
  return request;
}
export function indiaScenarioCollection(original:FeatureCollection,overrides:FeatureCollection,points=false):FeatureCollection{
  const replacements=new Map(overrides.features.map(f=>[String(f.id),f]));
  return {...original,features:original.features.filter(f=>!data.removedIds.includes(String(f.id))).map(f=>{const replacement=replacements.get(String(f.id));return replacement?(points?{...replacement,geometry:{type:'Point' as const,coordinates:replacement.properties!.center}}:replacement):f;})};
}
let revocation:Promise<unknown>=Promise.resolve();
export function revokeAlternateWorld(){clearAlternateBoundaries();revocation=revocation.then(()=>fetch('/api/alternate-world',{method:'DELETE',credentials:'same-origin'})).catch(()=>{});return revocation;}
export function waitForAlternateLock(){return revocation;}
export function clearAlternateBoundaries(){request=undefined;}
export function openIndiaSettings(doc:MapDoc){return {indiaPunjabScenario:true,scopeAreas:[],basemap:'political' as const,regions:{...doc.regions,world:{...doc.regions.world,show:true,province:true}}};}
