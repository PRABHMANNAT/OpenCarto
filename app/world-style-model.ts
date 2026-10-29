import countries from './world-sources.json';
import worldAreas from './world-areas.json';
import type {MapDoc,Paint} from './map-model';
export const worldSchemes=[['custom','Your saved colors'],['colorful','Distinct country colors'],['pastel','Soft country colors'],['white','White countries'],['gray','Light gray countries'],['white-gray','White and gray countries']] as const;
export type WorldColorScheme=typeof worldSchemes[number][0];
export type WorldStyleSettings={worldColorScheme:WorldColorScheme;worldSavedFills:Record<string,Paint>|null;worldSavedLegend:boolean;worldCountryBorder:string;worldProvinceBorder:string;worldInternalBorders:'zoom'|'always'|'hidden'};
export const worldStyleDefaults:WorldStyleSettings={worldColorScheme:'custom',worldSavedFills:null,worldSavedLegend:true,worldCountryBorder:'#000000',worldProvinceBorder:'#9ca3af',worldInternalBorders:'zoom'};
const ids=countries.countries.map(c=>c.id).sort(),worldIds=new Set(worldAreas.map(a=>a.id));
function hsl(h:number,s:number,l:number){s/=100;l/=100;const a=s*Math.min(l,1-l),f=(n:number)=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
function palette(pastel:boolean){const used=new Set<string>();return new Map(ids.map((id,i)=>{let color=hsl(i*137.507764%360,pastel?40+i%4*5:48+i%3*9,pastel?80+i%3*3:65+i%5*3);while(used.has(color))color='#'+((parseInt(color.slice(1),16)+1)%0xffffff).toString(16).padStart(6,'0');used.add(color);return [id,color];}));}
const colorful=palette(false),pastel=palette(true);
export function worldSchemeColor(id:string,scheme:WorldColorScheme){if(scheme==='white')return '#ffffff';if(scheme==='gray')return '#e5e7eb';if(scheme==='white-gray')return ['#ffffff','#e5e7eb','#cbd0d6'][Math.max(0,ids.indexOf(id))%3];return (scheme==='pastel'?pastel:colorful).get(id)||'#e5e7eb';}
export function applyWorldScheme(doc:MapDoc,scheme:WorldColorScheme):Partial<MapDoc>{
 const nonWorld=Object.fromEntries(Object.entries(doc.fills).filter(([id])=>!worldIds.has(id)));
 if(scheme==='custom')return {worldColorScheme:scheme,fills:{...nonWorld,...(doc.worldSavedFills||Object.fromEntries(Object.entries(doc.fills).filter(([id])=>worldIds.has(id))))},legend:doc.worldSavedFills?doc.worldSavedLegend:doc.legend,worldSavedFills:null};
 return {worldColorScheme:scheme,worldSavedFills:doc.worldSavedFills||Object.fromEntries(Object.entries(doc.fills).filter(([id])=>worldIds.has(id))),worldSavedLegend:doc.worldSavedFills?doc.worldSavedLegend:doc.legend,fills:{...nonWorld,...Object.fromEntries(ids.map(id=>[id,{color:worldSchemeColor(id,scheme),pattern:'solid'}]))},legend:false};
}
export function validateWorldStyle(value:Partial<WorldStyleSettings>):WorldStyleSettings{
 const result={...worldStyleDefaults};if(worldSchemes.some(([id])=>id===value.worldColorScheme))result.worldColorScheme=value.worldColorScheme!;
 for(const key of ['worldCountryBorder','worldProvinceBorder'] as const)if(typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key];
 if(['zoom','always','hidden'].includes(value.worldInternalBorders||''))result.worldInternalBorders=value.worldInternalBorders!;
 if(typeof value.worldSavedLegend==='boolean')result.worldSavedLegend=value.worldSavedLegend;
 if(value.worldSavedFills&&typeof value.worldSavedFills==='object'&&!Array.isArray(value.worldSavedFills))result.worldSavedFills=Object.fromEntries(Object.entries(value.worldSavedFills).filter(([id,p])=>worldIds.has(id)&&p&&/^#[0-9a-f]{6}$/i.test(p.color)&&['solid','stripes','dots','cross'].includes(p.pattern)));
 return result;
}
export const worldCountryLine=(d:Pick<MapDoc,'width'|'worldCountryBorder'>)=>({color:d.worldCountryBorder||'#000000',width:Math.max(.8,Math.min(2.4,d.width*1.05))});
export const worldProvinceLine=(d:Pick<MapDoc,'width'|'worldProvinceBorder'>)=>({color:d.worldProvinceBorder||'#9ca3af',width:Math.max(.25,Math.min(1,d.width*.4))});
export const worldInternalVisible=(d:Pick<MapDoc,'worldInternalBorders'>,zoomed:boolean)=>d.worldInternalBorders!=='hidden'&&(d.worldInternalBorders==='always'||zoomed);
