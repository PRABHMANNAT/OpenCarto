import polygonClipping from 'polygon-clipping';
import type {FeatureCollection,Polygon,MultiPolygon} from 'geojson';
import {areaById,type MapDoc} from './map-model';
import {areaBelongsTo,scopeRegionAllowed} from './scope-model';
import type {Mask} from './geometry-clip';

function scopedHidden(doc:MapDoc){
 const worldOnly=doc.mapScope==='world'||doc.mapScope==='selection'&&doc.scopeAreas.length>0&&doc.scopeAreas.every(id=>areaById.get(id)?.region==='world');
 return doc.hidden.filter(id=>{const area=areaById.get(id);return area&&(worldOnly?area.region==='world':area.region!=='world'||scopeRegionAllowed('world',doc));});
}
export const hiddenGeometryKeys=(doc:MapDoc)=>[...new Set(scopedHidden(doc).map(id=>areaById.get(id)).filter(Boolean).map(a=>a!.region+'-'+a!.level))];
export function hiddenMasks(doc:MapDoc,data:Record<string,FeatureCollection>):Mask[]{
 return scopedHidden(doc).flatMap(id=>{const a=areaById.get(id);if(!a)return [];const f=data[a.region+'-'+a.level]?.features.find(f=>String(f.id)===id);return f&&(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon')?[{id,bbox:f.bbox||a.bbox,geometry:f.geometry}]:[];});
}
const overlaps=(a:number[],b:number[])=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const shapeCache=new WeakMap<Polygon|MultiPolygon,{cuts:Mask[];geometry:Polygon|MultiPolygon|undefined}>();
export function subtractHidden(geometry:Polygon|MultiPolygon,bbox:number[],hidden:Mask[]):Polygon|MultiPolygon|undefined{
 const cuts=hidden.filter(mask=>overlaps(bbox,mask.bbox));if(!cuts.length)return geometry;
 const previous=shapeCache.get(geometry);
 if(previous&&previous.cuts.length===cuts.length&&previous.cuts.every((m,i)=>m.geometry===cuts[i].geometry))return previous.geometry;
 const polygon=(g:Polygon|MultiPolygon)=>(g.type==='Polygon'?[g.coordinates]:g.coordinates) as polygonClipping.MultiPolygon;
 const coordinates=polygonClipping.difference(polygon(geometry),...cuts.map(mask=>polygon(mask.geometry)));
 const result:MultiPolygon|undefined=coordinates.length?{type:'MultiPolygon',coordinates}:undefined;
 shapeCache.set(geometry,{cuts,geometry:result});return result;
}
// Cache by original geometry objects. Paint changes do not repeat polygon work.
const cache=new WeakMap<FeatureCollection,{key:string;cuts:Mask[];result:FeatureCollection}>();
export function visibleBoundaries(geo:FeatureCollection,doc:MapDoc,hidden:Mask[]):FeatureCollection{
 if(!hidden.length)return geo;
 const key=hidden.map(m=>m.id).sort().join('|'),previous=cache.get(geo);
 if(previous?.key===key&&previous.cuts.every((m,i)=>m.geometry===hidden[i]?.geometry))return previous.result;
 const result:FeatureCollection={...geo,features:geo.features.flatMap(f=>{
  const a=areaById.get(String(f.id));if(!a)return [f];
  if(hidden.some(mask=>areaBelongsTo(a,mask.id)))return [];
  if(f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon')return [f];
  const geometry=subtractHidden(f.geometry,f.bbox||a.bbox,hidden);return geometry?[{...f,geometry}]:[];
 })};cache.set(geo,{key,cuts:hidden,result});return result;
}
