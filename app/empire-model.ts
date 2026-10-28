import data from './empire-data.json';
import {worldDefaultPaint} from './world-map-model';
import type {Polygon,MultiPolygon} from 'geojson';
import type {Area,MapDoc,Paint} from './map-model';
import {areas,visible,effectivePaint,areasByLayer} from './map-model';
import {scopePreset} from './scope-model';
import {containsPoint} from './spatial-overlays';

export type Empire={id:string;name:string;yearLabel:string;color:string;geometry:Polygon|MultiPolygon;sourceTitle:string;sourceUrls:string[];author?:string;license:string;method:string;note:string};
export const empires=data.empires as Empire[];
export const empireById=new Map(empires.map(e=>[e.id,e]));
export type EmpireSettings={empireId:string;empireDetail:'district'|'tehsil';empireColor:string};
export const empireDefaults:EmpireSettings={empireId:'none',empireDetail:'district',empireColor:'#b98737'};
const membership=new Map<string,Set<string>>();
export function empireAreas(id:string){
 if(!membership.has(id)){const e=empireById.get(id);membership.set(id,new Set(e?areas.filter(a=>!['delhi-ncr','kashmir-united','tibet-modern-three','pk-lahore-study'].includes(a.region)&&containsPoint(e.geometry,a.center)).map(a=>a.id):[]));}
 return membership.get(id)!;
}
// Region outlines provide context. Coloring is assigned independently to each
// modern administrative unit's source label point, never inherited from a state.
export function empirePaint(a:Area,doc:MapDoc):Paint|undefined{return doc.empireId!=='none'&&a.level!=='region'&&a.level!=='division'&&empireAreas(doc.empireId).has(a.id)?{color:doc.empireColor,pattern:'solid'}:undefined;}
export function displayedPaint(a:Area,doc:MapDoc){return doc.demographicMode!=='none'?undefined:doc.empireId!=='none'?empirePaint(a,doc):effectivePaint(a,doc)||worldDefaultPaint(a,doc);}
export const displayedBaseColor=(doc:MapDoc)=>doc.demographicMode!=='none'||doc.empireId!=='none'?'#ffffff':doc.uncolored;
export function empirePreset(doc:MapDoc,id:string,detail=doc.empireDetail):Partial<MapDoc>{
 const empire=empireById.get(id);if(!empire)return {empireId:'none'};
 const matched=empireAreas(id),regions={...doc.regions};
 const matchedRegions=new Set(areas.filter(a=>(a.level==='district'||a.level==='tehsil')&&matched.has(a.id)).map(a=>a.region));
 for(const region of Object.keys(regions))regions[region]={...regions[region],show:region!=='pk-lahore-study',province:false,district:matchedRegions.has(region)&&areasByLayer.has(region+'-district'),tehsil:detail==='tehsil'&&matchedRegions.has(region)&&areasByLayer.has(region+'-tehsil'),division:false,uc:false};
 return {...scopePreset(doc,'full',{fullDetail:true}),regions,areaDetails:{},empireId:id,empireDetail:detail,empireColor:doc.empireId===id?doc.empireColor:empire.color,demographicMode:'none',caseStudyId:'none'};
}
export function empireCount(doc:MapDoc,level:Area['level']){return areas.filter(a=>a.level===level&&empireAreas(doc.empireId).has(a.id)&&visible(a,doc)).length;}
export function empireBounds(id:string){const e=empireById.get(id);if(!e)return undefined;const points=e.geometry.type==='Polygon'?e.geometry.coordinates.flat():e.geometry.coordinates.flat(2);return points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[180,90,-180,-90]);}
export function empireNotice(doc:MapDoc){const e=empireById.get(doc.empireId);return e?e.name+' · '+e.yearLabel+' · approximate reference extent on modern units (source label points). Historical control varied; border units may straddle territory. References and method: app/empire-data.json.':'';}
export function validateEmpireSettings(value:unknown):EmpireSettings{
 const x=value&&typeof value==='object'?value as Partial<EmpireSettings>:{},next={...empireDefaults};
 if(x.empireId==='none'||empireById.has(x.empireId||''))next.empireId=x.empireId!;
 if(x.empireDetail==='district'||x.empireDetail==='tehsil')next.empireDetail=x.empireDetail;
 next.empireColor=empireById.get(next.empireId)?.color||next.empireColor;
 if(typeof x.empireColor==='string'&&/^#[0-9a-f]{6}$/i.test(x.empireColor))next.empireColor=x.empireColor;
 return next;
}
