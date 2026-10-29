import raw from './catalog.json';
import {indiaScenarioArea} from './india-punjab-scenario';
import {worldAreas,worldBounds,worldFocusBounds,worldAreaAllowed,worldNotice} from './world-map-model';
import caseStudyAreas from './case-study-area-data.json';
import pakistanDivisions from './pakistan-division-areas.json';
import type {Area,MapDoc} from './map-model';

export const scopeModes=['atlas','world','full','single','combination','tricity','historic-punjab','selection'] as const;
export type ScopeMode=typeof scopeModes[number];
export type ScopeSettings={indiaPunjabScenario:boolean;mapScope:ScopeMode;scopeRegion:string;scopeRegions:string[];historicRegions:string[];fullDetail:boolean;scopeAreas:string[]};
export type ScopeDocument=Pick<MapDoc,'regions'|'countryView'|'delhiView'|'kashmirView'>&Partial<ScopeSettings>&Partial<Pick<MapDoc,'caseStudyId'>>;
export type ScopeNavigation=ScopeSettings&Pick<MapDoc,'regions'|'countryView'|'delhiView'|'kashmirView'|'hidden'|'areaDetails'>;
export function scopeNavigation(doc:MapDoc):ScopeNavigation{
 const {indiaPunjabScenario,mapScope,scopeRegion,scopeRegions,historicRegions,fullDetail,scopeAreas,regions,countryView,delhiView,kashmirView,hidden,areaDetails}=doc;
 return structuredClone({indiaPunjabScenario,mapScope,scopeRegion,scopeRegions,historicRegions,fullDetail,scopeAreas,regions,countryView,delhiView,kashmirView,hidden,areaDetails});
}
export const defaultHistoricRegions=['in-punjab','pk-punjab','in-haryana','in-himachal','chandigarh'];
export const scopeDefaults:ScopeSettings={indiaPunjabScenario:false,mapScope:'atlas',scopeRegion:'in-delhi',scopeRegions:['in-punjab','pk-punjab'],historicRegions:[...defaultHistoricRegions],fullDetail:false,scopeAreas:[]};
const catalog=[...raw,...pakistanDivisions,...caseStudyAreas,...worldAreas] as Area[];
const byId=new Map(catalog.map(a=>[a.id,a]));
const syntheticRegions=new Set(['delhi-ncr','kashmir-united','tibet-modern-three','pk-lahore-study']);
export const scopeRegions=catalog.filter(a=>a.level==='region'&&a.region!=='world'&&!syntheticRegions.has(a.region)).map(a=>({id:a.region,name:a.name,bbox:a.bbox}));
const regionIds=new Set(scopeRegions.map(r=>r.id));
export const tricityAreaIds=['chandigarh','in-d-608','in-haryana-d-70'];
const tricityParents=new Set(tricityAreaIds);
const tibetRegions=['cn-tibet','cn-qinghai','cn-sichuan'];
const pakistanLegacyRegions=['pk-punjab','pk-kp','islamabad'];
// Division membership follows the existing source unions, not bounding boxes.
const districtDivisions=new Map<string,string[]>();
for(const division of pakistanDivisions){
 for(const id of division.districtIds)districtDivisions.set(id,[...(districtDivisions.get(id)||[]),division.id]);
 const legacy=catalog.find(a=>a.level==='division'&&a.region!=='pk-country'&&a.name===division.name+' Division');
 if(legacy)for(const id of division.sourceDistrictCodes)if(byId.has(id))districtDivisions.set(id,[...(districtDivisions.get(id)||[]),legacy.id]);
}
const ancestors=new Map<string,Set<string>>();
for(const a of catalog){
 const ids=new Set([a.id,a.region]);let current:Area|undefined=a;
 while(current){for(const division of districtDivisions.get(current.id)||[])ids.add(division);if(!current.parent||ids.has(current.parent))break;ids.add(current.parent);current=byId.get(current.parent);}
 ancestors.set(a.id,ids);
}
export const areaBelongsTo=(a:Area,id:string)=>ancestors.get(a.id)?.has(id)||false;
export function selectionAreas(d:ScopeDocument){
 const selected=(d.scopeAreas||[]).map(id=>byId.get(id)).filter((a):a is Area=>!!a).map(a=>indiaScenarioArea(a,d));
 return selected.filter(a=>!selected.some(parent=>parent.id!==a.id&&areaBelongsTo(a,parent.id)));
}
export const scopeQualifications={
 tricity:'Chandigarh + S A S Nagar (Mohali) district + Panchkula district. This is a union of the supplied administrative areas, not an exact urban, municipal or planning boundary of the Tricity.',
 historicPunjab:'User-editable modern administrative context. The initial selection uses Indian Punjab, Pakistani Punjab, Haryana, Himachal Pradesh and Chandigarh. It is not a surveyed historical Punjab boundary, a dated British province or the Sikh Empire.',
 full:'All available region outlines. Detail layers stay off until “Include enabled detail layers” is selected; their saved settings and colors are retained.',
};
export const scopeSources={tricity:{url:'https://sasnagar.punjabpolice.gov.in/about_sas_nagar.php',title:'SAS Nagar Police · Chandigarh Tricity',geometry:['Esri India IAB2024 · Chandigarh and S A S Nagar','LGD via Bharatlas · Panchkula · 2024']}};

