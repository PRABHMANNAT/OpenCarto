'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- A focusable geographic SVG application supports arrow-key pan and +/- zoom; the parallel Areas controls expose all selection/edit actions to keyboard users. */
import {useEffect,useMemo,useRef,useState,useId,createElement} from 'react';
import {select as d3Select} from 'd3-selection';
import {zoom as d3Zoom,zoomIdentity,type ZoomBehavior} from 'd3-zoom';
import {geoPath} from 'd3-geo';
import type {Feature,FeatureCollection} from 'geojson';
import {areaById,visible,type Area,type MapDoc} from './map-model';
import {areaDisplayName} from './area-name-model';
import {areaBorderVisible,selectableAreas} from './area-visibility-model';
import {hiddenMasks,visibleBoundaries} from './visibility-geometry';
import {displayedPaint,displayedBaseColor} from './empire-model';
import {scopeFocusBounds} from './scope-model';
import {distanceKm} from './map-tools';
import {worldCountryLine,worldProvinceLine,worldInternalVisible} from './world-style-model';
import {worldSource} from './world-map-model';
import {indiaPunjabScenario,indiaScenarioArea,indiaScenarioCollection,loadIndiaPunjabOverrides} from './india-punjab-scenario';
import {worldProjection,sphericalFeature,worldRenderedGeometry,worldBorderPath,equalEarthFit,WORLD_WIDTH,WORLD_HEIGHT} from './world-equal-earth';
import {rasterizeWorldSvg} from './world-map-export';
import type {MapAPI,MapViewProps} from './map-view';
import './world-equal-earth.css';
import {tibetRepublic,tibetCulturalColor} from './world-tibet-model';
import {tibetSvgItems,appendTibetSvg} from './world-tibet-svg';

type Projected={feature:Feature;area:Area;path:string;size:number;point:[number,number]};
const empty:FeatureCollection={type:'FeatureCollection',features:[]};
const projection=worldProjection(),path=geoPath(projection).digits(3);
const inside=(p:number[],ring:number[][])=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
function placeLabels(rows:Projected[],doc:MapDoc,view:{k:number;x:number;y:number},scale:number){
  if(!doc.names)return [];
  const occupied:number[][]=[],labels:{row:Projected;name:string;font:number}[]=[];
  const candidates=rows.filter(row=>row.area.level==='region'||view.k>=8||doc.indiaPunjabScenario&&[indiaPunjabScenario.punjabId,indiaPunjabScenario.ladakhId,indiaPunjabScenario.sindhId,indiaPunjabScenario.multanId,indiaPunjabScenario.bahawalpurId].includes(row.area.id)).sort((a,b)=>Number(b.area.level==='region')-Number(a.area.level==='region')||b.size-a.size);
  for(const row of candidates){
    const country=row.area.level==='region',screenArea=row.size*(view.k*scale)**2;
    if(country?screenArea<1600:screenArea<1100)continue;
    if(doc.indiaPunjabScenario&&doc.tibetView==='cultural'&&tibetRepublic.unitIds.includes(row.area.id))continue;
    const p=[row.point[0]*view.k+view.x,row.point[1]*view.k+view.y],name=areaDisplayName(row.area,doc),font=country?13:11,w=name.length*font*.53/scale,h=font/scale;
    if(p[0]<0||p[1]<0||p[0]>WORLD_WIDTH||p[1]>WORLD_HEIGHT)continue;
    const box=[p[0]-w/2,p[1]-h/2,p[0]+w/2,p[1]+h/2];if(occupied.some(b=>box[0]<b[2]+6/scale&&box[2]>b[0]-6/scale&&box[1]<b[3]+4/scale&&box[3]>b[1]-4/scale))continue;
    occupied.push(box);labels.push({row,name,font:font/(view.k*scale)});
  }
  return labels;
}

function contextLabelClear(labels:ReturnType<typeof placeLabels>,magnification:number){
 const point=projection(indiaPunjabScenario.aksaiLabel.center as [number,number]);if(!point)return false;
 return labels.every(({row,name,font})=>Math.abs(row.point[0]-point[0])*magnification>(name.length*font*magnification*.53+53)/2+6||Math.abs(row.point[1]-point[1])*magnification>18);
}

