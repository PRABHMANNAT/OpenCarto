'use client';
import WorldStyleControls from './world-style-controls';
import {areasByLayer, areaById, type MapDoc} from './map-model';
import {indiaPunjabScenario,indiaScenarioArea,scenarioAreaVisible,type PunjabMapLevel} from './india-punjab-scenario';
import {worldCountries,worldSource,worldBounds,worldFocusBounds} from './world-map-model';

export default function WorldMapControls({doc,onChange,onFit,onPunjabDetails,onAlternateRequest}:{doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void;onPunjabDetails?:(level:PunjabMapLevel)=>void;onAlternateRequest:()=>void}) {
  const countries=worldCountries.filter(c=>scenarioAreaVisible(c.id,doc));
  const country=worldCountries.find(c=>c.id===doc.scopeAreas[0]);
  const divisions=(areasByLayer.get('world-province')||[]).filter(a=>(!country||a.parent===country.id)&&scenarioAreaVisible(a.id,doc)).map(a=>indiaScenarioArea(a,doc)).sort((a,b)=>a.name.localeCompare(b.name));
  const showDivisions=doc.regions.world.province;
  return <section className="world-map-controls" aria-label="World map controls">
    <h2>World map</h2>
    <label className="field">Boundary edition<select aria-label="World boundary edition" value={doc.indiaPunjabScenario?'india-punjab':'source'} onChange={e=>{if(e.target.value==='india-punjab')onAlternateRequest();else{onChange({indiaPunjabScenario:false,basemap:'political',scopeAreas:[]});onFit([...worldBounds]);}}}>
      <option value="source">Source world map</option><option value="india-punjab">Alternate world map (password)</option>
    </select></label>
    <WorldStyleControls doc={doc} onChange={onChange}/>
    {doc.indiaPunjabScenario&&<><p className="coverage-warning">Alternate world · United Punjab and the combined Kashmir extent are included in India. Aksai Chin is part of Ladakh. Amb remains outside Punjab.</p><div className="scope-shortcuts"><button onClick={()=>onFit(worldFocusBounds(areaById.get(indiaPunjabScenario.punjabId),doc))}>Focus United Punjab</button><button onClick={()=>onFit(worldFocusBounds(areaById.get(indiaPunjabScenario.indiaId),doc))}>Focus India</button><button onClick={()=>onFit(worldFocusBounds(areaById.get(indiaPunjabScenario.kashmirId),doc))}>Focus Kashmir</button><button onClick={()=>onFit(worldFocusBounds(areaById.get(indiaPunjabScenario.ladakhId),doc))}>Focus Ladakh + Aksai Chin</button></div>{onPunjabDetails&&<><p className="muted">Detailed Punjab · 48 districts · 12 divisions · 193 tehsils. Approved atlas boundaries and names.</p><div className="scope-shortcuts">{(['district','division','tehsil'] as const).map(level=><button key={level} onClick={()=>onPunjabDetails(level)}>Punjab {level}s</button>)}</div></>}</>}

    <p className="muted"><strong>{doc.basemap==='political'?'Equal Earth · equal-area':'Imagery view · Mercator'}</strong><br/>{doc.basemap==='political'?'Country sizes retain their geographic proportions. Zoom in for lighter internal boundaries and smaller labels.':'This existing imagery basemap uses Mercator. Return to Equal Earth to compare land areas.'}</p>
    {doc.basemap!=='political'&&<button type="button" onClick={()=>onChange({basemap:'political'})}>Return to Equal Earth</button>}
    <p className="muted">{countries.length} countries / territories · {(worldSource.layers['world-province'].count-(doc.indiaPunjabScenario?indiaPunjabScenario.removedIds.filter(id=>areaById.get(id)?.level==='province').length:0)).toLocaleString()} first-level divisions.</p>
    <label className="field">Country or territory<select aria-label="World country" value={country?.id||''} onChange={e=>{const id=e.target.value;onChange({scopeAreas:id?[id]:[]});onFit(id?worldFocusBounds(areaById.get(id),doc):[...worldBounds]);}}>
      <option value="">All countries · world view</option>{countries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    <label className="field">Administrative boundaries<select aria-label="World administrative level" value={showDivisions?'province':'country'} onChange={e=>onChange({regions:{...doc.regions,world:{...doc.regions.world,show:true,province:e.target.value==='province',district:false,tehsil:false,uc:false,division:false}},areaDetails:Object.fromEntries(Object.entries(doc.areaDetails).filter(([id])=>areaById.get(id)?.region!=='world'))})}>
      <option value="country">Countries only</option><option value="province">Countries + first-level divisions</option>
    </select></label>
    {country&&divisions.length>0&&<label className="field">Find a first-level division<select aria-label="World first-level division" value="" onChange={e=>{const area=areaById.get(e.target.value);if(area)onFit(worldFocusBounds(area,doc));}}><option value="">Zoom to a state / province…</option>{divisions.map(a=><option key={a.id} value={a.id}>{doc.areaNames[a.id]||a.name}</option>)}</select></label>}
    {country&&<p className="muted">{country.name}: {divisions.length} mapped first-level divisions.{!divisions.length?' This source supplies only the country outline; no subdivisions are invented.':''}</p>}
    <div className="scope-shortcuts"><button type="button" onClick={()=>{onChange({scopeAreas:[]});onFit([...worldBounds]);}}>Fit whole world</button></div>
    <p className="muted">Use Color, Inspect, search and Export map as usual. Zoom in to read division names. Districts, counties and tehsils are excluded.</p>
    <p className="coverage-warning">Source snapshot · geoBoundaries CGAZ, CC BY 4.0. Disputed areas follow the source’s definitions. <a href={worldSource.url} target="_blank" rel="noreferrer">Source & coverage</a></p>
  </section>;
}
