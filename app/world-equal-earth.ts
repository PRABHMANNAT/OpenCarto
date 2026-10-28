import {geoArea,geoEqualEarth,geoPath} from 'd3-geo';
import type {Feature,Geometry,Polygon,MultiPolygon} from 'geojson';
import type {MapDoc} from './map-model';

export const WORLD_WIDTH=1200, WORLD_HEIGHT=660;
export const worldSphere={type:'Sphere'} as const;
export const worldProjection=()=>geoEqualEarth().precision(0.08).fitExtent([[28,38],[WORLD_WIDTH-28,WORLD_HEIGHT-38]],worldSphere);
export const worldScope=(doc:Pick<MapDoc,'mapScope'|'scopeAreas'>)=>doc.mapScope==='world'||doc.mapScope==='selection'&&doc.scopeAreas.length>0&&doc.scopeAreas.every(id=>id.startsWith('world-'));
export const equalEarthView=(doc:Pick<MapDoc,'mapScope'|'scopeAreas'>&Partial<Pick<MapDoc,'basemap'>>)=>worldScope(doc)&&(!doc.basemap||doc.basemap==='political');
const normalized=new WeakMap<Geometry,Geometry>();
const rendered=new WeakMap<Geometry,{path:string;size:number}>();
const renderPath=geoPath(worldProjection()).digits(3);
export function worldRenderedGeometry(geometry:Geometry){
  let cached=rendered.get(geometry);
  if(!cached){const spherical=sphericalGeometry(geometry);cached={path:renderPath(spherical)||'',size:renderPath.area(spherical)};rendered.set(geometry,cached);}
  return cached;
}

// D3's spherical winding convention differs from RFC 7946. Only ring order is
// normalized; the original longitude/latitude positions are never projected,
// moved or scaled here. Each source polygon is smaller than a hemisphere.
export function sphericalGeometry(geometry:Geometry):Geometry {
  const cached=normalized.get(geometry);if(cached)return cached;
  const polygon=(coordinates:Polygon['coordinates']):Polygon=>{
    const copy=coordinates.map(ring=>ring.map(p=>[Math.max(-180,Math.min(180,p[0])),Math.max(-90,Math.min(90,p[1]))]));
    const result:Polygon={type:'Polygon',coordinates:copy};
    if(geoArea(result)>2*Math.PI)result.coordinates=copy.map(ring=>ring.reverse());
    return result;
  };
  const result=geometry.type==='Polygon'?polygon(geometry.coordinates):geometry.type==='MultiPolygon'?{type:'MultiPolygon',coordinates:geometry.coordinates.map(c=>polygon(c).coordinates)} as MultiPolygon:geometry;
  normalized.set(geometry,result);return result;
}
export function sphericalFeature(feature:Feature):Feature{return {...feature,geometry:sphericalGeometry(feature.geometry)};}
export const equalEarthPath=()=>geoPath(worldProjection()).digits(3);

// Uniform camera transform, applied after geographic projection to every layer.
export function equalEarthFit(bounds:number[],padding=28){
  if(bounds[2]-bounds[0]>=340)return {k:1,x:0,y:0};
  const projection=worldProjection(),points:number[][]=[];
  for(let i=0;i<=32;i++){
    const lon=bounds[0]+(bounds[2]-bounds[0])*i/32,lat=bounds[1]+(bounds[3]-bounds[1])*i/32;
    for(const pair of [[lon,bounds[1]],[lon,bounds[3]],[bounds[0],lat],[bounds[2],lat]]){const p=projection(pair as [number,number]);if(p)points.push(p);}
  }
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const k=Math.min(256,(WORLD_WIDTH-2*padding)/Math.max(1,right-left),(WORLD_HEIGHT-2*padding)/Math.max(1,bottom-top));
  return {k,x:WORLD_WIDTH/2-k*(left+right)/2,y:WORLD_HEIGHT/2-k*(top+bottom)/2};
}
