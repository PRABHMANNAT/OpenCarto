import {PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage} from 'pdf-lib';
import type {Feature, FeatureCollection, Polygon, MultiPolygon, Position} from 'geojson';

export type PunjabPdfScope = 'all' | 'district' | 'division' | 'tehsil';
export type PunjabPdfInput = {district: FeatureCollection; division: FeatureCollection; tehsil: FeatureCollection};
type Box = {x:number; y:number; w:number; h:number};
type Label = Box & {id:string; name:string; lines:string[]; anchor:[number,number]};
export type PunjabPdfPageAudit = {title:string; level:string; labels:Label[]; width:number; height:number};
const ink=rgb(0.10,0.22,0.29), muted=rgb(0.32,0.42,0.46), paper=rgb(0.98,0.98,0.96);
const a2:[number,number]=[1190.55,1683.78], a1:[number,number]=[1683.78,2383.94];
const polygons=(feature:Feature):Position[][][]=>feature.geometry.type==='Polygon'?[(feature.geometry as Polygon).coordinates]:feature.geometry.type==='MultiPolygon'?(feature.geometry as MultiPolygon).coordinates:[];
const plain=(value:unknown)=>(typeof value==='string'||typeof value==='number'?String(value):'').replace(/[\u2010-\u2015]/g,'-').replace(/\u2019/g,"'").replace(/\u00a0/g,' ');
function bounds(features:Feature[]) {
  const box=[Infinity,Infinity,-Infinity,-Infinity];
  for(const f of features)for(const p of polygons(f))for(const r of p)for(const [x,y] of r){box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);}
  return box;
}
const mercator=([x,y]:number[])=>[x,180/Math.PI*Math.log(Math.tan(Math.PI/4+y*Math.PI/360))];
function projector(features:Feature[], frame:Box) {
  const b=bounds(features),[w,s]=mercator(b.slice(0,2)),[e,n]=mercator(b.slice(2));
  const scale=Math.min(frame.w/(e-w),frame.h/(n-s));
  return {scale,latitude:(b[1]+b[3])/2,project:([x,y]:Position):[number,number]=>{
    const [mx,my]=mercator([x,y]);return [frame.x+(frame.w-(e-w)*scale)/2+(mx-w)*scale,frame.y+(frame.h-(n-s)*scale)/2+(my-s)*scale];
  }};
}
function contains(ring:Position[], point:Position) {
  let inside=false;const [x,y]=point;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }return inside;
}
function anchor(feature:Feature):Position {
  const shapes=polygons(feature);
  const inside=(point:Position)=>shapes.some(p=>contains(p[0],point)&&!p.slice(1).some(h=>contains(h,point)));
  const center=feature.properties?.center;
  if(Array.isArray(center)&&inside(center))return center;
  const b=bounds([feature]),mid=[(b[0]+b[2])/2,(b[1]+b[3])/2];
  if(inside(mid))return mid;
  for(let i=1;i<40;i++)for(let j=1;j<40;j++){
    const p=[b[0]+(b[2]-b[0])*i/40,b[1]+(b[3]-b[1])*j/40];if(inside(p))return p;
  }
  return shapes[0][0][0];
}
function color(feature:Feature) {
  const hex=String(feature.properties?.color||'#B9D2C8');
  if(!/^#[\da-f]{6}$/i.test(hex))return rgb(.73,.82,.78);
  return rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number]);
}
function drawFeature(page:PDFPage, feature:Feature, project:(p:Position)=>[number,number], fill:boolean, lineWidth:number) {
  // Native PDF paths retain every polygon, interior ring and island. PDF's
  // nonzero winding rule handles holes after orientation is normalized here.
  for(const polygon of polygons(feature)) {
    const rings=polygon.map((ring,index)=>{
      let points=ring.map(project);
      const signed=points.reduce((s,p,i)=>s+p[0]*points[(i+1)%points.length][1]-points[(i+1)%points.length][0]*p[1],0);
      if((signed>0)!==(index===0))points=[...points].reverse();
      return points.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+' '+(-y).toFixed(2)).join(' ')+' Z';
    }).join(' ');
    page.drawSvgPath(rings,{x:0,y:0,...(fill?{color:color(feature)}:{}),borderColor:ink,borderWidth:lineWidth});
  }
}
function wrap(text:string,font:PDFFont,size:number,maxWidth:number) {
  const lines:string[]=[];let line='';
  for(const word of plain(text).split(/\s+/)){
    const next=line?line+' '+word:word;
    if(line&&font.widthOfTextAtSize(next,size)>maxWidth){lines.push(line);line=word;}else line=next;
  }
  if(line)lines.push(line);return lines;
}
const overlaps=(a:Box,b:Box)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function placeLabels(features:Feature[],frame:Box,project:(p:Position)=>[number,number],font:PDFFont,size:number,division:boolean):Label[] {
  const placed:Label[]=[];
  const ordered=[...features].sort((a,b)=>Number(a.properties?.areaKm2||0)-Number(b.properties?.areaKm2||0)||String(a.properties?.id).localeCompare(String(b.properties?.id)));
  for(const feature of ordered){
    const name=plain(feature.properties?.name),lines=wrap(name,font,size,division?180:125);
    if(division&&feature.properties?.capital)lines.push(...wrap('HQ: '+plain(feature.properties.capital),font,size,180));
    const w=Math.max(...lines.map(line=>font.widthOfTextAtSize(line,size)))+10,h=lines.length*(size+3)+7;
    const point=project(anchor(feature));const candidates:Box[]=[];
    const candidate=(x:number,y:number)=>({x:x-w/2,y:y-h/2,w,h});
    candidates.push(candidate(...point));
    for(let radius=12;radius<210;radius+=12)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8)candidates.push(candidate(point[0]+Math.cos(angle)*radius,point[1]+Math.sin(angle)*radius));
    // Full-frame fallback never hides a label or shrinks it below the declared
    // print size. Displaced names receive leader lines to their real polygon.
    for(let y=frame.y+h/2;y<frame.y+frame.h-h/2;y+=h+4)for(let x=frame.x+w/2;x<frame.x+frame.w-w/2;x+=Math.max(28,w/2))candidates.push(candidate(x,y));
    candidates.sort((a,b)=>(a.x+w/2-point[0])**2+(a.y+h/2-point[1])**2-((b.x+w/2-point[0])**2+(b.y+h/2-point[1])**2));
    const box=candidates.find(c=>c.x>=frame.x&&c.y>=frame.y&&c.x+c.w<=frame.x+frame.w&&c.y+c.h<=frame.y+frame.h&&!placed.some(p=>overlaps(c,{x:p.x-3,y:p.y-3,w:p.w+6,h:p.h+6})));
    if(!box)throw Error('A clear label position could not be found for '+name+'.');
    placed.push({...box,id:String(feature.properties?.id),name,lines,anchor:point});
  }return placed;
}
function drawLabels(page:PDFPage,labels:Label[],font:PDFFont,size:number) {
  for(const label of labels){
    const [ax,ay]=label.anchor;
    if(ax<label.x||ax>label.x+label.w||ay<label.y||ay>label.y+label.h){
      const end={x:Math.max(label.x,Math.min(ax,label.x+label.w)),y:Math.max(label.y,Math.min(ay,label.y+label.h))};
      page.drawLine({start:{x:ax,y:ay},end,thickness:.45,color:muted});
      page.drawCircle({x:ax,y:ay,size:1.5,color:ink});
    }
  }
  for(const label of labels){
    page.drawRectangle({x:label.x,y:label.y,width:label.w,height:label.h,color:rgb(1,1,1),opacity:.94,borderColor:rgb(.82,.86,.85),borderWidth:.25});
    label.lines.forEach((line,i)=>page.drawText(line,{x:label.x+label.w/2-font.widthOfTextAtSize(line,size)/2,y:label.y+label.h-5-size-i*(size+3),size,font,color:ink}));
  }
}
export async function createPunjabAtlasPdf(input:PunjabPdfInput,scope:PunjabPdfScope='all',onProgress?:(message:string)=>void) {
  if(input.district.features.length!==48||input.division.features.length!==12||input.tehsil.features.length!==193)throw Error('The detailed PDF requires the complete 48 districts, 12 divisions and 193 tehsils. Please reload the atlas.');
  const document=await PDFDocument.create();
  document.setTitle('United Punjab - Detailed Administrative Map Atlas');document.setAuthor('United Subcontinent - Alternative Political Geography');
  document.setSubject('Fictional geography. 48 districts, 12 divisions, 193 mapped tehsils. Amb is independent.');
  const regular=await document.embedFont(StandardFonts.Helvetica),bold=await document.embedFont(StandardFonts.HelveticaBold);
  const audits:PunjabPdfPageAudit[]=[];
  const divisions=[...input.division.features].sort((a,b)=>String(a.properties?.name).localeCompare(String(b.properties?.name)));
  const plans:{title:string;level:'district'|'division'|'tehsil';features:Feature[];outlines:Feature[];size:[number,number];subtitle:string}[]=[];
  if(scope==='all'||scope==='division')plans.push({title:'United Punjab - Divisions',level:'division',features:divisions,outlines:[],size:a2,subtitle:'12 divisions - headquarters included in each label'});
  if(scope==='all'||scope==='district')plans.push({title:'United Punjab - Districts',level:'district',features:input.district.features,outlines:divisions,size:a1,subtitle:'48 districts - heavier lines separate divisions'});
  if(scope==='all'||scope==='tehsil'){
    plans.push({title:'United Punjab - Tehsils',level:'tehsil',features:input.tehsil.features,outlines:input.district.features,size:a1,subtitle:'193 mapped tehsils - heavier lines separate districts - enlarged maps follow'});
    for(const division of divisions){
      const ds=input.district.features.filter(f=>division.properties?.memberDistrictIds?.includes(f.properties?.id)||f.properties?.division===division.properties?.name);
      const ids=new Set(ds.map(f=>f.properties?.id));
      const ts=input.tehsil.features.filter(f=>ids.has(f.properties?.parentDistrictId));
      if(!ts.length)throw Error('The division tehsil directory is incomplete: '+division.properties?.name);
      plans.push({title:plain(division.properties?.name)+' Division - Tehsils',level:'tehsil',features:ts,outlines:ds,size:a2,subtitle:ds.length+' districts - '+ts.length+' tehsils - headquarters: '+plain(division.properties?.capital)});
    }
  }
  for(const [index,plan] of plans.entries()){
    onProgress?.('Drawing PDF map '+(index+1)+' of '+plans.length+'...');
    const [width,height]=plan.size,page=document.addPage(plan.size),frame={x:48,y:112,w:width-96,h:height-260};
    page.drawRectangle({x:0,y:0,width,height,color:paper});
    page.drawText('UNITED SUBCONTINENT / ALTERNATIVE POLITICAL GEOGRAPHY',{x:48,y:height-42,size:10,font:bold,color:muted});
    page.drawText(plan.title,{x:48,y:height-86,size:28,font:bold,color:ink});
    page.drawText(plan.subtitle,{x:48,y:height-110,size:12,font:regular,color:muted});
    const projection=projector(plan.features,{x:frame.x+90,y:frame.y+20,w:frame.w-180,h:frame.h-40});
    for(const feature of plan.features)drawFeature(page,feature,projection.project,true,plan.level==='tehsil'?.4:.65);
    for(const feature of plan.outlines)drawFeature(page,feature,projection.project,false,1.4);
    const size=plan.level==='division'?15:plan.features.length>100?9.5:11;
    const labels=placeLabels(plan.features,frame,projection.project,bold,size,plan.level==='division');
    drawLabels(page,labels,bold,size);
    // North is up in the cylindrical Mercator projection. Scale is local to
    // the midpoint latitude and explicitly labelled approximate.
    page.drawLine({start:{x:width-60,y:height-145},end:{x:width-60,y:height-122},color:ink,thickness:1.2});
    page.drawText('N',{x:width-64,y:height-118,font:bold,size:10,color:ink});
    const unitsPerKm=projection.scale/(111.32*Math.cos(projection.latitude*Math.PI/180));
    const km=[5,10,20,50,100].filter(n=>n*unitsPerKm<180).at(-1)||5;
    const scaleLength=km*unitsPerKm;
    page.drawLine({start:{x:48,y:88},end:{x:48+scaleLength,y:88},color:ink,thickness:2});
    page.drawText('0',{x:48,y:72,font:regular,size:8,color:muted});
    page.drawText(km+' km',{x:48+scaleLength-8,y:72,font:regular,size:8,color:muted});
    page.drawText('(approx. at map centre)',{x:48+scaleLength+32,y:72,font:regular,size:8,color:muted});
    page.drawText('All '+plan.features.length+' names labelled. White callouts and leader lines keep small units legible.',{x:48,y:54,font:regular,size:9,color:muted});
    page.drawText('Fictional alternative-history boundaries; not present sovereignty. Amb Union Territory is outside Punjab.',{x:48,y:39,font:regular,size:9,color:muted});
    page.drawText('Sources: existing atlas registry - LGD/Bharatlas, Esri India, WFP/OCHA (CC BY-IGO), Natural Earth. WGS84 / Mercator.',{x:48,y:24,font:regular,size:8,color:muted});
    page.drawText((index+1)+' / '+plans.length,{x:width-78,y:24,font:bold,size:9,color:ink});
    audits.push({title:plan.title,level:plan.level,labels,width,height});
    // Yield to paint the progress indicator on slower/mobile browsers.
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {bytes:await document.save(),pages:audits};
}
