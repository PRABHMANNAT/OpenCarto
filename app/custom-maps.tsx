'use client';
import {useEffect,useImperativeHandle,useMemo,useRef,useState,type Ref} from 'react';
import {Download,FolderOpen,MapPinned,PencilLine,Plus,Save,Search} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {download,type MapDoc} from './map-model';
import {scopeLabel} from './scope-model';
import {activeCustomMapKey,listCustomMaps,saveCustomMap,suggestMapName,type CustomMap} from './custom-map-storage';
import './custom-maps.css';

export type CustomMapsAPI={save:()=>void;open:()=>void;detach:()=>void};
type Props={ref:Ref<CustomMapsAPI>;doc:MapDoc;getViewBounds:()=>number[]|null;onOpen:(map:CustomMap)=>void;onStatus:(message:string)=>void;onOpenPrivate:()=>void};
type Mode='library'|'save'|'rename'|null;
const message=(error:unknown)=>error instanceof Error?error.message:'Saved maps are unavailable. Download settings to keep a copy.';
function rememberActive(map:CustomMap|null){try{if(map)localStorage.setItem(activeCustomMapKey,JSON.stringify({id:map.id,updatedAt:map.updatedAt}));else localStorage.removeItem(activeCustomMapKey)}catch{/* Named maps remain saved even if draft metadata is unavailable. */}}
function downloadSettings(doc:MapDoc,name:string){
 const file=name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,100)||'custom-map';
 download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),file+'.json');
}

