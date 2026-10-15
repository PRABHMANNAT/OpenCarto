'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The interactive SVG chart uses accessible graphics semantics. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,X} from 'lucide-react';
import {currentDemographics,indianCount,percent,demographicMetrics,metricValue,saveDemographicCsv,type DemographicDataset,type DemographicRecord,type DemographicMetric,type ReligionKey,type ChoroplethLegend} from './private-atlas-demography';
import scenario from './punjab-demographic-scenario.json';
import './private-atlas-demographics.css';

export function DemographicSummary({value,title='Demographics · fictional 2026'}:{value:unknown;title?:string}) {
  const stats=currentDemographics(value);
  const [selected,setSelected]=useState<ReligionKey>('sikh');
  if (!stats) return null;
  const focus=stats.religions.find(r=>r.key===selected)!;
  const arcs=stats.religions.map((r,i)=>({...r,start:stats.religions.slice(0,i).reduce((sum,previous)=>sum+previous.percentage,0)}));
  return <section className="ua-demographic-summary" aria-label={title}>
    <h3>{title}</h3>
    <div className="ua-demo-total"><span>Total residents</span><strong>{indianCount(stats.total)}</strong></div>
    <div className="ua-demo-composition">
      <svg viewBox="0 0 140 140" role="img" aria-label="Interactive fictional religious composition chart">
        <circle cx="70" cy="70" r="48" fill="none" stroke="#E8ECEE" strokeWidth="20" />
        {arcs.map(r=><circle key={r.key} cx="70" cy="70" r="48" fill="none" stroke={r.color} strokeWidth={selected===r.key?24:20}
          pathLength="100" strokeDasharray={`${r.percentage} ${100-r.percentage}`} strokeDashoffset={-r.start} transform="rotate(-90 70 70)"
          onMouseEnter={()=>setSelected(r.key)}><title>{r.name}: {indianCount(r.population)} ({percent(r.percentage,7)})</title></circle>)}
        <text x="70" y="66" textAnchor="middle">{focus.name==='Others / Jain / not stated'?'Others':focus.name}</text>
        <text x="70" y="84" textAnchor="middle" className="ua-demo-chart-share">{percent(focus.percentage,2)}</text>
      </svg>
      <div className="ua-demo-chart-focus" aria-live="polite"><strong>{focus.name}</strong><b>{indianCount(focus.population)}</b><span>{percent(focus.percentage,7)}</span></div>
    </div>
    <table className="ua-demo-composition-table"><thead><tr><th>Community</th><th>Residents</th><th>Share</th></tr></thead>
      <tbody>{stats.religions.map(r=><tr key={r.key}>
        <td><button type="button" onClick={()=>setSelected(r.key)} aria-pressed={selected===r.key}><i style={{background:r.color}} aria-hidden="true" />{r.name==='Others / Jain / not stated'?'Others':r.name}</button></td>
        <td>{indianCount(r.population)}</td><td title={percent(r.percentage,7)}>{percent(r.percentage,3)}</td>
      </tr>)}</tbody>
    </table>
    <dl className="ua-demo-facts">
      <div><dt>Urban</dt><dd>{indianCount(stats.urbanPopulation)} · {percent(stats.urbanPercent)}</dd></div>
      <div><dt>Rural</dt><dd>{indianCount(stats.ruralPopulation)} · {percent(100-stats.urbanPercent)}</dd></div>
      {stats.density!==null && <div><dt>Population density</dt><dd>{stats.density.toLocaleString('en-IN',{maximumFractionDigits:2})} / km²</dd></div>}
    </dl>
    <p className="ua-data-note">{stats.note}</p>
  </section>;
}

export function DemographicLegend({legend}:{legend?:ChoroplethLegend}) {
  if (!legend) return null;
  return <details open className="ua-demographic-legend" aria-label="Demographic map legend"><summary>{legend.title}</summary>
    {legend.items.map(item=><div key={item.label} title={item.exact}><i style={{background:item.color}} aria-hidden="true" /><span>{item.label}</span></div>)}
    <small>{legend.note}</small>
  </details>;
}

