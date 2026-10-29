'use client';
import {useDeferredValue,useMemo,useState} from 'react';
import {Search,LocateFixed,Eye,EyeOff,MapPinned,X,PencilLine} from 'lucide-react';
import {areaDisplayName} from './area-name-model';
import {regions,effectivePaint,type MapDoc,type Area} from './map-model';
import {selectionAreas,scopeFocusBounds} from './scope-model';
import {findAreas,areaContext,areaLevelNames,hiddenArea,addArea,showArea} from './area-search-model';
import {areaShown,areaDetailOptions,detailLabels,setAreaDetail,type DetailMode} from './area-visibility-model';

type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void;onPaint:(id:string)=>void;onInspect:(id:string)=>void;variant?:'areas'|'layers'};
export default function AreaSearch({doc,onChange,onFit,onPaint,onInspect,variant='areas'}:Props){
 const initialLimit=variant==='layers'?6:20;
 const [query,setQuery]=useState(''),[level,setLevel]=useState('all'),[region,setRegion]=useState('all'),[hiddenOnly,setHiddenOnly]=useState(false),[limit,setLimit]=useState(initialLimit);
 const deferred=useDeferredValue(query);
 const matches=useMemo(()=>findAreas(deferred,level,doc.mapScope==='world'&&region==='all'?'world':region,doc).filter(a=>!(variant==='layers'&&!deferred.trim()&&level==='all'&&region==='all')||a.level==='region'&&a.region!=='pk-lahore-study').filter(a=>!hiddenOnly||!areaShown(a,doc)),[deferred,level,region,hiddenOnly,doc,variant]);
 const selected=doc.mapScope==='selection'?selectionAreas(doc):[];
 function only(a:Area){const patch=addArea(doc,a.id,true);onChange(patch);const b=scopeFocusBounds({...doc,...patch});if(b)onFit(b);}
 function toggle(a:Area){if(areaShown(a,doc)){onChange({hidden:[...new Set([...doc.hidden,a.id])]});return;}const patch=showArea(doc,a);onChange(patch);onFit(a.bbox);}
 function detail(a:Area,mode:DetailMode|'inherit'){const shown=mode==='inherit'?{}:showArea(doc,a);onChange({...shown,...setAreaDetail({...doc,...shown},a,mode)});}
 return <section className="atlas-area-search">
  <p className="muted">Find a state, district or any existing area. Show or hide it, then choose the detail inside it.</p>
  <label className="search"><Search size={16}/><input type="search" aria-label="Find an area" placeholder="Search states, districts, tehsils…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(initialLimit);}}/></label>
  <div className="area-search-filters"><label className="field">Area type<select aria-label="Filter area type" value={level} onChange={e=>{setLevel(e.target.value);setLimit(initialLimit);}}><option value="all">All types</option>{Object.entries(areaLevelNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
  <label className="field">Region<select aria-label="Filter areas by region" value={region} onChange={e=>{setRegion(e.target.value);setLimit(initialLimit);}}><option value="all">Whole atlas</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
  <label className="enabled-filter"><input type="checkbox" checked={hiddenOnly} onChange={e=>{setHiddenOnly(e.target.checked);setLimit(initialLimit);}}/> Hidden areas only</label>
  {doc.hidden.length>0&&<div className="hidden-area-summary"><strong>{doc.hidden.length} hidden selections</strong><button type="button" onClick={()=>onChange({hidden:[]})}>Unhide all areas</button><p className="muted">Hiding an area also hides its children.</p></div>}
  {selected.length>0&&<details className="area-current-selection"><summary>On your map · {selected.length} selections</summary><div className="geography-chips">{selected.map(a=><span key={a.id}>{areaDisplayName(a,doc)}<button type="button" aria-label={'Remove '+a.name+' from selection'} onClick={()=>onChange({scopeAreas:doc.scopeAreas.filter(id=>id!==a.id)})}><X size={12}/></button></span>)}</div></details>}
  <output className="muted">{matches.length.toLocaleString()} matching areas{matches.length>limit?' · showing '+limit:''}</output>
  <div className="district-list">{matches.slice(0,limit).map(a=>{const shown=areaShown(a,doc),hidden=hiddenArea(a,doc),name=areaDisplayName(a,doc),options=areaDetailOptions(a,doc);return <div className={'area-search-card'+(!shown?' is-hidden':'')} data-area={a.id} key={a.id}>
   <div className="area-row"><button type="button" className="area-name" onClick={()=>onPaint(a.id)} title={'Color '+a.name}><i style={{background:effectivePaint(a,doc)?.color||doc.uncolored}}/><span>{name}<small>{name!==a.name?'Source: '+a.name+' · ':''}{areaLevelNames[a.level]} · {areaContext(a)}</small></span></button><button type="button" aria-label={'Zoom to '+a.name} title={'Zoom to '+a.name} onClick={()=>onFit(a.bbox)}><LocateFixed size={14}/></button></div>
   <div className="area-result-actions"><button type="button" className="area-visibility-button" aria-label={(shown?'Hide ':hidden?'Unhide ':'Show ')+a.name} aria-pressed={shown} onClick={()=>toggle(a)}>{shown?<Eye size={13}/>:<EyeOff size={13}/>} {shown?'Hide':'Show'}</button><button type="button" aria-label={'Show only '+a.name} onClick={()=>only(a)}><MapPinned size={13}/> Only this</button><button type="button" aria-label={'Rename '+a.name} onClick={()=>onInspect(a.id)}><PencilLine size={13}/> Rename</button></div>
   {options.length>1&&<label className="area-detail-field">Inside this area<select aria-label={'Detail inside '+a.name} value={doc.areaDetails[a.id]||'inherit'} onChange={e=>detail(a,e.target.value as DetailMode|'inherit')}><option value="inherit">Use map setting</option>{options.map(mode=><option key={mode} value={mode}>{mode==='none'?'Area only · hide subdivisions':detailLabels[mode]}</option>)}</select></label>}
  </div>;})}{!matches.length&&<p className="empty-state">No matching source areas. Try another spelling or clear the filters.</p>}</div>
  {matches.length>limit&&<button type="button" className="area-load-more" onClick={()=>setLimit(v=>v+20)}>Show more results</button>}
 </section>;
}
