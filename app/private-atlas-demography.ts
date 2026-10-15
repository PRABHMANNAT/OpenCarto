import type {FeatureCollection} from 'geojson';
import scenario from './punjab-demographic-scenario.json';

export type ReligionKey = 'sikh' | 'hindu' | 'muslim' | 'buddhist' | 'christian' | 'other';
export type ScenarioStats = {
  version: string; year: number; total: number; urbanPopulation: number; ruralPopulation: number; urbanPercent: number;
  density: number | null; largestCommunity: ReligionKey; note: string;
  religions: {key: ReligionKey; name: string; population: number; percentage: number; urbanPopulation: number; ruralPopulation: number; color: string}[];
};
export type DemographicRecord = {
  id: string; name: string; level: 'province' | 'region' | 'division' | 'district' | 'tehsil' | 'city';
  district?: string; division?: string; historicalRegion?: string; parentDistrictId?: string;
  areaKm2?: number; bbox?: number[]; coordinates?: number[]; capital?: string;
  hypotheticalDemographics: ScenarioStats; basis?: string; developmentProfile?: string;
};
export type DemographicDataset = {
  version: string; title: string; year: number; province: DemographicRecord; rows: DemographicRecord[]; cities: DemographicRecord[];
  note: string; counts: Record<string, number>;
  model: {capacityFormula: string; religionMethod: string; urbanMethod: string; ratingNote: string; cityMethod: string};
};
export const indianCount = (value: number) => value.toLocaleString('en-IN', {maximumFractionDigits: 0});
export const percent = (value: number, digits = 2) => value.toFixed(digits) + '%';
export function currentDemographics(value: unknown): ScenarioStats | undefined {
  const stats = value as ScenarioStats | undefined;
  return stats?.version === scenario.version && stats.religions?.length === 6 ? stats : undefined;
}
export const demographicMetrics = [
  {id:'total',label:'Total population',unit:'count'}, {id:'density',label:'Population density',unit:'density'},
  {id:'sikhCount',label:'Sikh population',unit:'count'}, {id:'sikhShare',label:'Sikh percentage',unit:'percent'},
  {id:'hinduCount',label:'Hindu population',unit:'count'}, {id:'hinduShare',label:'Hindu percentage',unit:'percent'},
  {id:'muslimCount',label:'Muslim population',unit:'count'}, {id:'muslimShare',label:'Muslim percentage',unit:'percent'},
  {id:'buddhistShare',label:'Buddhist percentage',unit:'percent'}, {id:'christianShare',label:'Christian percentage',unit:'percent'},
  {id:'otherShare',label:'Other religions percentage',unit:'percent'}, {id:'urban',label:'Urbanization percentage',unit:'percent'},
  {id:'largest',label:'Largest religious community',unit:'category'},
] as const;
export type DemographicMetric = 'none' | typeof demographicMetrics[number]['id'];
export function metricValue(stats: ScenarioStats, metric: DemographicMetric): number {
  if (metric === 'total') return stats.total;
  if (metric === 'density') return stats.density ?? NaN;
  if (metric === 'urban') return stats.urbanPercent;
  if (metric === 'largest') return stats.religions.find(r => r.key === stats.largestCommunity)?.percentage ?? 0;
  const key = metric.replace(/Count|Share/, '');
  const religion = stats.religions.find(r => r.key === key);
  return religion ? metric.endsWith('Count') ? religion.population : religion.percentage : NaN;
}
export type ChoroplethLegend = {title: string; note: string; items: {color: string; label: string; exact?: string}[]};
export function demographicChoropleth(collection: FeatureCollection, metric: DemographicMetric): {collection: FeatureCollection; legend?: ChoroplethLegend} {
  if (metric === 'none') return {collection};
  const meta = demographicMetrics.find(m => m.id === metric)!;
  const eligible = collection.features.map(f => currentDemographics(f.properties?.hypotheticalDemographics)).filter((s): s is ScenarioStats => !!s);
  const values = eligible.map(s => metricValue(s, metric)).filter(Number.isFinite).sort((a,b) => a-b);
  const cuts = [...new Set([1,2,3,4].map(i => values[Math.max(0,Math.ceil(values.length*i/5)-1)]).filter(Number.isFinite))];
  const colors = ['#E5EFF8','#B9D3E9','#80ADD1','#467EAD','#164C78'];
  const palette = Array.from({length:cuts.length+1},(_,i)=>colors[Math.round(i*4/Math.max(1,cuts.length))]);
  const format = (value: number) => meta.unit === 'count' ? indianCount(value) : meta.unit === 'percent' ? percent(value,4) : value.toLocaleString('en-IN',{maximumFractionDigits:2}) + ' / km²';
  const legend: ChoroplethLegend = {
    title:meta.label,
    note:meta.unit === 'category' ? 'Largest community by exact count · fictional 2026' : 'Current visible Punjab units · quantile cuts shown rounded · fictional 2026',
    items:meta.unit === 'category' ? scenario.religions.map(r=>({color:r.color,label:r.name})) : values.length ? palette.map((color,i)=>({color,
      label:i === 0 ? '≤ ' + format(cuts[0] ?? values.at(-1)!) : i === cuts.length ? '> ' + format(cuts[i-1]) : '> ' + format(cuts[i-1]) + ' to ≤ ' + format(cuts[i]),
      exact:JSON.stringify({greaterThan:i?cuts[i-1]:null,lessOrEqual:i<cuts.length?cuts[i]:null}),
    })) : [{color:'#DCE2E6',label:'No compatible scenario data'}],
  };
  return {legend,collection:{...collection,features:collection.features.map(f=>{
    const stats=currentDemographics(f.properties?.hypotheticalDemographics);
    if (!stats) return f;
    const value=metricValue(stats,metric);
    const color=metric === 'largest' ? scenario.religions.find(r=>r.key===stats.largestCommunity)!.color : Number.isFinite(value) ? palette[cuts.findIndex(cut=>value<=cut) === -1 ? cuts.length : cuts.findIndex(cut=>value<=cut)] : '#DCE2E6';
    return {...f,properties:{...f.properties,color,demographicMetric:metric,demographicValue:metric==='largest'?stats.largestCommunity:value}};
  })}};
}
export function demographicCsv(records: DemographicRecord[]): string {
  const fields=['ID','Name','Level','District','Division','Historical region','Total','Urban','Rural','Urbanization percent','Density per km2',...scenario.religions.flatMap(r=>[r.name+' count',r.name+' percent'])];
  const rows:(string|number)[][]=[fields,...records.map(row=>{
    const s=row.hypotheticalDemographics;
    return [row.id,row.name,row.level,row.district||'',row.division||'',row.historicalRegion||'',s.total,s.urbanPopulation,s.ruralPopulation,s.urbanPercent,s.density??'',
      ...scenario.religions.flatMap(religion=>{const r=s.religions.find(r=>r.key===religion.key)!;return[r.population,r.percentage];})];
  })];
  return '\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
export function saveDemographicCsv(records: DemographicRecord[], filename: string) {
  const url=URL.createObjectURL(new Blob([demographicCsv(records)],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
