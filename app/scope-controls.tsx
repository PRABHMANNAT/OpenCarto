'use client';
import type {MapDoc} from './map-model';
import GeographyPicker from './geography-picker';
import {scopeDefaults,scopeRegions,scopePreset,scopeFocusBounds,scopeQualification,scopeSources,type ScopeMode,type ScopeSettings} from './scope-model';

type Props={doc:MapDoc&Partial<ScopeSettings>;onChange:(patch:Partial<MapDoc>&Partial<ScopeSettings>)=>void;onFit:(bounds:number[])=>void;onNcr:()=>void};
export default function ScopeControls({doc,onChange,onFit,onNcr}:Props){
 const mode=doc.mapScope||'atlas',isCustom=mode==='combination'||mode==='historic-punjab';
 const selected=mode==='historic-punjab'?(doc.historicRegions||scopeDefaults.historicRegions):(doc.scopeRegions||scopeDefaults.scopeRegions);
 function choose(next:ScopeMode,settings:Partial<ScopeSettings>={}){const patch=scopePreset(doc,next,settings);onChange(patch);const bounds=scopeFocusBounds({...doc,...patch});if(bounds)onFit(bounds);}
 function toggle(id:string,enabled:boolean){const ids=enabled?[...selected,id]:selected.filter(value=>value!==id);choose(mode,mode==='historic-punjab'?{historicRegions:ids}:{scopeRegions:ids});}
 const qualification=scopeQualification(doc);
 return <section className="scope-controls" aria-labelledby="scope-heading">
  <h2 id="scope-heading">Map views & combinations</h2>
  {mode!=='world'&&<GeographyPicker doc={doc} onChange={onChange} onFit={onFit}/>}
  <label className="field">Geographic view<select aria-label="Geographic map scope" value={mode} onChange={event=>choose(event.target.value as ScopeMode)}>
   <option value="atlas">Regional atlas · enabled layers</option>
   <option value="world">World · countries & first-level divisions</option>
   <option value="selection">Selected countries / provinces / divisions</option>
   <option value="full">Full available map · outlines first</option>
   <option value="single">Individual state / territory / country</option>
   <option value="combination">Custom combination of regions</option>
   <option value="tricity">Chandigarh Tricity · district context</option>
   <option value="historic-punjab">Custom Historic Punjab · modern context</option>
  </select></label>
  {mode==='single'&&<label className="field">Only this region<select aria-label="Individual map region" value={doc.scopeRegion||scopeDefaults.scopeRegion} onChange={event=>choose('single',{scopeRegion:event.target.value})}>{scopeRegions.map(region=><option key={region.id} value={region.id}>{region.name}</option>)}</select></label>}
  {mode==='full'&&<label><input type="checkbox" aria-label="Include enabled detail layers" checked={doc.fullDetail||false} onChange={event=>onChange({fullDetail:event.target.checked})}/> Include enabled detail layers</label>}
  {isCustom&&<details open>
   <summary>{mode==='historic-punjab'?'Edit Historic Punjab context':'Choose regions'} · {selected.length} selected</summary>
   <div className="scope-region-options" style={{maxHeight:230,overflowY:'auto',padding:'6px 0'}}>{scopeRegions.map(region=><label key={region.id} style={{display:'flex',gap:7,alignItems:'center',padding:'3px 0'}}><input type="checkbox" aria-label={'Include '+region.name+' in geographic scope'} checked={selected.includes(region.id)} onChange={event=>toggle(region.id,event.target.checked)}/>{region.name}</label>)}</div>
   {!selected.length&&<p className="muted">No regions selected. Choose at least one to draw this combination.</p>}
  </details>}
  <div className="scope-shortcuts" style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}><button onClick={()=>choose('single',{scopeRegion:'in-delhi'})}>Only Delhi NCT</button><button onClick={onNcr}>Show Delhi NCR</button><button onClick={()=>choose('tricity')}>Show Tricity</button><button onClick={()=>{const bounds=scopeFocusBounds(doc);if(bounds)onFit(bounds);}} disabled={!scopeFocusBounds(doc)}>Fit geographic view</button></div>
  <p className="muted">Individual and combination views hide other map regions without deleting their colors or saved detail settings. Use the region layer switches below for districts, tehsils, subdivisions and wards.</p>
  {qualification&&<p className="coverage-warning">{qualification}</p>}
  {mode==='tricity'&&<p className="muted"><a href={scopeSources.tricity.url} target="_blank" rel="noreferrer">Tricity reference · SAS Nagar Police</a>. Geometry follows the existing dated administrative source layers.</p>}
 </section>;
}
