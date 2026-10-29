import countries from './world-sources.json';
import {scenarioAddedAreas,scenarioAddedIds} from './india-punjab-scenario';
import neighborData from './world-country-neighbors.json';
import worldAreas from './world-areas.json';
import type {MapDoc,Paint} from './map-model';
export const worldSchemes=[['custom','Your saved colors'],['colorful','Default political'],['muted','Muted'],['pastel','Pastel'],['marine','Marine'],['royal','Royal'],['modern','Modern'],['earth','Earth tones'],['white','White countries'],['gray','Light gray countries'],['white-gray','White and gray countries']] as const;
export type WorldColorScheme=typeof worldSchemes[number][0];
export type WorldStyleSettings={worldPaletteVersion:number;worldColorScheme:WorldColorScheme;worldSavedFills:Record<string,Paint>|null;worldSavedLegend:boolean;worldCountryBorder:string;worldProvinceBorder:string;worldInternalBorders:'zoom'|'always'|'hidden'};
export const worldStyleDefaults:WorldStyleSettings={worldPaletteVersion:2,worldColorScheme:'custom',worldSavedFills:null,worldSavedLegend:true,worldCountryBorder:'#000000',worldProvinceBorder:'#9ca3af',worldInternalBorders:'zoom'};
const baseIds=countries.countries.map(c=>c.id).sort(),extraCountries=scenarioAddedAreas.filter(a=>a.level==='region').map(a=>a.id),ids=[...baseIds,...extraCountries],worldIds=new Set([...worldAreas.map(a=>a.id),...scenarioAddedIds]);
function hsl(h:number,s:number,l:number){s/=100;l/=100;const a=s*Math.min(l,1-l),f=(n:number)=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
function palette(pastel:boolean){const used=new Set<string>();return new Map(ids.map((id,i)=>{let color=hsl(i*137.507764%360,pastel?40+i%4*5:48+i%3*9,pastel?80+i%3*3:65+i%5*3);while(used.has(color))color='#'+((parseInt(color.slice(1),16)+1)%0xffffff).toString(16).padStart(6,'0');used.add(color);return [id,color];}));}
const legacyColorful=palette(false),legacyPastel=palette(true);
export const worldThemePalettes:Record<string,string[]>={
 colorful:['#AFC7B1','#A9C7DD','#E5B48F','#C4AED2','#D8A6AD','#C2C58F','#93C2BE','#DCC89F','#ABB6D7','#9EBA9A','#E8C3AA','#D7C5E2','#E3BDC3','#E5D792','#B7D8C5','#CFA68C'],
 muted:['#B5C1AF','#B1C1CB','#CDBBA2','#BDB0C3','#C7ADB2','#BBC0A1','#A0BEB9','#D2C9B1','#AAB4C8','#BECAA9','#D0B9AD','#CBC1D0'],
 pastel:['#C7DDC8','#C7DFED','#F1D1B5','#DDCBE8','#E9C9CE','#D6DAB4','#BBDDD7','#EADFC1','#D0D7EC','#E8D3C6','#D5E4C1','#E7D8ED'],
 marine:['#A3C9D9','#B6D5CE','#D6DCC1','#9DB4C9','#C6DEE2','#B4C4DD','#8FBDB8','#DCCDAE','#9AB2B5','#CAD6C4','#D0CFDF','#C3DADB'],
 royal:['#C2AED1','#A6BCD6','#D4C4B0','#B1C7BF','#D8B8CB','#BBC0DD','#D7C7DE','#9FAEC5','#CBB4B8','#BCC9D1','#D5D3B6','#B4ADCD'],
 modern:['#9BC9C3','#A6C5DC','#DDC18D','#C1A7CB','#DCAAA5','#B8C88E','#95B4C7','#C9BBA2','#A7C8A9','#C9B7D7','#DFBEA9','#ADC0D1'],
 earth:['#CDBB9E','#C2C7AA','#B1BC9F','#D9C4AC','#B7BCB3','#C7B0A2','#D4CDB5','#A9BBAA','#D1B5AD','#BDC7B9','#C7BFAF','#DDD3BC'],
};
const countryNeighbors:Record<string,string[]>={...neighborData,'world-c-balochistan':['world-c-ind','world-c-pak','world-c-irn','world-c-afg'],'world-c-tibet':['world-c-chn','world-c-ind','world-c-npl','world-c-btn','world-c-mmr']};
const rgb=(hex:string)=>[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16));
const distance=(a:string,b:string)=>rgb(a).reduce((sum,v,i)=>sum+(v-rgb(b)[i])**2,0);
const coordinated=new Map<string,Map<string,string>>();
function coordinatedPalette(theme:string){
 const cached=coordinated.get(theme);if(cached)return cached;
 const bases=worldThemePalettes[theme]||worldThemePalettes.colorful,assigned=new Map<string,number>(),uses=bases.map(()=>0),remaining=new Set(ids);
 while(remaining.size){
  const id=[...remaining].sort((a,b)=>Number(extraCountries.includes(a))-Number(extraCountries.includes(b))||(extraCountries.includes(a)&&extraCountries.includes(b)?extraCountries.indexOf(a)-extraCountries.indexOf(b):0)||new Set((countryNeighbors[b]||[]).flatMap(n=>assigned.has(n)?[assigned.get(n)]:[])).size-new Set((countryNeighbors[a]||[]).flatMap(n=>assigned.has(n)?[assigned.get(n)]:[])).size||(countryNeighbors[b]?.length||0)-(countryNeighbors[a]?.length||0)||a.localeCompare(b))[0];
  const neighbors=(countryNeighbors[id]||[]).flatMap(n=>assigned.has(n)?[assigned.get(n)!]:[]);let best=0,score=-Infinity;
  for(let i=0;i<bases.length;i++){const contrast=neighbors.length?Math.min(...neighbors.map(n=>distance(bases[i],bases[n]))):100000;const candidate=contrast-uses[i]*200-((i-ids.indexOf(id)*7)%bases.length+bases.length)%bases.length;if(candidate>score){score=candidate;best=i;}}
  assigned.set(id,best);uses[best]++;remaining.delete(id);
 }
 const counts=bases.map(()=>0),used=new Set<string>(),result=new Map<string,string>();
 for(const id of ids){const base=assigned.get(id)!,index=counts[base]++,amount=index===0?0:Math.min(.1,Math.ceil(index/2)*.015)*(index%2?1:-1);let value=rgb(bases[base]).map(v=>Math.round(amount>=0?v+(255-v)*amount:v*(1+amount)));let color='#'+value.map(v=>v.toString(16).padStart(2,'0')).join('');while(used.has(color)){value=[value[0],value[1],(value[2]+1)%256];color='#'+value.map(v=>v.toString(16).padStart(2,'0')).join('');}used.add(color);result.set(id,color);}
 coordinated.set(theme,result);return result;
}
export function worldPaletteSwatches(scheme:WorldColorScheme){return worldThemePalettes[scheme]|| (scheme==='white'?['#ffffff']:scheme==='gray'?['#e5e7eb']:['#ffffff','#e5e7eb','#cbd0d6']);}
export function worldSchemeColor(id:string,scheme:WorldColorScheme){if(scheme==='white')return '#ffffff';if(scheme==='gray')return '#e5e7eb';if(scheme==='white-gray')return ['#ffffff','#e5e7eb','#cbd0d6'][Math.max(0,ids.indexOf(id))%3];return coordinatedPalette(scheme).get(id)||'#e5e7eb';}
export function upgradeWorldScheme(doc:MapDoc,version?:number){
 if((version||0)>=2||!doc.worldSavedFills||!['colorful','pastel'].includes(doc.worldColorScheme))return doc.fills;
 const legacy=doc.worldColorScheme==='pastel'?legacyPastel:legacyColorful;
 return Object.fromEntries(Object.entries(doc.fills).map(([id,p])=>[id,legacy.get(id)?.toLowerCase()===p.color.toLowerCase()&&p.pattern==='solid'?{...p,color:worldSchemeColor(id,doc.worldColorScheme)}:p]));
}
export function applyWorldScheme(doc:MapDoc,scheme:WorldColorScheme):Partial<MapDoc>{
 const nonWorld=Object.fromEntries(Object.entries(doc.fills).filter(([id])=>!worldIds.has(id)));
 if(scheme==='custom')return {worldPaletteVersion:2,worldColorScheme:scheme,fills:{...nonWorld,...(doc.worldSavedFills||Object.fromEntries(Object.entries(doc.fills).filter(([id])=>worldIds.has(id))))},legend:doc.worldSavedFills?doc.worldSavedLegend:doc.legend,worldSavedFills:null};
 return {worldPaletteVersion:2,worldColorScheme:scheme,worldSavedFills:doc.worldSavedFills||Object.fromEntries(Object.entries(doc.fills).filter(([id])=>worldIds.has(id))),worldSavedLegend:doc.worldSavedFills?doc.worldSavedLegend:doc.legend,fills:{...nonWorld,...Object.fromEntries(ids.filter(id=>doc.indiaPunjabScenario||!extraCountries.includes(id)).map(id=>[id,{color:worldSchemeColor(id,scheme),pattern:'solid'}]))},legend:false};
}
export function validateWorldStyle(value:Partial<WorldStyleSettings>):WorldStyleSettings{
 const result={...worldStyleDefaults};if(worldSchemes.some(([id])=>id===value.worldColorScheme))result.worldColorScheme=value.worldColorScheme!;
 for(const key of ['worldCountryBorder','worldProvinceBorder'] as const)if(typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key];
 if(['zoom','always','hidden'].includes(value.worldInternalBorders||''))result.worldInternalBorders=value.worldInternalBorders!;
 if(typeof value.worldSavedLegend==='boolean')result.worldSavedLegend=value.worldSavedLegend;
 if(value.worldSavedFills&&typeof value.worldSavedFills==='object'&&!Array.isArray(value.worldSavedFills))result.worldSavedFills=Object.fromEntries(Object.entries(value.worldSavedFills).filter(([id,p])=>worldIds.has(id)&&p&&/^#[0-9a-f]{6}$/i.test(p.color)&&['solid','stripes','dots','cross'].includes(p.pattern)));
 return result;
}
export const worldCountryLine=(d:Pick<MapDoc,'width'|'worldCountryBorder'>)=>({color:d.worldCountryBorder||'#000000',width:Math.max(.5,Math.min(1.8,d.width*.8))});
export const worldProvinceLine=(d:Pick<MapDoc,'width'|'worldProvinceBorder'>)=>({color:d.worldProvinceBorder||'#9ca3af',width:Math.max(.2,Math.min(.8,d.width*.32))});
export const worldInternalVisible=(d:Pick<MapDoc,'worldInternalBorders'>,zoomed:boolean)=>d.worldInternalBorders!=='hidden'&&(d.worldInternalBorders==='always'||zoomed);
