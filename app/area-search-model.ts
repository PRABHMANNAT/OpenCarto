import {areas,areaById,regionById,visible,type Area,type MapDoc} from './map-model';
import {areaBelongsTo,scopeGeometryAreas,scopePreset,selectionAreas,scopeAreaAllowed} from './scope-model';
import {areaDetailVisibility} from './area-visibility-model';
import {scenarioAreaVisible,scenarioAliasText,indiaScenarioArea} from './india-punjab-scenario';

export const areaLevelNames:Record<Area['level'],string>={region:'Country / state / territory',province:'Province',division:'Division',district:'District',tehsil:'Tehsil / subdivision',uc:'Ward / union council'};
export const searchableAreas=areas.filter(a=>!['delhi-ncr','kashmir-united','tibet-modern-three'].includes(a.region));
const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[łđðħıæœßþ]/g,c=>({'ł':'l','đ':'d','ð':'d','ħ':'h','ı':'i','æ':'ae','œ':'oe','ß':'ss','þ':'th'}[c]!)).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function areaContext(a:Area){return [...new Set([areaById.get(a.parent)?.name,a.district,a.province,regionById.get(a.region)?.name].filter((v):v is string=>!!v&&v!==a.name))].join(' · ');}
const searchIndex=new Map(searchableAreas.map(a=>[a.id,normalize([a.name,a.originalName,areaContext(a),areaLevelNames[a.level],a.country,a.id].join(' '))]));
export function findAreas(query:string,level='all',region='all',doc?:Pick<MapDoc,'areaNames'>&{indiaPunjabScenario?:boolean}){
 const words=normalize(query).split(' ').filter(Boolean);
 const custom=new Map(Object.entries(doc?.areaNames||{}).map(([id,name])=>[id,normalize(name)]));
 return searchableAreas.filter(a=>scenarioAreaVisible(a.id,doc||{})&&(level==='all'||a.level===level)&&(region==='all'||a.region===region)&&words.every(word=>(searchIndex.get(a.id)!+' '+normalize(scenarioAliasText(a.id,doc||{}))+' '+(custom.get(a.id)||'')).includes(word))).sort((a,b)=>{
  const q=normalize(query),an=custom.get(a.id)||normalize(a.name),bn=custom.get(b.id)||normalize(b.name);
  return Number(bn===q)-Number(an===q)||Number(bn.startsWith(q))-Number(an.startsWith(q))||a.name.localeCompare(b.name)||areaContext(a).localeCompare(areaContext(b));
 }).map(a=>indiaScenarioArea(a,doc||{}));
}
export function hiddenArea(a:Area,doc:MapDoc){return doc.hidden.some(id=>areaBelongsTo(a,id));}
export function revealArea(a:Area,doc:MapDoc){return doc.hidden.filter(id=>!areaBelongsTo(a,id));}
export function addArea(doc:MapDoc,id:string,only=false):Partial<MapDoc>{
 const area=areaById.get(id);if(!area)return {};
 const selected=doc.mapScope==='selection'?selectionAreas(doc):scopeGeometryAreas(doc);
 const patch=scopePreset(doc,'selection',{scopeAreas:only?[id]:[...selected.map(a=>a.id),id]});
 patch.scopeAreas=selectionAreas({...doc,...patch}).map(a=>a.id);
 // Adding an existing child also enables its detail and clears hidden ancestors.
 const regions={...patch.regions,[area.region]:{...doc.regions[area.region],show:true,...(area.level==='region'?{}:{[area.level]:true})}};
 return {...patch,regions,hidden:revealArea(area,doc)};
}

// Show a result without enabling the same detail across neighbouring districts.
export function showArea(doc:MapDoc,area:Area):Partial<MapDoc>{
 let patch:Partial<MapDoc>={hidden:revealArea(area,doc),regions:{...doc.regions,[area.region]:{...doc.regions[area.region],show:true}},...(doc.mapScope==='full'?{fullDetail:true}:{})};
 let next={...doc,...patch};
 if(!visible(area,next)&&area.level!=='region'&&!(areaDetailVisibility(area,next)??next.regions[area.region]?.[area.level])){patch.areaDetails={...next.areaDetails,[area.id]:next.areaDetails[area.id]||'none'};next={...next,areaDetails:patch.areaDetails};}
 if(!scopeAreaAllowed(area,next)||!visible(area,next)){patch={...patch,...addArea(next,area.id)};next={...doc,...patch};}
 // Avoid overlapping Pakistan snapshots when a legacy source area is requested.
 if(['pk-punjab','pk-kp','islamabad'].includes(area.region)&&next.regions['pk-country']?.show)patch.regions={...next.regions,'pk-country':{...next.regions['pk-country'],show:false}};
 return patch;
}