export default function DemographicsDashboard({data,loading,error,onClose,onPick}:{data:DemographicDataset|null;loading:boolean;error:string;onClose:()=>void;onPick:(row:DemographicRecord)=>void}) {
  const [level,setLevel]=useState<DemographicRecord['level']>('district');
  const [metric,setMetric]=useState<Exclude<DemographicMetric,'none'>>('total');
  const [religion,setReligion]=useState<ReligionKey>('sikh');
  const [ascending,setAscending]=useState(false);
  const [filter,setFilter]=useState('');
  const [selected,setSelected]=useState<DemographicRecord|null>(null);
  const selectedSection=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(selected)selectedSection.current?.scrollIntoView({block:'start',behavior:'smooth'});},[selected]);
  const records=useMemo(()=>{
    const source=level==='city'?data?.cities:data?.rows.filter(row=>row.level===level);
    return [...source||[]].filter(row=>[row.name,row.district,row.division,row.historicalRegion].join(' ').toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>{
      const difference=metricValue(a.hypotheticalDemographics,metric)-metricValue(b.hypotheticalDemographics,metric);
      return (ascending?difference:-difference)||a.id.localeCompare(b.id);
    });
  },[data,level,metric,ascending,filter]);
  function changeMetric(next:typeof metric) {
    setMetric(next);
    const key=next.replace(/Count|Share/,'');
    if (scenario.religions.some(r=>r.key===key)) setReligion(key as ReligionKey);
  }
  return <article className="ua-profile ua-demographics-dashboard" aria-label="Punjab demographics dashboard">
    <button type="button" className="ua-demo-close" onClick={onClose} aria-label="Close demographics dashboard"><X size={14}/></button>
    <div className="ua-profile-heading">
      <span className="ua-kicker">PUNJAB · DEMOGRAPHICS</span><h2>Population & communities</h2>
      <p className="ua-demo-scenario-label">{scenario.title}</p>
      <p>48 districts · 193 tehsils · 12 divisions · 6 historical regions. Amb excluded.</p>
    </div>
    <div className="ua-division-content">
      {loading?<output>Loading the canonical 2026 demographic registry…</output>:error?<p role="alert">{error}</p>:data?<>
        <DemographicSummary value={data.province.hypotheticalDemographics} title={data.title}/>
        <section className="ua-demo-rankings" aria-label="Demographic administrative rankings">
          <h3>Explore & rank</h3>
          <div className="ua-demo-ranking-controls">
            <label>Administrative scope<select aria-label="Demographic ranking scope" value={level} onChange={event=>{setLevel(event.target.value as typeof level);setSelected(null);setFilter('');}}>
              <option value="district">Districts (48)</option><option value="tehsil">Tehsils (193)</option><option value="division">Divisions (12)</option><option value="region">Historical regions (6)</option><option value="city">Defined city estimates (8)</option>
            </select></label>
            <label>Rank by<select aria-label="Demographic ranking metric" value={metric} onChange={event=>changeMetric(event.target.value as typeof metric)}>
              {demographicMetrics.map(m=><option value={m.id} key={m.id}>{m.label}{m.unit==='category'?' (share of largest community)':''}</option>)}
            </select></label>
            <label>Show counts & shares<select aria-label="Ranking religious community" value={religion} onChange={event=>setReligion(event.target.value as ReligionKey)}>{scenario.religions.map(r=><option key={r.key} value={r.key}>{r.name}</option>)}</select></label>
            <label>Find a unit<input aria-label="Filter demographic rankings" value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Name, district, division or region"/></label>
          </div>
          <button type="button" onClick={()=>setAscending(value=>!value)} aria-label="Toggle demographic sort order">{ascending?'Lowest first ↑':'Highest first ↓'}</button>
          <p>{records.length} {level==='city'?'explicitly defined fictional city estimates':level==='region'?'historical regions':level+'s'} · {demographicMetrics.find(m=>m.id===metric)?.label}</p>
          {level==='city' && <p className="ua-data-note">These are explicit illustrative city estimates within the listed tehsils’ urban inventories. City counts are not district totals and are not added to the province. Lahore’s city estimate is 45,00,000; its economy is imagined around universities, technology, healthcare, commerce and tourism.</p>}
          <div className="ua-demo-table-scroll"><table className="ua-demo-ranking-table">
            <thead><tr><th>#</th><th>Unit / parent</th><th>Ranked value<small>{demographicMetrics.find(m=>m.id===metric)?.label}</small></th><th><button type="button" onClick={()=>changeMetric('total')}>Population</button></th><th>{metric==='largest'?'Leading community':scenario.religions.find(r=>r.key===religion)?.name+' count'}</th><th><button type="button" onClick={()=>changeMetric(metric==='largest'?'largest':(religion+'Share') as typeof metric)}>Share %</button></th><th><button type="button" onClick={()=>changeMetric('density')}>Density / km²</button></th><th>Urban %</th></tr></thead>
            <tbody>{records.map((row,i)=>{
              const stats=row.hypotheticalDemographics, community=stats.religions.find(r=>r.key===(metric==='largest'?stats.largestCommunity:religion))!;
              const metadata=demographicMetrics.find(m=>m.id===metric)!;
              const number=metricValue(stats,metric);
              const rankedValue=!Number.isFinite(number)?'—':metadata.unit==='percent'?percent(number,3):metadata.unit==='density'?number.toLocaleString('en-IN',{maximumFractionDigits:2}):metadata.unit==='category'?community.name+' · '+percent(number,3):indianCount(number);
              return <tr key={row.id} aria-selected={selected?.id===row.id}><td>{i+1}</td><td><button type="button" onClick={()=>setSelected(row)}>{row.name}</button><small>{row.level==='city'?'City estimate · '+row.district:row.district||row.historicalRegion||row.division||''}</small></td>
                <td><strong>{rankedValue}</strong></td><td>{indianCount(stats.total)}</td><td>{metric==='largest'&&<small>{community.name}</small>}{indianCount(community.population)}</td><td>{percent(community.percentage,3)}</td><td>{stats.density===null?'—':stats.density.toLocaleString('en-IN',{maximumFractionDigits:2})}</td><td>{percent(stats.urbanPercent,2)}</td></tr>;
            })}</tbody>
          </table></div>
          <button type="button" onClick={()=>saveDemographicCsv(records,`punjab-2026-${level}-demographics.csv`)}><Download size={14}/> Download this demographic table</button>
          {selected && <section ref={selectedSection} className="ua-demo-selected" aria-label="Selected demographic unit"><h3>{selected.name} · {selected.level==='city'?'illustrative city estimate':selected.level}</h3>
            <button type="button" onClick={()=>onPick(selected)}>Show {selected.name} on map</button>
            {selected.basis&&<p>{selected.basis}</p>}{selected.developmentProfile&&<p>{selected.developmentProfile}</p>}<DemographicSummary value={selected.hypotheticalDemographics} title={selected.name+' · fictional 2026'}/>
          </section>}
        </section>
        <details className="ua-demo-method"><summary>Model assumptions & exact reconciliation</summary><p>{data.note}</p><p>{data.model.capacityFormula}</p><p>{data.model.religionMethod}</p><p>{data.model.urbanMethod}</p><p>{data.model.ratingNote}</p><p>{data.model.cityMethod}</p><small>Model version: {data.version}</small></details>
      </>:null}
    </div>
  </article>;
}
