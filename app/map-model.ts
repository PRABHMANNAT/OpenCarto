import raw from './catalog.json';
import {worldStyleDefaults,validateWorldStyle,type WorldStyleSettings} from './world-style-model';
import {scenarioAreaVisible} from './india-punjab-scenario';
import {worldAreas, worldSource} from './world-map-model';
import {paintPaletteDefaults,validatePaintPalette,type PaintPaletteSettings} from './paint-palette-model';
import caseStudyAreas from './case-study-area-data.json';
import {caseStudyDefaults,validateCaseStudySettings,caseStudyIncludes,isCaseStudyMap,type CaseStudySettings} from './case-study-model';
import {areaNameDefaults,validateAreaNames} from './area-name-model';
import {validateAreaVisibility,areaDetailVisibility,type AreaVisibilitySettings} from './area-visibility-model';
import indianSources from './indian-region-sources.json';
import delhiData from './delhi-map-sources.json';
import neighbourData from './neighbour-country-sources.json';
import pakistanDivisions from './pakistan-division-areas.json';
import pakistanDivisionSources from './pakistan-division-sources.json';
import {scopeDefaults,validateScopeSettings,scopeAreaAllowed,scopeLevelAllowed,scopePrimaryArea,scopeRegionAllowed,areaBelongsTo,scopeNavigation,type ScopeSettings,type ScopeNavigation} from './scope-model';
import {overlayDefaults,validateOverlaySettings,type OverlaySettings} from './overlay-model';
import {demographicDefaults,validateDemographicSettings,type DemographicSettings} from './demographic-model';
import {empireDefaults,validateEmpireSettings,type EmpireSettings} from './empire-model';
export const countrySources=neighbourData;
export const countries=neighbourData.countries;
export const countryById=new Map(countries.map(c=>[c.id,c]));
export const countryViews=neighbourData.views;
export const countryViewById=new Map(countryViews.map(v=>[v.id,v]));
export const delhiSources=delhiData;
export type Level='region'|'province'|'division'|'district'|'tehsil'|'uc';
export type Area={id:string;name:string;region:string;level:Level;parent:string;center:number[];bbox:number[];focusBounds?:number[];source:string;district?:string;town?:string;municipality?:string;province?:string;country?:string;sourceCode?:string;sourceParentCode?:string;sourceLevel?:string;sourceValidOn?:string};
export const areas=[...raw,...pakistanDivisions,...caseStudyAreas,...worldAreas] as Area[];
export const areaById=new Map(areas.map(a=>[a.id,a]));
// Static indexes keep layer updates linear in the loaded areas, not the full atlas per layer.
export const areasByLayer=new Map<string,Area[]>();
for(const a of areas){const key=a.region+'-'+a.level;const list=areasByLayer.get(key);if(list)list.push(a);else areasByLayer.set(key,[a])}
export const ucParents=new Set(areas.filter(a=>a.level==='uc').map(a=>a.parent));
export const divisionRegions=new Set(areas.filter(a=>a.level==='division').map(a=>a.region));
const tehsilRegions=new Set(['in-haryana','in-himachal','in-rajasthan','in-uttar-pradesh','in-uttarakhand','in-jammu-kashmir','in-ladakh','in-punjab','pk-punjab','pk-kp']);
export const layerLabel=(id:string,level:'province'|'district'|'tehsil')=>{if(id==='world')return level==='province'?'First-level divisions':level==='district'?'Districts (not included)':'Subdistricts (not included)';const labels=countryById.get(id)?.labels as Partial<Record<Level,string>>|undefined;return labels?.[level]||(level==='province'?'Provinces':level==='district'?'Districts':['in-andhra','in-telangana'].includes(id)?'Mandals':id==='in-tamil-nadu'?'Taluks':tehsilRegions.has(id)?'Tehsils':'Subdistricts')};
export const subdistrictLabel=(id:string)=>layerLabel(id,'tehsil');
export const coverageNotes=new Map(indianSources.regions.map(r=>{
 const source=r as {districtsWithoutLinkedTehsils?:string[];omittedUnnamedTehsilRecords?:number};
 const gaps=source.districtsWithoutLinkedTehsils||[],unnamed=source.omittedUnnamedTehsilRecords||0;
 return [r.id,[gaps.length?`${gaps.length} source district${gaps.length===1?' has':'s have'} no linked subdistrict detail: ${gaps.join(', ')}. Source parent links are retained.`:'',unnamed?`${unnamed} unnamed source subdistrict record${unnamed===1?' is':'s are'} excluded from administrative listings.`:''].filter(Boolean).join(' ')];
}));
coverageNotes.set('in-delhi','2024 source: 11 districts and 34 named subdivision areas. Delhi reorganized into 13 districts in December 2025; these are not current revenue boundaries.');
for(const c of countries)coverageNotes.set(c.id,c.notes+' Published source snapshot, not a complete current register.');
coverageNotes.set('pk-country',coverageNotes.get('pk-country')+' 36 source-era division unions cover all 159 non-Islamabad districts; membership uses PBS March 2023 with documented edition reconciliations. Islamabad has no invented division.');
export const pakistanDivisionData=pakistanDivisionSources;
const snapshotCoverage=(id:string)=>`${areasByLayer.get(id+'-district')?.length||0} districts · ${areasByLayer.get(id+'-tehsil')?.length||0} named ${id==='in-andhra'?'mandal':'subdistrict'} areas · LGD 2024`;
coverageNotes.set('world',worldSource.notes);
export const regions=[{id:'world',name:'World · countries & first-level divisions',date:worldSource.layers['world-region'].count+' countries / territories · '+worldSource.layers['world-province'].count+' ADM1 units'},{id:'pk-lahore-study',name:'Lahore · case-study selection',date:'City + Shalimar + Cantonment · OSM October 2026'}, {id:'in-punjab',name:'Punjab · India',date:'23 districts · 79 tehsil polygons'},...indianSources.regions.map(r=>({id:r.id,name:r.name,date:snapshotCoverage(r.id)})),{id:'pk-punjab',name:'Punjab · Pakistan',date:'36 districts · 147 tehsil polygons'},{id:'pk-kp',name:'Selected KP divisions',date:'20 districts · 72 tehsil polygons'},{id:'islamabad',name:'Islamabad',date:'Capital territory · 1 source subdivision'},{id:'chandigarh',name:'Chandigarh',date:'Union territory · 28 historical wards'},...countries.map(c=>({id:c.id,name:c.name,date:(['province','district','tehsil'] as const).filter(l=>areasByLayer.has(c.id+'-'+l)).map(l=>`${areasByLayer.get(c.id+'-'+l)!.length} ${layerLabel(c.id,l).toLowerCase()}`).join(' · ')+' · '+c.validOn.join(', ')}))];
export const regionById=new Map(regions.map(r=>[r.id,r]));
export const levels:Level[]=['region','province','district','tehsil','uc','division'];
export const layerKeys=[...areasByLayer.keys()];
export type Paint={color:string;pattern:string};
export type RegionState={show:boolean;province:boolean;district:boolean;tehsil:boolean;uc:boolean;division:boolean};
export const delhiViews=[['none','Regional atlas'],['nct','Delhi · NCT'],['old-delhi','Old Delhi · city focus'],['new-delhi','New Delhi · city focus'],['ncr','Delhi NCR · reconstruction'],['ndmc','NDMC · historical charges'],['cantt','Delhi Cantonment · historical charges'],['north','North Delhi · source districts'],['east','East Delhi · source districts'],['south','South Delhi · source districts'],['west','West Delhi · source districts'],['noida','Noida · district context'],['gurugram','Gurugram · district context']] as const;
export type DelhiView=typeof delhiViews[number][0];
export type MetroLineState={show:boolean;color:string};
export const defaultMetroLines=()=>Object.fromEntries(delhiSources.metro.lines.map(l=>[l.id,{show:true,color:l.color}])) as Record<string,MetroLineState>;
export type MapDoc=WorldStyleSettings&PaintPaletteSettings&ScopeSettings&OverlaySettings&DemographicSettings&EmpireSettings&CaseStudySettings&AreaVisibilitySettings&{historyReturn:{before:MapDoc;applied:MapDoc}|null;viewReturn:ScopeNavigation|null;areaNames:Record<string,string>;countryView:string;delhiView:DelhiView;delhiMunicipality:'all'|'mcd'|'ndmc'|'cantt';delhiMetro:boolean;metroStations:boolean;metroLabels:boolean;metroLines:Record<string,MetroLineState>;kashmirView:'separate'|'combined';basemap:string;cities:boolean;rivers:boolean;opacity:number;fills:Record<string,Paint>;groups:Record<string,string>;regions:Record<string,RegionState>;hidden:string[];title:string;legendTitle:string;bg:string;uncolored:string;border:string;names:boolean;borders:boolean;provinceBorders:boolean;districtBorders:boolean;tehsilBorders:boolean;divisionBorders:boolean;detailBorders:boolean;width:number;labelSize:number;legend:boolean;legendX:number;legendY:number};
// Visibility helpers depend on this catalog; keep their initial settings literal here.
export const initial:MapDoc={...worldStyleDefaults,...paintPaletteDefaults,historyReturn:null,viewReturn:null,...scopeDefaults,...overlayDefaults,...demographicDefaults,...empireDefaults,...caseStudyDefaults,...areaNameDefaults,areaDetails:{},regionBorders:true,countryView:'',delhiView:'none',delhiMunicipality:'all',delhiMetro:false,metroStations:true,metroLabels:true,metroLines:defaultMetroLines(),kashmirView:'separate',basemap:"political",cities:false,rivers:false,opacity:0.22,fills:{},groups:{},regions:Object.fromEntries(regions.map(r=>[r.id,{show:r.id!=='world'&&r.id!=='pk-lahore-study'&&!countryById.has(r.id),province:areasByLayer.has(r.id+'-province'),district:true,tehsil:r.id==='in-haryana'||r.id==='in-himachal',uc:false,division:true}])),hidden:[],title:'The Punjab & neighbouring regions',legendTitle:'Legend',bg:'#ffffff',uncolored:'#e7edf2',border:'#526477',names:true,borders:true,provinceBorders:true,districtBorders:true,tehsilBorders:true,divisionBorders:true,detailBorders:true,width:1,labelSize:12,legend:true,legendX:76,legendY:66};
export const paintKey=(p:Paint)=>p.color+'|'+p.pattern;
export const isKashmirPart=(id:string)=>id==='in-jammu-kashmir'||id==='in-ladakh';
const ncrDistrictIds=new Set(delhiSources.ncr.districtIds);
const ncrRajasthanParents=new Set(delhiSources.ncr.rajasthanParentIds);
export function inNcr(a:Area){return a.region==='in-delhi'||ncrDistrictIds.has(a.id)||ncrDistrictIds.has(a.parent)||(a.level==='tehsil'&&ncrRajasthanParents.has(a.parent))}
export function inCountryScope(a:Area,d:MapDoc){return !d.countryView||a.region===d.countryView||!!countryViewById.get(d.countryView)?.regionIds.includes(a.region)}
export function visible(a:Area,d:MapDoc){if(!scenarioAreaVisible(a.id,d))return false;if(!scopeAreaAllowed(a,d)||!scopeLevelAllowed(a,d))return false;const context=countryViewById.get(d.countryView);if(countryViewById.has(a.region))return d.countryView===a.region&&!hiddenByAncestor(a,d);if(d.countryView&&!(context?context.regionIds.includes(a.region):a.region===d.countryView))return false;if(context&&a.level==='region'&&context.regionIds.includes(a.region))return false;if(d.regions['pk-country']?.show&&scopeRegionAllowed('pk-country',d)&&(d.mapScope!=='selection'||d.scopeAreas.includes('pk-country'))&&['pk-punjab','pk-kp','islamabad'].includes(a.region)&&!(isCaseStudyMap(d)&&d.mapScope==='full'&&a.level!=='region'&&caseStudyIncludes(a)))return false;if(a.region==='delhi-ncr')return d.delhiView==='ncr'&&!d.hidden.includes(a.id);if(d.delhiView==='ncr'&&!inNcr(a))return false;if(a.region==='kashmir-united')return d.kashmirView==='combined'&&!d.hidden.includes(a.id);if(a.level==='region'&&isKashmirPart(a.region)&&d.kashmirView==='combined')return false;if(a.region==='in-delhi'&&a.level==='uc'&&d.delhiMunicipality!=='all'&&a.municipality!==d.delhiMunicipality)return false;const r=d.regions[a.region];return !!r?.show&&(a.level==='region'||scopePrimaryArea(a,d)||(areaDetailVisibility(a,d)??r[a.level]))&&!hiddenByAncestor(a,d)}
export function effectivePaint(a:Area,d:MapDoc){const seen=new Set<string>();let current:Area|undefined=a;while(current&&!seen.has(current.id)){seen.add(current.id);const paint=d.fills[current.id];if(paint)return paint;current=areaById.get(current.parent)}return undefined}
export function mapPaintGroups(d:MapDoc){const paints=d.caseStudyId==='sikh-heritage-core'?areas.filter(a=>visible(a,d)).map(a=>effectivePaint(a,d)).filter((p):p is Paint=>!!p):Object.values(d.fills);return [...new Map(paints.map(p=>[paintKey(p),p])).entries()];}
function hiddenByAncestor(a:Area,d:MapDoc){return d.hidden.some(id=>areaBelongsTo(a,id));}
export function bounds(list:Area[]){return list.reduce((b,a)=>[Math.min(b[0],a.bbox[0]),Math.min(b[1],a.bbox[1]),Math.max(b[2],a.bbox[2]),Math.max(b[3],a.bbox[3])],[180,90,-180,-90])}
export const allBounds=bounds(areas.filter(a=>a.level==='region'&&a.region!=='world'&&a.region!=='delhi-ncr'&&!countryViewById.has(a.region)));
export function countryFocusBounds(id:string){return countryViewById.get(id)?.bbox||areaById.get(id)?.bbox||allBounds}
export function countryPreset(d:MapDoc,id:string):Partial<MapDoc>{const ids=countryViewById.get(id)?.regionIds||(countryById.has(id)?[id]:[]),nextRegions={...d.regions};for(const region of ids)nextRegions[region]={...nextRegions[region],show:true,province:areasByLayer.has(region+'-province'),district:areasByLayer.has(region+'-district')};return {mapScope:'atlas',countryView:id,delhiView:'none',regions:nextRegions};}
export function delhiFocusBounds(view:DelhiView){
 if(view==='none')return allBounds;
 if(view==='ncr')return delhiSources.ncr.bbox;
 if(view==='old-delhi')return [77.213,28.644,77.254,28.675];
 if(view==='new-delhi')return [77.16,28.57,77.25,28.642];
 if(view==='ndmc'||view==='cantt')return bounds(areas.filter(a=>a.region==='in-delhi'&&a.level==='uc'&&a.municipality===view));
 const districts:Record<string,string[]>={north:['in-delhi-d-80','in-delhi-d-82'],east:['in-delhi-d-78','in-delhi-d-81','in-delhi-d-671'],south:['in-delhi-d-83','in-delhi-d-670'],west:['in-delhi-d-84','in-delhi-d-85'],noida:['in-uttar-pradesh-d-144'],gurugram:['in-haryana-d-62']};
 return districts[view]?bounds(districts[view].map(id=>areaById.get(id)!)):areaById.get('in-delhi')!.bbox;
}
export function delhiPreset(d:MapDoc,view:DelhiView):Partial<MapDoc>{
 const nextRegions={...d.regions};
 nextRegions['in-delhi']={...nextRegions['in-delhi'],show:true};
 const municipality=view==='ndmc'||view==='cantt'?view:'all';
 if(view==='ndmc'||view==='cantt')nextRegions['in-delhi']={...nextRegions['in-delhi'],district:false,tehsil:false,uc:true};
 if(view==='ncr')for(const id of ['in-haryana','in-uttar-pradesh','in-rajasthan'])nextRegions[id]={...nextRegions[id],show:true,district:id!=='in-rajasthan',tehsil:id==='in-rajasthan'||nextRegions[id].tehsil};
 if(view==='noida'||view==='gurugram'){const id=view==='noida'?'in-uttar-pradesh':'in-haryana';nextRegions[id]={...nextRegions[id],show:true,district:true,tehsil:true};}
 return {mapScope:'atlas',countryView:'',delhiView:view,delhiMunicipality:municipality,regions:nextRegions};
}
export const activeMetroLines=(d:MapDoc)=>delhiSources.metro.lines.filter(l=>d.delhiMetro&&d.metroLines[l.id]?.show);
export const metroStationVisible=(lineIds:string[],d:MapDoc)=>d.delhiMetro&&d.metroStations&&lineIds.some(id=>d.metroLines[id]?.show);
export function validate(v:unknown,allowHistory=true,allowView=true):MapDoc{const x=v as MapDoc;if(!x||typeof x!=='object'||!x.fills||Array.isArray(x.fills))throw Error('Invalid map');const hex=(s:unknown)=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);const fills:Record<string,Paint>={};for(const [id,p]of Object.entries(x.fills)){const migrated=areaById.has(id)?id:'in-d-'+id;if(!areaById.has(migrated)||!p||!hex(p.color)||!['solid','stripes','dots','cross'].includes(p.pattern))throw Error('Invalid map color');fills[migrated]=p}const r:MapDoc={...initial,fills,regions:structuredClone(initial.regions),groups:{},hidden:[]};for(const k of ['title','legendTitle'] as const)if(typeof x[k]==='string')r[k]=x[k].slice(0,100);for(const k of ['bg','border','uncolored'] as const)if(hex(x[k]))r[k]=x[k];for(const k of ['names','borders','legend','provinceBorders','districtBorders','tehsilBorders','divisionBorders','detailBorders'] as const)if(typeof x[k]==='boolean')r[k]=x[k];for(const [k,min,max]of [['width',.2,4],['labelSize',9,20],['legendX',0,80],['legendY',0,90]] as const)if(Number.isFinite(x[k]))r[k]=Math.min(max,Math.max(min,x[k]));if(x.groups&&typeof x.groups==='object')r.groups=Object.fromEntries(Object.entries(x.groups).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,v.slice(0,80)]));if(Array.isArray(x.hidden))r.hidden=x.hidden.filter(id=>typeof id==='string'&&areaById.has(id));for(const region of regions)for(const k of ['show','province','district','tehsil','division','uc'] as const)if(typeof x.regions?.[region.id]?.[k]==='boolean')r.regions[region.id][k]=x.regions[region.id][k];if(['political','satellite','physical','rivers','streets'].includes(x.basemap))r.basemap=x.basemap;if(x.kashmirView==='combined')r.kashmirView='combined';if(typeof x.cities==='boolean')r.cities=x.cities;if(typeof x.rivers==='boolean')r.rivers=x.rivers;if(Number.isFinite(x.opacity))r.opacity=Math.min(1,Math.max(0,x.opacity));r.areaNames=validateAreaNames(x.areaNames,areaById);Object.assign(validateDelhiSettings(x,r),validateScopeSettings(x),validateOverlaySettings(x),validateDemographicSettings(x),validateEmpireSettings(x),validateCaseStudySettings(x),validateAreaVisibility(x),validatePaintPalette(x),validateWorldStyle(x));return validateReturnSettings(x,r,allowHistory,allowView)}
function validateReturnSettings(x:MapDoc,r:MapDoc,allowHistory:boolean,allowView:boolean){
 // Return snapshots contain at most one history snapshot and one geography view.
 // Invalid older backups are discarded independently of the visible map.
 if(allowHistory&&x.historyReturn)try{
  const before=validate(x.historyReturn.before,false),applied=validate(x.historyReturn.applied,false);
  r.historyReturn={before:{...before,empireId:'none',caseStudyId:'none'},applied};
 }catch{}
 if(allowView&&x.viewReturn)try{r.viewReturn=scopeNavigation(validate({...initial,...x.viewReturn,fills:{}},false,false));}catch{}
 return r;
}
// Missing new fields in older settings receive safe defaults; unknown source line
// IDs and malformed colors are discarded without losing the user's area paints.
export function validateDelhiSettings(x:Partial<MapDoc>,r:MapDoc){
 r.metroLines=defaultMetroLines();
 if(typeof x.countryView==='string'&&(countryById.has(x.countryView)||countryViewById.has(x.countryView)))r.countryView=x.countryView;
 if(delhiViews.some(([id])=>id===x.delhiView))r.delhiView=x.delhiView!;
 if(['all','mcd','ndmc','cantt'].includes(x.delhiMunicipality||''))r.delhiMunicipality=x.delhiMunicipality!;
 if(typeof x.delhiMetro==='boolean')r.delhiMetro=x.delhiMetro;
 if(typeof x.metroStations==='boolean')r.metroStations=x.metroStations;
 if(typeof x.metroLabels==='boolean')r.metroLabels=x.metroLabels;
 else if(typeof x.names==='boolean')r.metroLabels=x.names;
 for(const id of Object.keys(r.metroLines)){const line=x.metroLines?.[id];if(!line||typeof line!=='object')continue;if(typeof line.show==='boolean')r.metroLines[id].show=line.show;if(typeof line.color==='string'&&/^#[0-9a-f]{6}$/i.test(line.color))r.metroLines[id].color=line.color;}
 return r;
}
export function download(blob:Blob,name:string){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)}