export default function CustomMaps({ref,doc,getViewBounds,onOpen,onStatus,onOpenPrivate}:Props){
 const [maps,setMaps]=useState<CustomMap[]>([]),[mode,setMode]=useState<Mode>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[name,setName]=useState(''),[renameId,setRenameId]=useState(''),[activeId,setActiveId]=useState(''),[activeVersion,setActiveVersion]=useState<number>();
 const busy=useRef(false),refreshVersion=useRef(0);
 const active=maps.find(m=>m.id===activeId);
 const dirty=useMemo(()=>!!active&&JSON.stringify(doc)!==JSON.stringify(active.doc),[doc,active]);
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase();return maps.filter(m=>(m.name+' '+m.doc.title).toLocaleLowerCase().includes(q))},[maps,query]);
 useEffect(()=>{
  let cancelled=false;
  listCustomMaps().then(entries=>{
   if(cancelled)return;setMaps(entries);
   try{const pointer=JSON.parse(localStorage.getItem(activeCustomMapKey)||'null');if(pointer&&entries.some(m=>m.id===pointer.id)&&typeof pointer.updatedAt==='number'){setActiveId(pointer.id);setActiveVersion(pointer.updatedAt)}}catch{}
  }).catch(e=>{if(!cancelled)setError(message(e))}).finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true;refreshVersion.current++};
 },[]);
 async function refresh(){
  const version=++refreshVersion.current;setLoading(true);setError('');
  try{const entries=await listCustomMaps();if(version===refreshVersion.current)setMaps(entries)}catch(e){if(version===refreshVersion.current)setError(message(e))}finally{if(version===refreshVersion.current)setLoading(false)}
 }
 function openLibrary(){if(busy.current)return;setQuery('');setMode('library');void refresh()}
 function startNew(){setError('');setName(suggestMapName(active?active.name+' copy':doc.title||'Untitled map',maps));setMode('save')}
 async function persist(kind:'new'|'update'|'rename'){
  if(busy.current||loading)return;
  const existing=kind==='rename'?maps.find(m=>m.id===renameId):kind==='update'?active:undefined;
  if(kind!=='new'&&!existing)return;
  busy.current=true;setSaving(true);setError('');
  try{
   const entry=await saveCustomMap({id:existing?.id,name:kind==='update'?existing!.name:name,doc:kind==='rename'?existing!.doc:doc,viewBounds:kind==='rename'?existing!.viewBounds:getViewBounds(),expectedUpdatedAt:kind==='update'||kind==='rename'&&existing?.id===activeId?activeVersion:existing?.updatedAt});
   setMaps(previous=>[entry,...previous.filter(m=>m.id!==entry.id)].sort((a,b)=>b.updatedAt-a.updatedAt));
   if(kind!=='rename'||entry.id===activeId){setActiveId(entry.id);setActiveVersion(entry.updatedAt);rememberActive(entry)}
   setQuery('');if(kind!=='update'||mode)setMode('library');
   onStatus((kind==='rename'?'Renamed ': 'Saved ')+entry.name);
  }catch(e){setError(message(e));if(!mode)setMode('library');onStatus('Map was not saved — open My maps for details')}
  finally{busy.current=false;setSaving(false)}
 }
 function save(){if(busy.current)return;if(loading){setMode('library');return;}if(active)void persist('update');else startNew()}
 useImperativeHandle(ref,()=>({save,open:openLibrary,detach:()=>{setActiveId('');setActiveVersion(undefined);rememberActive(null)}}));
 function openMap(entry:CustomMap){
  if(busy.current)return;
  // The editor receives its own validated snapshot so editing never mutates the library.
  onOpen(entry);setActiveId(entry.id);setActiveVersion(entry.updatedAt);rememberActive(entry);setMode(null);
 }
 function backup(){downloadSettings(doc,active?.name||doc.title||'custom-map');onStatus('Settings downloaded')}
 return <Dialog open={mode!==null} onOpenChange={open=>{if(!open&&!busy.current)setMode(null)}}>
  <DialogContent className="custom-maps-dialog" showCloseButton={!saving}>
   <div className="custom-maps-heading"><span className="custom-maps-icon"><FolderOpen size={23}/></span><div><DialogTitle>{mode==='save'?'Save custom map':mode==='rename'?'Rename saved map':'My maps'}</DialogTitle><DialogDescription>Keep your maps here and return to them anytime.</DialogDescription></div></div>
   <p className="custom-maps-storage">Your editable saves stay in this browser on this device. The custom atlas opens directly from the server. Download saved-map settings for a backup.</p>
   {error&&<p role="alert" className="custom-maps-error">{error}</p>}
   {mode==='library'?<>
    {(!query||'united subcontinent alternative political geography private atlas'.includes(query.toLowerCase()))&&<div className="ua-private-card"><MapPinned size={23}/><div><strong>United Subcontinent — Alternative Political Geography</strong><small>Custom atlas · no password · independent geography</small></div><button type="button" onClick={()=>{setMode(null);onOpenPrivate()}}>Open custom map</button></div>}
    <div className="custom-map-working"><div><small>CURRENT MAP</small><strong>{active?.name||doc.title||'Untitled map'}</strong><span>{active?(dirty?'Unsaved changes':'Saved map'):'Not saved to My maps yet'}</span></div><div className="custom-map-working-actions"><button type="button" className="map-save-primary" disabled={loading||saving} onClick={()=>active?void persist('update'):startNew()}><Save size={15}/>{saving?'Saving…':active?'Save changes':'Save current map'}</button>{active&&<button type="button" disabled={loading||saving} onClick={startNew}><Plus size={15}/>Save as new map</button>}</div></div>
    <div className="custom-maps-search"><Search size={16}/><input type="search" aria-label="Search saved maps" placeholder="Search your maps" value={query} onChange={e=>setQuery(e.target.value)}/><span>{maps.length}</span></div>
    <div className="custom-map-list" aria-label="Saved custom maps" aria-busy={loading}>
     {loading?<p className="custom-maps-empty">Opening your maps…</p>:filtered.length?<ul>{filtered.map(entry=><li key={entry.id} data-custom-map={entry.id}>
      <span className="custom-map-card-icon"><MapPinned size={22}/></span><div className="custom-map-card-copy"><strong>{entry.name}{entry.id===activeId&&<small>Current</small>}</strong><span>{scopeLabel(entry.doc)} · {Object.keys(entry.doc.fills).length.toLocaleString()} colored areas</span><time dateTime={new Date(entry.updatedAt).toISOString()}>Saved {new Date(entry.updatedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time></div>
      <div className="custom-map-card-actions"><button type="button" disabled={saving} aria-label={'Open '+entry.name} onClick={()=>openMap(entry)}>Open</button><button type="button" disabled={saving} aria-label={'Rename '+entry.name} title="Rename map" onClick={()=>{setError('');setRenameId(entry.id);setName(entry.name);setMode('rename')}}><PencilLine size={15}/></button><button type="button" aria-label={'Download '+entry.name+' settings'} title="Download settings" onClick={()=>downloadSettings(entry.doc,entry.name)}><Download size={15}/></button></div>
     </li>)}</ul>:<p className="custom-maps-empty">{maps.length?'No maps match your search.':error?'Your saved maps could not be opened.':'No saved maps yet. Save your current map to start.'}</p>}
    </div>
    <div className="custom-maps-footer"><button type="button" onClick={backup}><Download size={15}/>Download current settings</button>{error&&<button type="button" disabled={loading||saving} onClick={()=>void refresh()}>Try again</button>}<span>Open a map to edit it. Undo restores the previous working map.</span></div>
   </>:<form className="custom-map-name-form" onSubmit={event=>{event.preventDefault();void persist(mode==='rename'?'rename':'new')}}>
    <label htmlFor="custom-map-name">Map name</label><input id="custom-map-name" autoFocus maxLength={100} value={name} placeholder="For example, Punjab heritage" onChange={e=>setName(e.target.value)} disabled={saving}/>
    <p>{mode==='rename'?'Changes the saved name. Your map title and current edits stay as they are.':'Saves your colors, names, visible areas, layers and current view. Each map can be edited again later.'}</p>
    <div className="custom-map-form-actions"><button type="button" disabled={saving} onClick={()=>{setError('');setMode('library')}}>Back to My maps</button><button type="submit" className="map-save-primary" disabled={saving||loading||!name.trim()}><Save size={15}/>{saving?'Saving…':mode==='rename'?'Rename map':'Save map'}</button></div>
   </form>}
  </DialogContent>
 </Dialog>;
}
