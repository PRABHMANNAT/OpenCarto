import {areas,areaById,regions,visible,type Area,type MapDoc,type RegionState} from './map-model';
import {areaBelongsTo,scopeGeometryAreas} from './scope-model';

export type DetailMode='none'|'province'|'district'|'tehsil'|'division'|'uc';
export type DetailTarget='visible'|'all';
export type AreaVisibilitySettings={areaDetails:Record<string,DetailMode>;regionBorders:boolean};
export const detailLabels:Record<DetailMode,string>={none:'Outlines only',province:'Provinces / states',district:'Districts',tehsil:'Tehsils / subdivisions',division:'Divisions',uc:'Wards / union councils'};
export const detailModes=Object.keys(detailLabels) as DetailMode[];
const depth:Record<Area['level'],number>={region:0,province:1,division:2,district:3,tehsil:4,uc:5};
const descendants=new Map<string,Area[]>(),modeCache=new Map<string,DetailMode[]>();
export function areaChildren(area:Area){
 if(!descendants.has(area.id))descendants.set(area.id,areas.filter(a=>a.id!==area.id&&a.region===area.region&&areaBelongsTo(a,area.id)));
 return descendants.get(area.id)!;
}
export function areaDetailOptions(area:Area){
 if(!modeCache.has(area.id)){const levels=new Set(areaChildren(area).map(a=>a.level));modeCache.set(area.id,['none',...detailModes.filter(mode=>mode!=='none'&&levels.has(mode as Area['level']))] as DetailMode[]);}
 return modeCache.get(area.id)!;
}
const overrideCache=new WeakMap<Record<string,DetailMode>,Map<string,{area:Area;mode:DetailMode}[]>>();
function overrides(doc:MapDoc){
 const record=doc.areaDetails||{},cached=overrideCache.get(record);if(cached)return cached;
 const index=new Map<string,{area:Area;mode:DetailMode}[]>();
 for(const [id,mode]of Object.entries(record)){const area=areaById.get(id);if(!area)continue;const entries=index.get(area.region)||[];entries.push({area,mode});index.set(area.region,entries);}
 for(const entries of index.values())entries.sort((a,b)=>depth[b.area.level]-depth[a.area.level]);overrideCache.set(record,index);return index;
}
export function areaDetailVisibility(area:Area,doc:MapDoc):boolean|undefined{
 const override=overrides(doc).get(area.region)?.find(entry=>areaBelongsTo(area,entry.area.id));if(!override)return;
 if(override.area.id===area.id||area.level==='region')return true;
 const mode=override.mode;
 if(mode==='none')return false;
 if(area.level==='province')return true;
 if(mode==='province')return false;
 if(mode==='division')return area.level==='division';
 return area.level==='district'||(area.level==='tehsil'&&(mode==='tehsil'||mode==='uc'))||(area.level==='uc'&&mode==='uc');
}
const regionCache=new WeakMap<MapDoc,string[]>();
export function detailRegionIds(doc:MapDoc,target:DetailTarget){
 if(target==='all')return regions.map(r=>r.id);
 if(!regionCache.has(doc))regionCache.set(doc,[...new Set(areas.filter(a=>visible(a,doc)).map(a=>a.region))]);
 return regionCache.get(doc)!;
}
function regionFlags(mode:DetailMode):Pick<RegionState,'province'|'district'|'tehsil'|'division'|'uc'>{
 return {province:mode!=='none',district:['district','tehsil','uc'].includes(mode),tehsil:['tehsil','uc'].includes(mode),division:mode==='division',uc:mode==='uc'};
}
function detailRoots(doc:MapDoc,target:DetailTarget){return target==='all'?regions.map(r=>areaById.get(r.id)).filter((a):a is Area=>!!a):scopeGeometryAreas(doc).filter(a=>areaShown(a,doc));}
export function mapDetailValue(doc:MapDoc,target:DetailTarget):DetailMode|'mixed'{
 const roots=detailRoots(doc,target);if(!roots.length||target==='visible'&&doc.mapScope==='full'&&!doc.fullDetail)return 'none';
 const rootIds=new Set(roots.map(a=>a.id)),entries=Object.entries(doc.areaDetails||{});
 if(entries.some(([id])=>{const a=areaById.get(id);return a&&!rootIds.has(id)&&roots.some(root=>areaBelongsTo(a,root.id));}))return 'mixed';
 const modes=roots.map(root=>overrides(doc).get(root.region)?.find(entry=>areaBelongsTo(root,entry.area.id))?.mode||(()=>{const r=doc.regions[root.region];return r?.uc?'uc':r?.tehsil?'tehsil':r?.district?'district':r?.division?'division':r?.province?'province':'none';})());
 return modes.every(mode=>mode===modes[0])?modes[0]:'mixed';
}
export function setMapDetail(doc:MapDoc,mode:DetailMode,target:DetailTarget):Partial<MapDoc>{
 const roots=detailRoots(doc,target),nextRegions={...doc.regions};
 const areaDetails=Object.fromEntries(Object.entries(doc.areaDetails||{}).filter(([id])=>{const a=areaById.get(id);return !a||!roots.some(root=>areaBelongsTo(a,root.id));}));
 for(const root of roots){if(root.level==='region'&&nextRegions[root.region])nextRegions[root.region]={...nextRegions[root.region],...regionFlags(mode)};areaDetails[root.id]=mode;}
 return {regions:nextRegions,areaDetails,...(doc.mapScope==='full'?{fullDetail:true}:{})};
}
export function setAreaDetail(doc:MapDoc,area:Area,mode:DetailMode|'inherit'):Partial<MapDoc>{
 const areaDetails=Object.fromEntries(Object.entries(doc.areaDetails||{}).filter(([id])=>{const child=areaById.get(id);return !child||!areaBelongsTo(child,area.id);}));
 if(mode!=='inherit')areaDetails[area.id]=mode;
 return {areaDetails,...(doc.mapScope==='full'?{fullDetail:true}:{})};
}
export function areaShown(area:Area,doc:MapDoc){return visible(area,doc)||(area.level==='region'?detailRegionIds(doc,'visible').includes(area.region):areaChildren(area).some(child=>visible(child,doc)));}
export function areaBorderVisible(area:Area,doc:MapDoc){return doc.borders&&(area.level==='region'?doc.regionBorders:area.level==='province'?doc.provinceBorders:area.level==='district'?doc.districtBorders:area.level==='tehsil'?doc.tehsilBorders:area.level==='division'?doc.divisionBorders:doc.detailBorders);}
export function validateAreaVisibility(value:unknown):AreaVisibilitySettings{
 const x=value&&typeof value==='object'?value as Partial<AreaVisibilitySettings>:{};
 return {regionBorders:typeof x.regionBorders==='boolean'?x.regionBorders:true,areaDetails:x.areaDetails&&typeof x.areaDetails==='object'&&!Array.isArray(x.areaDetails)?Object.fromEntries(Object.entries(x.areaDetails).filter(([id,mode])=>areaById.has(id)&&detailModes.includes(mode))):{}};
}

// Shape tools select the finest visible linked units, including local overrides.
export function selectableAreas(doc:MapDoc){
 const candidates=areas.filter(a=>(a.level!=='region'||a.region==='world')&&a.level!=='division'&&visible(a,doc)),parents=new Set<string>();
 for(const area of candidates){const seen=new Set<string>();let parent=area.parent;while(parent&&!seen.has(parent)){seen.add(parent);parents.add(parent);parent=areaById.get(parent)?.parent||'';}}
 return candidates.filter(a=>!parents.has(a.id));
}
