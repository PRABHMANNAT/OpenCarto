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
  normalized.set(geometry,result);normalized.set(result,result);return result;
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

type OutlineRing={points:[number,number][];area:number};
const outlineRings=new WeakMap<Geometry,OutlineRing[]>();
const outlineCache=new WeakMap<Geometry,Map<number,string>>();
function ringsForOutline(geometry:Geometry){
 const cached=outlineRings.get(geometry);if(cached)return cached;
 const rings:OutlineRing[]=[];let points:[number,number][]=[];
 const finish=()=>{if(points.length>2){let twice=0;for(let i=0,j=points.length-1;i<points.length;j=i++)twice+=points[j][0]*points[i][1]-points[i][0]*points[j][1];rings.push({points,area:Math.abs(twice)/2});}points=[];};
 const context={beginPath(){finish();},moveTo(x:number,y:number){finish();points=[[x,y]];},lineTo(x:number,y:number){points.push([x,y]);},closePath(){if(points.length&&points[0]!==points.at(-1))points.push(points[0]);finish();},arc(){}};
 geoPath(worldProjection(),context)(sphericalGeometry(geometry));finish();outlineRings.set(geometry,rings);return rings;
}
function simplifiedOutline(points:[number,number][],tolerance:number){
 if(points.length<5)return points;
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]],limit=tolerance*tolerance;
 while(stack.length){const [start,end]=stack.pop()!,a=points[start],b=points[end],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;let farthest=-1,max=limit;
  for(let i=start+1;i<end;i++){const p=points[i],t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0,x=p[0]-a[0]-t*dx,y=p[1]-a[1]-t*dy,distance=x*x+y*y;if(distance>max){max=distance;farthest=i;}}
  if(farthest>=0){keep[farthest]=1;stack.push([start,farthest],[farthest,end]);}
 }
 const result=points.filter((_,i)=>keep[i]);return result.length>=4?result:points;
}
// Generalize outlines only, in projected display space. Full geographic fills,
// areas and hit targets are retained. Small island outlines return on zoom-in.
export function worldBorderPath(geometry:Geometry,magnification=1){
 const scale=2**(Math.ceil(Math.log2(Math.max(.01,magnification))*2)/2);
 let cache=outlineCache.get(geometry);if(!cache){cache=new Map();outlineCache.set(geometry,cache);}const hit=cache.get(scale);if(hit!==undefined)return hit;
 const rings=ringsForOutline(geometry);let largest=-1;for(let i=0;i<rings.length;i++)if(largest<0||rings[i].area>rings[largest].area)largest=i;
 const path=rings.filter((ring,i)=>i===largest||ring.area*scale*scale>=16).map(ring=>{const p=simplifiedOutline(ring.points,.5/scale);return 'M'+p.slice(0,-1).map(point=>point.map(v=>Number(v.toFixed(4))).join(',')).join('L')+'Z';}).join('');
 cache.set(scale,path);while(cache.size>2)cache.delete(cache.keys().next().value!);return path;
}