// Unknown region IDs and malformed new fields are discarded. Older saved maps
// keep their existing atlas/country/NCR behavior and receive only safe defaults.
export function validateScopeSettings(value:unknown):ScopeSettings{
 const x=value&&typeof value==='object'?value as Partial<ScopeSettings>:{};
 const clean=(list:unknown,fallback:string[])=>Array.isArray(list)?[...new Set(list.filter((id):id is string=>typeof id==='string'&&regionIds.has(id)))]:[...fallback];
 return {indiaPunjabScenario:x.indiaPunjabScenario===true,mapScope:scopeModes.includes(x.mapScope as ScopeMode)?x.mapScope!:'atlas',scopeRegion:typeof x.scopeRegion==='string'&&regionIds.has(x.scopeRegion)?x.scopeRegion:scopeDefaults.scopeRegion,scopeRegions:clean(x.scopeRegions,scopeDefaults.scopeRegions),historicRegions:clean(x.historicRegions,defaultHistoricRegions),fullDetail:typeof x.fullDetail==='boolean'?x.fullDetail:false,scopeAreas:Array.isArray(x.scopeAreas)?[...new Set(x.scopeAreas.filter(id=>typeof id==='string'&&byId.has(id)&&!syntheticRegions.has(id)))]:[]};
}
export function selectedScopeRegions(d:ScopeDocument){
 switch(d.mapScope||'atlas'){
  case 'world':return ['world'];
  case 'selection':return [...new Set((d.scopeAreas||[]).map(id=>byId.get(id)?.region).filter((id):id is string=>!!id))];
  case 'full':return scopeRegions.map(r=>r.id);
  case 'single':return [d.scopeRegion||scopeDefaults.scopeRegion];
  case 'combination':return d.scopeRegions||scopeDefaults.scopeRegions;
  case 'historic-punjab':return d.historicRegions||defaultHistoricRegions;
  case 'tricity':return ['chandigarh','in-punjab','in-haryana'];
  default:return [];
 }
}
export function scopeRegionAllowed(id:string,d:ScopeDocument){
 const mode=d.mapScope||'atlas';
 if(id==='pk-lahore-study'&&mode==='full'&&d.fullDetail&&d.regions[id]?.show)return true;
 if(mode==='world')return id==='world';
 if(mode==='atlas')return id!=='world';
 const ids=selectedScopeRegions(d);
 if(id==='kashmir-united')return ids.includes('in-jammu-kashmir')&&ids.includes('in-ladakh');
 if(id==='tibet-modern-three')return tibetRegions.every(region=>ids.includes(region));
 if(id==='delhi-ncr')return false;
 return ids.includes(id);
}
function inTricity(a:Area){
 if(a.region==='chandigarh')return true;
 const seen=new Set<string>();let current:Area|undefined=a;
 while(current&&!seen.has(current.id)){if(tricityParents.has(current.id))return true;seen.add(current.id);current=byId.get(current.parent);}
 return false;
}
// Geographic filtering is separate from layer visibility: overlay markers can
// use the same selected polygon union without depending on a detail checkbox.
export function scopeAreaAllowed(a:Area,d:ScopeDocument){if(d.mapScope==='world')return worldAreaAllowed(a,{scopeAreas:d.scopeAreas||[],indiaPunjabScenario:d.indiaPunjabScenario});return d.mapScope==='selection'?(d.scopeAreas||[]).some(id=>areaBelongsTo(a,id)):(d.mapScope==='tricity'?inTricity(a):scopeRegionAllowed(a.region,d));}
export function scopeLevelAllowed(a:Area,d:ScopeDocument){return d.mapScope!=='full'||!!d.fullDetail||a.level==='region';}
// The two district polygons serve as Tricity context outlines even when a
// previously saved district-detail checkbox was off. Child details still use
// the user's normal layer flags.
export function scopePrimaryArea(a:Area,d:ScopeDocument){return d.mapScope==='selection'?(d.scopeAreas||[]).includes(a.id):d.mapScope==='tricity'&&tricityParents.has(a.id);}
export function scopePreset(d:ScopeDocument,mode:ScopeMode,settings:Partial<ScopeSettings>={}):Partial<MapDoc>&ScopeSettings{
 const validated=validateScopeSettings({...d,...settings,mapScope:mode}),nextRegions={...d.regions};
 if(mode==='world')validated.scopeAreas=(settings.scopeAreas||[]).filter(id=>byId.get(id)?.region==='world');
 const selected=selectedScopeRegions({...d,...validated});
 for(const id of selected)if(nextRegions[id])nextRegions[id]={...nextRegions[id],show:true};
 if(mode==='world')return {...validated,regions:{...nextRegions,world:{show:true,province:true,district:false,tehsil:false,division:false,uc:false}},countryView:'',delhiView:'none',kashmirView:'separate',basemap:'political',empireId:'none',caseStudyId:'none',demographicMode:'none',delhiMetro:false,cities:false,rivers:false,gurdwaras:false,communityShrines:false,mountains:false,plateaus:false,forests:false};
 return {...validated,regions:nextRegions,countryView:'',delhiView:'none',kashmirView:'separate'};
}

