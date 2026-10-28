import {initial,visible,type MapDoc,type Area} from './map-model';
import {scopeNavigation,scopePreset} from './scope-model';
import {caseStudyPreset,caseStudyCompleteView,isCaseStudyMap} from './case-study-model';
import {empirePreset} from './empire-model';
import {showArea} from './area-search-model';

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
// Revert preset values; retain colors, names and settings edited after loading it.
function restore(before:unknown,applied:unknown,current:unknown):unknown{
 if(same(current,applied))return before;
 if(same(before,applied))return current;
 if(object(before)&&object(applied)&&object(current))return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(applied),...Object.keys(current)])].flatMap(key=>{const value=restore(before[key],applied[key],current[key]);return value===undefined?[]:[[key,value]];}));
 return current;
}
const snapshot=(doc:MapDoc)=>structuredClone({...doc,historyReturn:null});
const legacyTemplate={...initial,...caseStudyPreset(initial)};
const legacyCase=isCaseStudyMap;
export const historyActive=(doc:MapDoc)=>doc.empireId!=='none'||legacyCase(doc)||!!doc.historyReturn;
function legacyNormalMap(doc:MapDoc):MapDoc{
 const cleaned=legacyCase(doc)?restore(initial,legacyTemplate,doc) as MapDoc:doc;
 return {...cleaned,...scopePreset(cleaned,'atlas'),empireId:'none',caseStudyId:'none',historyReturn:null,viewReturn:null};
}
export function recordHistoryChange(doc:MapDoc,patch:Partial<MapDoc>):Partial<MapDoc>{
 const activeCase=patch.caseStudyId==='sikh-heritage-core',activeEmpire=!!patch.empireId&&patch.empireId!=='none';
 if(!activeCase&&!activeEmpire)return patch;
 const before=doc.historyReturn?.before||snapshot(historyActive(doc)?legacyNormalMap(doc):doc);
 const baseline=doc.historyReturn?.applied||before;
 const template=activeCase?caseStudyPreset(baseline):empirePreset(baseline,patch.empireId!,patch.empireDetail);
 const viewReturn=activeCase?patch.viewReturn||null:null;
 return {...patch,viewReturn,historyReturn:{before,applied:snapshot({...baseline,...template,viewReturn:null})}};
}
export function normalMapPatch(doc:MapDoc):Partial<MapDoc>{
 if(!doc.historyReturn)return historyActive(doc)?legacyNormalMap(doc):{empireId:'none',caseStudyId:'none'};
 const {before,applied}=doc.historyReturn;
 const current=doc.viewReturn?{...doc,...doc.viewReturn}:doc;
 const merged=restore(before,applied,current) as MapDoc;
 // Hidden-area membership needs a per-area merge, rather than an array reset.
 const allHidden=new Set([...before.hidden,...applied.hidden,...current.hidden]);
 const hidden=[...allHidden].filter(id=>current.hidden.includes(id)===applied.hidden.includes(id)?before.hidden.includes(id):current.hidden.includes(id));
 const geography=scopeNavigation(before);
 return structuredClone({...merged,...geography,regions:merged.regions,areaDetails:merged.areaDetails,hidden,empireId:'none',caseStudyId:'none',historyReturn:null,viewReturn:before.viewReturn});
}
export function completeMapPatch(doc:MapDoc):Partial<MapDoc>{
 if(doc.mapScope==='world')return {...scopePreset(doc,'world',{scopeAreas:[]}),regions:doc.regions,hidden:[],areaDetails:{},viewReturn:doc.viewReturn||scopeNavigation(doc)};
 return {...(isCaseStudyMap(doc)?caseStudyCompleteView(doc):scopePreset(doc,'full',{fullDetail:doc.empireId!=='none'})),hidden:[],areaDetails:{},viewReturn:doc.viewReturn||scopeNavigation(doc)};
}
export function selectedMapPatch(doc:MapDoc):Partial<MapDoc>{
 if(doc.viewReturn)return {...doc.viewReturn,viewReturn:null};
 if(doc.mapScope!=='atlas'&&doc.mapScope!=='full')return {};
 if(doc.historyReturn)return {...scopeNavigation(doc.historyReturn.before),viewReturn:null};
 return scopePreset(doc,doc.scopeAreas.length?'selection':'combination');
}
export function focusAreaPatch(doc:MapDoc,area:Area):Partial<MapDoc>{
 const patch=doc.viewReturn?{...doc.viewReturn,viewReturn:null}:{};
 const next={...doc,...patch};
 return visible(area,next)?patch:{...patch,...showArea(next,area)};
}
