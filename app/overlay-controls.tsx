'use client';
/* oxlint-disable next/no-img-element -- Local bounded photo thumbnails also support the static Vite build, without a Next image server. */
import type {MapDoc} from './map-model';
import {mappedGurdwaras as gurdwaras,shrineRegion} from './gurdwara-catalog';
import GurdwaraDirectory from './gurdwara-directory-panel';
import {scopePreset} from './scope-model';
import curatedShrines from './gurdwara-curated-groups.json';
import {shrinePhotos} from './gurdwara-photos';
import {shrineAllowed} from './overlay-model';
type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void;onAutoColor:()=>void;busy:boolean};
const around=([x,y]:number[])=>[x-.018,y-.014,x+.018,y+.014];
const nameOptions=[['names','States, districts & tehsils'],['cityLabels','Cities'],['gurdwaraLabels','Gurdwaras'],['communityShrineLabels','Other community shrines'],['riverLabels','Rivers'],['landformLabels','Mountains & plateaus'],['demographicLabels','Demographic values'],['metroLabels','Metro stations']] as const;
export default function OverlayControls({doc,onChange,onFit,onAutoColor,busy}:Props){
 function setAllNames(show:boolean){onChange({names:show,cityLabels:show,gurdwaraLabels:show,communityShrineLabels:show,riverLabels:show,landformLabels:show,demographicLabels:show,metroLabels:show});}
 function showShrine(id:string){const site=gurdwaras.find(g=>g.id===id),region=shrineRegion(id);if(!site)return;onChange({...(region?scopePreset(doc,'single',{scopeRegion:region}):scopePreset(doc,'full')),gurdwaras:true,gurdwaraFilter:'all'});onFit(around(site.coordinates));}
 const selected=gurdwaras.filter(g=>shrineAllowed(g,doc));
 function fitShrines(){if(!selected.length)return;const b=selected.reduce((b,g)=>[Math.min(b[0],g.coordinates[0]),Math.min(b[1],g.coordinates[1]),Math.max(b[2],g.coordinates[0]),Math.max(b[3],g.coordinates[1])],[180,90,-180,-90]);onFit(b);}
 return <section className="overlay-controls" aria-labelledby="overlay-heading">
  <h2 id="overlay-heading">Cities & Sikh heritage</h2>
  <div className="map-name-controls"><h3>Names on map</h3><p className="muted">Hide names without hiding their markers or areas.</p><div className="bulk-controls"><button type="button" onClick={()=>setAllNames(true)}>Show all names</button><button type="button" onClick={()=>setAllNames(false)}>Hide all names</button></div>{nameOptions.map(([key,label])=><label className="overlay-toggle" key={key}><input type="checkbox" aria-label={'Show '+label.toLowerCase()+' names'} checked={doc[key]} onChange={e=>onChange({[key]:e.target.checked})}/> {label}</label>)}</div>
  <label className="overlay-toggle"><input type="checkbox" aria-label="Show major cities" checked={doc.cities} onChange={e=>onChange({cities:e.target.checked})}/> Show major cities</label>
  {doc.cities&&<>
   <label className="field">City selection<select aria-label="City selection" value={doc.cityMode} onChange={e=>onChange({cityMode:e.target.value as MapDoc['cityMode']})}><option value="major">Major cities & national capitals</option><option value="all">All source settlement points</option></select></label>
   {doc.cityMode==='major'&&<label className="field">Minimum source population<input type="number" aria-label="Major city population threshold" min={0} max={5000000} step={50000} value={doc.cityMinPopulation} onChange={e=>onChange({cityMinPopulation:Math.max(0,Math.min(5000000,+e.target.value||0))})}/></label>}
   <label className="overlay-toggle"><input type="checkbox" aria-label="Auto-color city markers" checked={doc.cityAutoColors} onChange={e=>onChange({cityAutoColors:e.target.checked})}/> Auto-color city markers</label>
   {!doc.cityAutoColors&&<label className="overlay-color"><input type="color" aria-label="City highlight color" value={doc.cityColor} onChange={e=>onChange({cityColor:e.target.value})}/> City highlight color</label>}
   <button disabled={busy} onClick={onAutoColor}>{busy?'Finding city districts…':'Auto-color major-city districts'}</button>
   <p className="muted">Markers highlight approximate Natural Earth city centers. Red: national capitals; orange: source population ≥1 million; teal: other selected cities. Population is an archival source estimate, not a current census. Auto-color applies to containing visible districts, not municipal city limits; existing colors are replaced only in those districts and can be undone.</p>
  </>}
  <label className="overlay-toggle"><input type="checkbox" aria-label="Show gurdwaras" checked={doc.gurdwaras} onChange={e=>onChange({gurdwaras:e.target.checked})}/> Show historic gurdwaras</label>
  {doc.gurdwaras&&<>
   <label className="field">Heritage selection<select aria-label="Gurdwara selection" value={doc.gurdwaraFilter} onChange={e=>onChange({gurdwaraFilter:e.target.value as MapDoc['gurdwaraFilter']})}><option value="all">All {gurdwaras.length} mapped shrines</option><option value="directory-famous">Directory famous 20 · {curatedShrines.top_20_famous.length} mapped</option><option value="directory-historic">Directory historic 50 · {curatedShrines.top_50_important_historic.length} mapped</option><option value="takht">Five Takhts</option><option value="featured">{gurdwaras.filter(g=>g.tier==='featured').length} featured important shrines</option><option value="special">Five Takhts + featured shrines</option></select></label>
   <label className="overlay-color"><input type="color" aria-label="Historic gurdwara color" value={doc.gurdwaraColor} onChange={e=>onChange({gurdwaraColor:e.target.value})}/> Other historic photo frame</label>
   <label className="field">Photo marker size<input type="number" aria-label="Gurdwara symbol size" min={.6} max={2} step={.1} value={doc.gurdwaraScale} onChange={e=>onChange({gurdwaraScale:Math.max(.6,Math.min(2,+e.target.value||1))})}/></label>
   <label className="field">Find a shrine<select aria-label="Find a gurdwara" value="" onChange={e=>{if(e.target.value)showShrine(e.target.value);}}><option value="">Choose a sourced shrine…</option>{gurdwaras.map(g=><option key={g.id} value={g.id}>{g.name} · {g.city}</option>)}</select></label>
   <button onClick={fitShrines}>Fit shown gurdwaras</button>
   <div className="shrine-photo-preview">{gurdwaras.filter(g=>g.tier!=='historic').slice(0,3).map(g=>{const photo=shrinePhotos.find(p=>p.id===g.id);return photo?<img key={g.id} src={photo.file} alt={g.name} title={g.name}/>:null;})}<span>{shrinePhotos.length} sourced photos<br/><small>Click a map photo for a closer look & credit.</small></span></div>
   <p className="coverage-warning">{gurdwaras.length} sourced map locations plus the searchable 300-entry directory below. Photo markers show the named site, with gold frames for Takhts and featured shrines. A neutral badge identifies sites without a verified photo; no other shrine’s image is substituted. Published coordinate accuracy varies; these are not surveyed entrances. The current geographic scope still applies—choose Full map or a relevant region for shrines elsewhere.</p>
  </>}
  <GurdwaraDirectory onShow={showShrine}/>
 </section>;
}
