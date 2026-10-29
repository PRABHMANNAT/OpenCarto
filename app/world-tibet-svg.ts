import type {FeatureCollection} from 'geojson';
import type {MapDoc} from './map-model';
import {tibetRepublic} from './world-tibet-model';
import {worldProjection,worldRenderedGeometry} from './world-equal-earth';
export type TibetSvgItem={id:string;tag:'path'|'circle'|'text';props:Record<string,string|number>;text?:string};
const projection=worldProjection();
// Descriptors are shared by the live SVG and exports. All coordinates remain
// geographic until passed through the same Equal Earth projection and camera.
export function tibetSvgItems(geo:FeatureCollection|null,doc:MapDoc,k:number,scale:number,visible:Set<string>):TibetSvgItem[]{
 if(!geo||!doc.indiaPunjabScenario||k<3||!([tibetRepublic.id,...tibetRepublic.unitIds].some(id=>visible.has(id))))return [];
 const items:TibetSvgItem[]=[],mag=k*scale,occupied:number[][]=[];
 const text=(id:string,name:string,center:number[],color:string,font=11)=>{
  const p=projection(center as [number,number]);if(!p)return;
  const w=name.length*font*.5/mag,h=font/mag,box=[p[0]-w/2,p[1]-h/2,p[0]+w/2,p[1]+h/2];
  if(occupied.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]))return;
  occupied.push(box);items.push({id,tag:'text',props:{'data-tibet-label':id,x:p[0],y:p[1],fontSize:font/mag,fontFamily:'Arial,sans-serif',textAnchor:'middle',fill:color,stroke:'#ffffff',strokeWidth:2/mag,paintOrder:'stroke',pointerEvents:'none'},text:name});
 };
 if(doc.tibetView==='cultural'&&doc.regions.world.province){
  for(const f of geo.features.filter(f=>f.properties?.level==='cultural')){
   if(doc.borders&&doc.provinceBorders)items.push({id:String(f.id),tag:'path',props:{'data-tibet-cultural-border':String(f.id),d:worldRenderedGeometry(f.geometry).path,fill:'none',stroke:'#59606d',strokeWidth:.8,vectorEffect:'non-scaling-stroke',pointerEvents:'none'}});
   if(doc.names)text(String(f.id),String(f.properties!.name),f.properties!.center,'#2a3c4b',14);
  }
 }
 if(doc.tibetCities){
  const places=geo.features.filter(f=>f.properties?.level==='place').sort((a,b)=>Number(b.properties?.kind==='capital')-Number(a.properties?.kind==='capital'));
  for(const f of places){if(f.geometry.type!=='Point')continue;const p=projection(f.geometry.coordinates as [number,number]);if(!p)continue;const capital=f.properties?.kind==='capital';
   items.push({id:String(f.id),tag:'circle',props:{'data-tibet-city':String(f.id),cx:p[0],cy:p[1],r:(capital?4:2.5)/mag,fill:capital?'#a52b37':'#284c64',stroke:'#ffffff',strokeWidth:1/mag,pointerEvents:'none'}});
   if(doc.names&&k>=4){const ll=projection.invert!([p[0],p[1]+(capital?15:11)/mag]);if(ll)text(String(f.id),String(f.properties!.name)+(capital?' ★':''),ll,'#213d50',capital?12:10);}
  }
 }
 if(doc.tibetMountains)for(const f of geo.features.filter(f=>f.properties?.level==='peak')){
  if(f.geometry.type!=='Point')continue;const p=projection(f.geometry.coordinates as [number,number]);if(!p)continue;const r=4/mag;
  items.push({id:String(f.id),tag:'path',props:{'data-tibet-peak':String(f.id),d:`M${p[0]} ${p[1]-r}L${p[0]+r} ${p[1]+r}L${p[0]-r} ${p[1]+r}Z`,fill:'#785037',stroke:'#ffffff',strokeWidth:.7/mag,pointerEvents:'none'}});
  if(doc.names&&k>=4){const ll=projection.invert!([p[0],p[1]+14/mag]);if(ll)text(String(f.id),String(f.properties!.name),ll,'#634631',10);}
 }
 if(doc.tibetMountains)for(const f of geo.features.filter(f=>f.properties?.level==='mountain')){
  items.push({id:String(f.id),tag:'path',props:{'data-tibet-mountain':String(f.id),d:worldRenderedGeometry(f.geometry).path,fill:'#99704c',fillOpacity:.08,stroke:'#8b6e56',strokeOpacity:.3,strokeWidth:.5,vectorEffect:'non-scaling-stroke',pointerEvents:'none'}});
  if(doc.names&&k>=4)text(String(f.id),String(f.properties!.name),f.properties!.center,'#705844',10);
 }
 if(doc.tibetReferences)for(const f of geo.features.filter(f=>f.properties?.level==='reference'))items.push({id:String(f.id),tag:'path',props:{'data-tibet-reference':String(f.id),d:worldRenderedGeometry(f.geometry).path,fill:'none',stroke:'#b66c28',strokeDasharray:'4 3',strokeWidth:1,vectorEffect:'non-scaling-stroke',pointerEvents:'none'}});
 return items;
}
export function appendTibetSvg(root:Element,items:TibetSvgItem[]){const group=root.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('data-tibet-overlays','');for(const item of items){const node=root.ownerDocument.createElementNS('http://www.w3.org/2000/svg',item.tag);for(const [key,value]of Object.entries(item.props))node.setAttribute(key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),String(value));if(item.text)node.textContent=item.text;group.appendChild(node);}root.appendChild(group);}