export default function WorldEqualEarthView(props:MapViewProps){
  'use no memo'; // D3 owns the camera and DOM event subscriptions.
  const host=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),latest=useRef(props);
  const controller=useRef<ZoomBehavior<SVGSVGElement,unknown>|null>(null),camera=useRef(zoomIdentity);
  const cache=useRef<Record<string,FeatureCollection>>({}),scene=useRef<Projected[]>([]),ready=useRef(false);
  const drag=useRef<number[]|null>(null),polygon=useRef<number[][]>([]),suppressClick=useRef(false);
  const [data,setData]=useState<Record<string,FeatureCollection>>({});
  const [rawLoading,setLoading]=useState(true),[error,setError]=useState(''),[view,setView]=useState(zoomIdentity);
  const [scenario,setScenario]=useState<FeatureCollection|null>(null),scenarioSource=useRef<FeatureCollection|null>(null);
  useEffect(()=>{scenarioSource.current=scenario;},[scenario]);
  const loading=rawLoading||props.doc.indiaPunjabScenario&&!scenario;
  const [size,setSize]=useState({width:1200,height:660}),[hover,setHover]=useState(''),[selected,setSelected]=useState('');
  const [selection,setSelection]=useState<number[][]>([]),[measurement,setMeasurement]=useState<number[][]>([]);
  const measurementRef=useRef<number[][]>([]),prefix=useId().replace(/:/g,'');
  useEffect(()=>{latest.current=props;},[props]);
  useEffect(()=>{
    const node=host.current;if(!node)return;
    const measure=()=>{const rect=node.getBoundingClientRect(),panel=document.getElementById('map-inspector');const overlap=window.innerWidth<=700&&panel?.closest('.mobile-inspector-open')?panel.getBoundingClientRect().top:rect.bottom;setSize({width:Math.max(1,rect.width),height:Math.max(120,Math.min(rect.height,overlap-rect.top))});};
    const observer=new ResizeObserver(measure);observer.observe(node);const panel=document.getElementById('map-inspector');if(panel)observer.observe(panel);
    const mutation=new MutationObserver(measure);const workspace=node.closest('.workspace');if(workspace)mutation.observe(workspace,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',measure);measure();return()=>{observer.disconnect();mutation.disconnect();window.removeEventListener('resize',measure);};
  },[]);
  useEffect(()=>{
    const abort=new AbortController();
    Promise.all(['world-region','world-province'].map(async key=>{
      const response=await fetch('/data/'+key+'.geojson',{signal:abort.signal});if(!response.ok)throw Error('World boundaries could not load ('+response.status+').');
      return [key,await response.json() as FeatureCollection] as const;
    })).then(entries=>{if(!abort.signal.aborted){cache.current=Object.fromEntries(entries);setData(cache.current);setLoading(false);}}).catch(cause=>{if(!abort.signal.aborted){setError(cause instanceof Error?cause.message:'World map unavailable.');setLoading(false);}});
    return()=>abort.abort();
  },[]);
  useEffect(()=>{let active=true;if(props.doc.indiaPunjabScenario&&!scenario)void loadIndiaPunjabOverrides().then(value=>{if(active)setScenario(value);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Scenario unavailable.');});return()=>{active=false;};},[props.doc.indiaPunjabScenario,scenario]);
  const effectiveData=useMemo(()=>props.doc.indiaPunjabScenario&&scenario?Object.fromEntries(Object.entries(data).map(([key,value])=>[key,indiaScenarioCollection(value,scenario)])):data,[data,scenario,props.doc.indiaPunjabScenario]);
  useEffect(()=>{cache.current=effectiveData;},[effectiveData]);
  const projected=useMemo(()=>{
    const masks=hiddenMasks(props.doc,effectiveData);
    return ['world-region','world-province'].flatMap(key=>visibleBoundaries(effectiveData[key]||empty,props.doc,masks).features.flatMap(feature=>{
      const original=areaById.get(String(feature.id));if(!original)return [];const area=indiaScenarioArea(original,props.doc);if(!visible(area,props.doc))return [];
      const normalized=sphericalFeature(feature),point=projection(area.center as [number,number]);
      const cached=worldRenderedGeometry(feature.geometry);
      return cached.path&&point?[{feature:normalized,area,path:cached.path,size:cached.size,point:point as [number,number]}]:[];
    }));
  },[props.doc,effectiveData]);
  // Expensive geographic path construction is cached independently of camera updates.
  useEffect(()=>{scene.current=projected;},[projected]);
  function transform(next:{k:number;x:number;y:number}){const node=svg.current,behavior=controller.current;if(node&&behavior)d3Select(node).call(selection=>behavior.transform(selection,zoomIdentity.translate(next.x,next.y).scale(next.k)));}
  function fit(bounds:number[],padding=28){transform(equalEarthFit(bounds,padding));}
  function rootPoint(clientX:number,clientY:number){const node=svg.current;if(!node)return [0,0];const point=node.createSVGPoint();point.x=clientX;point.y=clientY;const matrix=node.getScreenCTM();const p=matrix?point.matrixTransform(matrix.inverse()):point;return [p.x,p.y];}
  function shapeSelect(points:number[][],kind:string){
    const candidates=new Set(selectableAreas(latest.current.doc).map(a=>a.id)),t=camera.current;
    return scene.current.filter(({area,point})=>{if(!candidates.has(area.id))return false;const p=t.apply(point);if(kind==='polygon')return inside(p,points);const [a,b]=points;if(!a||!b)return false;if(kind==='ellipse')return ((p[0]-(a[0]+b[0])/2)/Math.max(.001,Math.abs(a[0]-b[0])/2))**2+((p[1]-(a[1]+b[1])/2)/Math.max(.001,Math.abs(a[1]-b[1])/2))**2<=1;return p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);}).map(f=>f.area.id);
  }
  function clearSelection(){drag.current=null;polygon.current=[];measurementRef.current=[];setSelection([]);setMeasurement([]);}
  function finishSelection(){if(polygon.current.length>=3)latest.current.onPaint(shapeSelect(polygon.current,'polygon'));polygon.current=[];setSelection([]);}
  useEffect(()=>{
    const node=svg.current;if(!node)return;
    const behavior=d3Zoom<SVGSVGElement,unknown>().extent([[0,0],[WORLD_WIDTH,WORLD_HEIGHT]]).scaleExtent([.7,256]).filter(event=>event.type==='wheel'||event.type.startsWith('touch')||!['rect','ellipse','polygon','measure'].includes(latest.current.tool)&&!event.button).on('zoom',event=>{camera.current=event.transform;setView(event.transform);latest.current.onZoom(Math.log2(event.transform.k));});
    controller.current=behavior;d3Select(node).call(behavior).on('dblclick.zoom',null);
    const keys=(event:KeyboardEvent)=>{if((event.target as HTMLElement).closest('input,textarea,select,[role=dialog]'))return;if(event.key==='Escape')clearSelection();if(event.key==='Enter')finishSelection();};
    window.addEventListener('keydown',keys);return()=>{d3Select(node).on('.zoom',null);controller.current=null;window.removeEventListener('keydown',keys);};
  },[]);
  async function exportSvg(width:number,height:number,current:boolean){
    if(!svg.current||host.current?.getAttribute('aria-busy')==='true'||host.current?.querySelector('[role=alert]'))throw Error('Wait for the Equal Earth world map to finish loading.');
    const clone=svg.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',String(width));clone.setAttribute('height',String(height));clone.setAttribute('preserveAspectRatio','xMidYMid meet');clone.removeAttribute('style');
    clone.querySelectorAll('[data-transient]').forEach(node=>node.remove());
    const target=current?camera.current:equalEarthFit(scopeFocusBounds(latest.current.doc)||[-180,-90,180,90]);
    const group=clone.querySelector('[data-world-scene]');group?.setAttribute('transform',`translate(${target.x},${target.y}) scale(${target.k})`);
    clone.querySelector('[data-world-internal-borders]')?.setAttribute('display',worldInternalVisible(latest.current.doc,target.k>=3)?'inline':'none');
    clone.querySelectorAll('[data-world-label],[data-scenario-context]').forEach(label=>label.remove());
    clone.querySelector('[data-tibet-overlays]')?.remove();
    if(group)appendTibetSvg(group,tibetSvgItems(scenarioSource.current,latest.current.doc,target.k,1,new Set(scene.current.map(row=>row.area.id))));
    const exportLabels=placeLabels(scene.current,latest.current.doc,target,1);
    for(const {row,name,font} of exportLabels){
      const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.textContent=name;
      for(const [key,value] of Object.entries({'data-world-label':row.area.id,x:row.point[0],y:row.point[1],'text-anchor':'middle','dominant-baseline':'middle','font-family':'Arial,sans-serif','font-size':font,fill:'#29424e',stroke:'white','stroke-width':font*.2,'paint-order':'stroke'}))label.setAttribute(key,String(value));
      group?.appendChild(label);
    }
    if(latest.current.doc.indiaPunjabScenario&&latest.current.doc.names&&scene.current.some(row=>row.area.id===indiaPunjabScenario.ladakhId)&&target.k>=5&&contextLabelClear(exportLabels,target.k)){const p=projection(indiaPunjabScenario.aksaiLabel.center as [number,number]);if(p){const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.textContent='Aksai Chin';for(const [key,value] of Object.entries({x:p[0],y:p[1],'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':10/target.k,fill:'#29424e',stroke:'white','stroke-width':2/target.k,'paint-order':'stroke'}))label.setAttribute(key,String(value));group?.appendChild(label);}}
    const internalGroup=clone.querySelector('[data-world-internal-borders]');
    if(internalGroup&&worldInternalVisible(latest.current.doc,target.k>=3)){
      const line=worldProvinceLine(latest.current.doc);internalGroup.replaceChildren();
      for(const row of scene.current.filter(row=>row.area.level==='province'&&areaBorderVisible(row.area,latest.current.doc))){const node=document.createElementNS('http://www.w3.org/2000/svg','path');for(const [key,value] of Object.entries({'data-world-border':row.area.id,fill:'none',stroke:line.color,'stroke-opacity':.85,'stroke-width':line.width,'vector-effect':'non-scaling-stroke'}))node.setAttribute(key,String(value));internalGroup.appendChild(node);}
    }
    const rows=new Map(scene.current.map(row=>[row.area.id,row]));clone.querySelectorAll('[data-world-border]').forEach(node=>{const row=rows.get(node.getAttribute('data-world-border')||'');if(row)node.setAttribute('d',worldBorderPath(row.feature.geometry,target.k*width/WORLD_WIDTH));});
    const text=(tag:string,value:string)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);node.textContent=value;return node;};
    clone.insertBefore(text('title',latest.current.doc.indiaPunjabScenario?'Alternate world map; independent Republic of Tibet and Balochistan; Sindh, Multan, Bahawalpur, Punjab and Kashmir in India':'World · Equal Earth equal-area projection'),clone.firstChild);
    clone.insertBefore(text('metadata',JSON.stringify({projection:'Equal Earth',appearance:{scheme:latest.current.doc.worldColorScheme,countryBorder:latest.current.doc.worldCountryBorder,provinceBorder:latest.current.doc.worldProvinceBorder,internalBorders:latest.current.doc.worldInternalBorders},scenario:latest.current.doc.indiaPunjabScenario?indiaPunjabScenario:null,geographicSource:worldSource,areaNames:latest.current.doc.areaNames,view:current?{k:camera.current.k,x:camera.current.x,y:camera.current.y}:null})),clone.firstChild);
    const background=document.createElementNS('http://www.w3.org/2000/svg','rect');background.setAttribute('width',String(WORLD_WIDTH));background.setAttribute('height',String(WORLD_HEIGHT));background.setAttribute('fill',latest.current.doc.bg);clone.insertBefore(background,clone.firstChild);
    const credit=text('text',(latest.current.doc.indiaPunjabScenario?'Alternate world; peaceful negotiated Republic of Tibet and independent Balochistan; western provinces, Punjab and Kashmir in India | Punjab: LGD/Bharatlas, WFP/OCHA | ':'')+'Equal Earth · geoBoundaries CGAZ · Runfola et al. (2020) · CC BY 4.0 · doi.org/10.1371/journal.pone.0231866');credit.setAttribute('x','24');credit.setAttribute('y','649');credit.setAttribute('font-size','9');credit.setAttribute('fill','#526477');clone.appendChild(credit);
    return new XMLSerializer().serializeToString(clone);
  }
  useEffect(()=>{
    if(loading||error||!projected.length||ready.current)return;
    ready.current=true;
    const api:MapAPI={
      fit,zoom:amount=>{const node=svg.current,behavior=controller.current;if(node&&behavior)d3Select(node).call(selection=>behavior.scaleBy(selection,2**amount));},
      bounds:()=>{if(camera.current.k<1.1)return [-180,-90,180,90];const locations:number[][]=[];for(let x=0;x<=8;x++)for(let y=0;y<=8;y++){const p=projection.invert?.(camera.current.invert([x*WORLD_WIDTH/8,y*WORLD_HEIGHT/8]));if(p&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)locations.push(p);}return locations.length?[Math.min(...locations.map(p=>p[0])),Math.min(...locations.map(p=>p[1])),Math.max(...locations.map(p=>p[0])),Math.max(...locations.map(p=>p[1]))]:[-180,-90,180,90];},
      getData:()=>cache.current,
      snapshot:async()=>rasterizeWorldSvg(await exportSvg(1600,880,true),1600,880,'png'),
      exportWorld:exportSvg,finishSelection,clearSelection,
      select:(points,kind)=>{const rect=svg.current?.getBoundingClientRect();return shapeSelect(points.map(p=>rootPoint(p[0]+(rect?.left||0),p[1]+(rect?.top||0))),kind);},
    };
    latest.current.onReady(api);latest.current.onStatus('Equal Earth · accurate relative areas · zoom in for internal boundaries');
  });
  function hit(event:React.MouseEvent<SVGSVGElement>){const node=(event.target as Element).closest('[data-area]');return node?.getAttribute('data-area')||'';}
  function click(event:React.MouseEvent<SVGSVGElement>){
    if(suppressClick.current){suppressClick.current=false;return;}
    const p=latest.current,point=rootPoint(event.clientX,event.clientY);
    if(p.tool==='polygon'){polygon.current=[...polygon.current,point];setSelection(polygon.current);return;}
    if(p.tool==='measure'){const location=projection.invert?.(camera.current.invert(point as [number,number]));if(location&&Math.abs(location[0])<=180&&Math.abs(location[1])<=90){measurementRef.current=[...measurementRef.current,location];setMeasurement(measurementRef.current);}return;}
    if(['pan','rect','ellipse'].includes(p.tool))return;const id=hit(event);if(!id)return;setSelected(id);
    if(p.tool==='pick')p.onPick(id);else if(p.tool==='inspect')p.onInspect?.(id);else p.onPaint([id],p.tool==='erase'||event.shiftKey);
  }
  const topInset=size.width<700?44:0,bottomInset=size.width<700?100:0,frameHeight=Math.max(120,size.height-topInset-bottomInset);
  const scale=Math.max(.01,Math.min(size.width/WORLD_WIDTH,frameHeight/WORLD_HEIGHT));
  const detail=view.k>=3,internalVisible=worldInternalVisible(props.doc,detail),countryLine=worldCountryLine(props.doc),provinceLine=worldProvinceLine(props.doc);
  const fills=useMemo(()=>projected.map(row=>{
    const paint=displayedPaint(row.area,props.doc),color=tibetCulturalColor(row.area,props.doc)||paint?.color||displayedBaseColor(props.doc),province=row.area.level==='province';
    return <path key={row.area.id} data-area={row.area.id} data-level={row.area.level} d={row.path} fill={color} stroke="none" pointerEvents={province&&!detail?'none':'visiblePainted'}><title>{areaDisplayName(row.area,props.doc)}</title></path>;
  }),[projected,props.doc,detail]);
  const patterns=useMemo(()=>projected.filter(row=>{const p=displayedPaint(row.area,props.doc);return p&&p.pattern!=='solid';}).map(row=><path key={row.area.id} d={row.path} fill={`url(#${prefix}-${displayedPaint(row.area,props.doc)!.pattern})`} pointerEvents="none"/>),[projected,props.doc,prefix]);
  const internal=projected.filter(row=>row.area.level==='province'),countries=projected.filter(row=>row.area.level==='region');
  const placedLabels=placeLabels(projected,props.doc,view,scale);
  const labels=placedLabels.map(({row,name,font})=><text key={row.area.id} data-world-label={row.area.id} x={row.point[0]} y={row.point[1]} textAnchor="middle" dominantBaseline="middle" fontFamily="Arial,sans-serif" fontSize={font} fill="#29424e" stroke="white" strokeWidth={font*.2} paintOrder="stroke" pointerEvents="none">{name}</text>);
  const tibetItems=tibetSvgItems(scenario,props.doc,view.k,scale,new Set(projected.map(row=>row.area.id)));
  const highlighted=projected.find(row=>row.area.id===(hover||selected));
  return <div className="gl-map equal-earth-map"><div ref={host} className="gl-host equal-earth-host" aria-busy={loading} data-projection="equal-earth">
    <svg ref={svg} className="equal-earth-svg" role="application" tabIndex={0} aria-label="World map in Equal Earth equal-area projection. Arrow keys pan; plus and minus zoom. Use Areas search to select countries." viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} preserveAspectRatio="xMidYMid meet" width="100%" height={frameHeight} style={{height:frameHeight,marginTop:topInset,background:props.doc.bg,touchAction:'none',cursor:props.tool==='pan'?'grab':['rect','ellipse','polygon','measure'].includes(props.tool)?'crosshair':'pointer'}}
      onKeyDown={event=>{const delta:Record<string,number[]>={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};if(delta[event.key]){event.preventDefault();const [x,y]=delta[event.key];transform({k:camera.current.k,x:camera.current.x+x,y:camera.current.y+y});}else if(['+','=','-'].includes(event.key)){event.preventDefault();const k=Math.min(256,Math.max(.7,camera.current.k*(event.key==='-'?1/1.5:1.5)));transform({k,x:WORLD_WIDTH/2-(WORLD_WIDTH/2-camera.current.x)*k/camera.current.k,y:WORLD_HEIGHT/2-(WORLD_HEIGHT/2-camera.current.y)*k/camera.current.k});}else if(event.key==='Escape')clearSelection();}}
      onClick={click} onMouseMove={event=>{const id=hit(event);setHover(id);latest.current.onHover(id?areaDisplayName(areaById.get(id)!,latest.current.doc):'');if(drag.current)setSelection([drag.current,rootPoint(event.clientX,event.clientY)]);if(id&&event.ctrlKey&&['paint','erase'].includes(latest.current.tool))latest.current.onPaint([id],latest.current.tool==='erase'||event.shiftKey);}}
      onMouseLeave={()=>{setHover('');latest.current.onHover('');}}
      onMouseDown={event=>{if(['rect','ellipse'].includes(latest.current.tool)&&event.button===0){event.preventDefault();drag.current=rootPoint(event.clientX,event.clientY);setSelection([drag.current,drag.current]);}}}
      onMouseUp={event=>{if(drag.current){const points=[drag.current,rootPoint(event.clientX,event.clientY)];latest.current.onPaint(shapeSelect(points,latest.current.tool));drag.current=null;setSelection([]);suppressClick.current=true;}}}
      onContextMenu={event=>{event.preventDefault();if(latest.current.tool==='polygon')finishSelection();else if(!['pan','inspect','measure'].includes(latest.current.tool)){const id=hit(event);if(id)latest.current.onPaint([id],true);}}}>
      <defs>{['stripes','dots','cross'].map(pattern=><pattern key={pattern} id={`${prefix}-${pattern}`} width="8" height="8" patternUnits="userSpaceOnUse"><path d={pattern==='stripes'?'M-2 2L2 -2M0 8L8 0M6 10L10 6':pattern==='cross'?'M4 0V8M0 4H8':'M4 4h.1'} fill="none" stroke="#ffffff" strokeOpacity=".6" strokeWidth={pattern==='dots'?2:1}/></pattern>)}</defs>
      <g data-world-scene="" transform={view.toString()}>
        {fills}{patterns}
        <g data-world-internal-borders="" display={internalVisible?'inline':'none'} pointerEvents="none">{internalVisible&&internal.filter(row=>areaBorderVisible(row.area,props.doc)).map(row=><path key={row.area.id} data-world-border={row.area.id} d={worldBorderPath(row.feature.geometry,view.k*scale)} fill="none" stroke={provinceLine.color} strokeOpacity=".85" strokeWidth={provinceLine.width} vectorEffect="non-scaling-stroke"/>)}</g>
        <g data-world-country-borders="" pointerEvents="none">{countries.filter(row=>areaBorderVisible(row.area,props.doc)).map(row=><path key={row.area.id} data-world-border={row.area.id} d={worldBorderPath(row.feature.geometry,view.k*scale)} fill="none" stroke={countryLine.color} strokeOpacity="1" strokeWidth={countryLine.width} vectorEffect="non-scaling-stroke"/>)}</g>
        {labels}
        <g data-tibet-overlays="">{tibetItems.map(item=>createElement(item.tag,{key:item.tag+'-'+item.id,...item.props},item.text))}</g>
        {props.doc.indiaPunjabScenario&&props.doc.names&&projected.some(row=>row.area.id===indiaPunjabScenario.ladakhId)&&view.k>=5&&contextLabelClear(placedLabels,view.k*scale)&&<text data-scenario-context="aksai-chin" x={projection(indiaPunjabScenario.aksaiLabel.center as [number,number])![0]} y={projection(indiaPunjabScenario.aksaiLabel.center as [number,number])![1]} textAnchor="middle" fontFamily="Arial,sans-serif" fontSize={10/(view.k*scale)} fill="#29424e" stroke="white" strokeWidth={2/(view.k*scale)} paintOrder="stroke" pointerEvents="none">Aksai Chin</text>}
        {highlighted&&<path data-transient="highlight" d={worldBorderPath(highlighted.feature.geometry,view.k*scale)} fill="none" stroke="#1d7b70" strokeWidth="1.8" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
        {measurement.length>0&&<path data-transient="measurement" d={path({type:'LineString',coordinates:measurement})||''} fill="none" stroke="#1d7b70" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
      </g>
      {selection.length>0&&<g data-transient="selection" fill="#2764d825" stroke="#2764d8" strokeWidth={1/scale} strokeDasharray={`${4/scale} ${3/scale}`} pointerEvents="none">{props.tool==='polygon'?<polygon points={selection.map(p=>p.join(',')).join(' ')}/>:selection.length>1?props.tool==='ellipse'?<ellipse cx={(selection[0][0]+selection[1][0])/2} cy={(selection[0][1]+selection[1][1])/2} rx={Math.abs(selection[0][0]-selection[1][0])/2} ry={Math.abs(selection[0][1]-selection[1][1])/2}/>:<rect x={Math.min(selection[0][0],selection[1][0])} y={Math.min(selection[0][1],selection[1][1])} width={Math.abs(selection[0][0]-selection[1][0])} height={Math.abs(selection[0][1]-selection[1][1])}/>:null}</g>}
    </svg>
    {loading&&<div className="map-loading">Preparing Equal Earth map…</div>}{error&&<div role="alert" className="map-error">{error}</div>}
    </div>{measurement.length>0&&<output className="measurement-readout"><strong>{distanceKm(measurement).toFixed(2)} km</strong><span>{measurement.length} points · geodesic path</span><button onClick={clearSelection}>Clear measurement</button></output>}</div>;
}
