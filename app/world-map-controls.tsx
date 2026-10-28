'use client';
import {areasByLayer, areaById, type MapDoc} from './map-model';
import {worldCountries,worldSource,worldBounds,worldFocusBounds} from './world-map-model';

export default function WorldMapControls({doc,onChange,onFit}:{doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void}) {
  const country=worldCountries.find(c=>c.id===doc.scopeAreas[0]);
  const divisions=(areasByLayer.get('world-province')||[]).filter(a=>!country||a.parent===country.id).sort((a,b)=>a.name.localeCompare(b.name));
  const showDivisions=doc.regions.world.province;
  return <section className="world-map-controls" aria-label="World map controls">
    <h2>World map</h2>
    <p className="muted">{worldCountries.length} countries / territories · {worldSource.layers['world-province'].count.toLocaleString()} first-level divisions.</p>
    <label className="field">Country or territory<select aria-label="World country" value={country?.id||''} onChange={e=>{const id=e.target.value;onChange({scopeAreas:id?[id]:[]});onFit(id?worldFocusBounds(areaById.get(id)):[...worldBounds]);}}>
      <option value="">All countries · world view</option>{worldCountries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    <label className="field">Administrative boundaries<select aria-label="World administrative level" value={showDivisions?'province':'country'} onChange={e=>onChange({regions:{...doc.regions,world:{...doc.regions.world,show:true,province:e.target.value==='province',district:false,tehsil:false,uc:false,division:false}},areaDetails:Object.fromEntries(Object.entries(doc.areaDetails).filter(([id])=>areaById.get(id)?.region!=='world'))})}>
      <option value="country">Countries only</option><option value="province">Countries + first-level divisions</option>
    </select></label>
    {country&&divisions.length>0&&<label className="field">Find a first-level division<select aria-label="World first-level division" value="" onChange={e=>{const area=areaById.get(e.target.value);if(area)onFit(worldFocusBounds(area));}}><option value="">Zoom to a state / province…</option>{divisions.map(a=><option key={a.id} value={a.id}>{doc.areaNames[a.id]||a.name}</option>)}</select></label>}
    {country&&<p className="muted">{country.name}: {divisions.length} mapped first-level divisions.{!divisions.length?' This source supplies only the country outline; no subdivisions are invented.':''}</p>}
    <div className="scope-shortcuts"><button type="button" onClick={()=>{onChange({scopeAreas:[]});onFit([...worldBounds]);}}>Fit whole world</button></div>
    <p className="muted">Use Color, Inspect, search and Export map as usual. Zoom in to read division names. Districts, counties and tehsils are excluded.</p>
    <p className="coverage-warning">Source snapshot · geoBoundaries CGAZ, CC BY 4.0. Disputed areas follow the source’s definitions. <a href={worldSource.url} target="_blank" rel="noreferrer">Source & coverage</a></p>
  </section>;
}