export function scopeGeometryAreas(d:ScopeDocument):Area[]{
 const mode=d.mapScope||'atlas';
 if(mode==='world')return worldAreas.filter(a=>a.level==='region'&&worldAreaAllowed(a,{scopeAreas:d.scopeAreas||[],indiaPunjabScenario:d.indiaPunjabScenario}));
 if(mode==='selection')return selectionAreas(d);
 if(mode==='tricity')return tricityAreaIds.map(id=>byId.get(id)!).filter(Boolean);
 if(mode==='atlas'){
  if(d.delhiView==='ncr')return [byId.get('delhi-ncr')!].filter(Boolean);
  if(d.countryView==='tibet-modern-three')return [byId.get('tibet-modern-three')!].filter(Boolean);
  if(d.countryView)return [byId.get(d.countryView)!].filter(Boolean);
 }
 const ids=mode==='atlas'?scopeRegions.filter(r=>d.regions[r.id]?.show).map(r=>r.id):selectedScopeRegions(d);
 // Full Pakistan takes precedence only when it belongs to this geographic
 // scope. A previously enabled country must not hide standalone Punjab.
 const fullPakistan=ids.includes('pk-country')&&d.regions['pk-country']?.show;
 const areas=ids.filter(id=>!(fullPakistan&&pakistanLegacyRegions.includes(id))).map(id=>byId.get(id)!).filter(Boolean);
 if(d.kashmirView==='combined'&&ids.includes('in-jammu-kashmir')&&ids.includes('in-ladakh'))return [...areas.filter(a=>!['in-jammu-kashmir','in-ladakh'].includes(a.region)),byId.get('kashmir-united')!].filter(Boolean);
 return areas;
}
export const scopeGeometryKeys=(d:ScopeDocument)=>[...new Set(scopeGeometryAreas(d).map(a=>a.region+'-'+a.level))];
export function scopeFocusBounds(d:ScopeDocument){
 if(d.mapScope==='world'){const selected=worldAreas.find(a=>a.id===d.scopeAreas?.[0]);return selected?worldFocusBounds(selected,d):[...worldBounds];}
 const areas=scopeGeometryAreas(d);
 if(!areas.length)return undefined;
 return areas.reduce((b,a)=>[Math.min(b[0],a.bbox[0]),Math.min(b[1],a.bbox[1]),Math.max(b[2],a.bbox[2]),Math.max(b[3],a.bbox[3])],[180,90,-180,-90]);
}
export function scopeQualification(d:ScopeDocument){return d.mapScope==='world'?worldNotice:d.mapScope==='tricity'?scopeQualifications.tricity:d.mapScope==='historic-punjab'?scopeQualifications.historicPunjab:d.mapScope==='full'?scopeQualifications.full:'';}
export function scopeLabel(d:ScopeDocument){
 switch(d.mapScope||'atlas'){
  case 'selection':{const selected=selectionAreas(d);return selected.length===1?selected[0].name:selected.length+' selected territories';}
  case 'world':return d.indiaPunjabScenario?'Hypothetical India · United Punjab · Aksai Chin in Ladakh':'World · countries & first-level divisions';
  case 'full':return 'Full available map';
  case 'single':return scopeRegions.find(r=>r.id===(d.scopeRegion||scopeDefaults.scopeRegion))?.name||'Individual region';
  case 'combination':return 'Custom region combination';
  case 'tricity':return 'Chandigarh Tricity · district context';
  case 'historic-punjab':return 'Custom Historic Punjab · modern context';
  default:return 'Regional atlas';
 }
}
