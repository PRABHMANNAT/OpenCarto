import data from './india-punjab-scenario.json';
import type {Area,MapDoc} from './map-model';
import type {FeatureCollection} from 'geojson';
export type PunjabMapLevel='district'|'division'|'tehsil';
type Flags={indiaPunjabScenario?:boolean};
export const indiaPunjabScenario=data;
export const scenarioAddedIds=data.addedIds;
export const scenarioAddedAreas=data.addedIds.map(id=>data.areas[id as keyof typeof data.areas]) as Area[];
const areas=data.areas as Record<string,Partial<Area>&{aliases?:string[]}>;
export function indiaScenarioArea(area:Area,doc:Flags):Area{return doc.indiaPunjabScenario&&areas[area.id]?{...area,...areas[area.id]}:area;}
export const scenarioAreaVisible=(id:string,doc:Flags)=>doc.indiaPunjabScenario?!data.removedIds.includes(id):!data.addedIds.includes(id);
export const scenarioAliasText=(id:string,doc:Flags)=>doc.indiaPunjabScenario?[areas[id]?.name,areas[id]?.country,...(areas[id]?.aliases||[])].filter(Boolean).join(' '):'';
let request:Promise<FeatureCollection>|undefined;
export function loadIndiaPunjabOverrides(){
  if(!request)request=Promise.all(['world','tibet'].map(async part=>{const response=await fetch('/api/alternate-world?part='+part,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('The alternate world boundaries could not load.');return await response.json() as FeatureCollection;})).then(parts=>({type:'FeatureCollection' as const,features:parts.flatMap(part=>part.features)})).catch(error=>{request=undefined;throw error;});
  return request;
}
export function indiaScenarioCollection(original:FeatureCollection,overrides:FeatureCollection,points=false):FeatureCollection{
  const replacements=new Map(overrides.features.map(f=>[String(f.id),f]));
  const present=new Set(original.features.map(f=>String(f.id))),level=original.features[0]?.properties?.level;
  const additions=overrides.features.filter(f=>data.addedIds.includes(String(f.id))&&!present.has(String(f.id))&&f.properties?.level===level);
  const feature=(f:typeof overrides.features[number])=>points?{...f,geometry:{type:'Point' as const,coordinates:f.properties!.center}}:f;
  return {...original,features:[...original.features.filter(f=>!data.removedIds.includes(String(f.id))).map(f=>{const replacement=replacements.get(String(f.id));return replacement?feature(replacement):f;}),...additions.map(feature)]};
}
let revocation:Promise<unknown>=Promise.resolve();
export function revokeAlternateWorld(){clearAlternateBoundaries();revocation=revocation.then(()=>fetch('/api/alternate-world',{method:'DELETE',credentials:'same-origin'})).catch(()=>{});return revocation;}
export function waitForAlternateLock(){return revocation;}
export function clearAlternateBoundaries(){request=undefined;}
export function openIndiaSettings(doc:MapDoc){return {indiaPunjabScenario:true,scopeAreas:[],basemap:'political' as const,regions:{...doc.regions,world:{...doc.regions.world,show:true,province:true}}};}
