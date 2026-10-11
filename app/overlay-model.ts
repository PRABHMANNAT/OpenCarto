import curatedShrines from './gurdwara-curated-groups.json';
export type OverlaySettings={
 cityMode:'major'|'all';cityAutoColors:boolean;cityColor:string;cityMinPopulation:number;cityLabels:boolean;
 riverColor:string;riverLabels:boolean;riverWidth:number;riverDetail:'major'|'regional'|'tributaries';
 mountains:boolean;plateaus:boolean;forests:boolean;landformLabels:boolean;mountainColor:string;plateauColor:string;forestColor:string;natureOpacity:number;
 gurdwaras:boolean;gurdwaraFilter:'all'|'takht'|'featured'|'special'|'directory-famous'|'directory-historic';gurdwaraLabels:boolean;gurdwaraColor:string;gurdwaraScale:number;
};
export const overlayDefaults:OverlaySettings={cityMode:'major',cityAutoColors:true,cityColor:'#e76b35',cityMinPopulation:100000,cityLabels:true,riverColor:'#148bd1',riverLabels:true,riverWidth:2,riverDetail:'regional',mountains:false,plateaus:false,forests:false,landformLabels:true,mountainColor:'#987e62',plateauColor:'#d4b479',forestColor:'#38845b',natureOpacity:.4,gurdwaras:false,gurdwaraFilter:'all',gurdwaraLabels:true,gurdwaraColor:'#237e94',gurdwaraScale:1};
export function validateOverlaySettings(value:unknown):OverlaySettings{
 const x=value&&typeof value==='object'?value as Partial<OverlaySettings>:{},next={...overlayDefaults};
 for(const key of ['cityAutoColors','cityLabels','riverLabels','gurdwaras','gurdwaraLabels','mountains','plateaus','forests','landformLabels'] as const)if(typeof x[key]==='boolean')next[key]=x[key]!;
 // Before city labels had their own switch, the area-name switch hid them too.
 if(typeof x.cityLabels!=='boolean'&&typeof (x as Partial<OverlaySettings>&{names?:boolean}).names==='boolean')next.cityLabels=(x as Partial<OverlaySettings>&{names?:boolean}).names!;
 for(const key of ['cityColor','riverColor','gurdwaraColor','mountainColor','plateauColor','forestColor'] as const)if(typeof x[key]==='string'&&/^#[0-9a-f]{6}$/i.test(x[key]!))next[key]=x[key]!;
 if(['major','regional','tributaries'].includes(x.riverDetail||''))next.riverDetail=x.riverDetail!;
 if(x.cityMode==='all')next.cityMode='all';
 if(['all','takht','featured','special','directory-famous','directory-historic'].includes(x.gurdwaraFilter||''))next.gurdwaraFilter=x.gurdwaraFilter!;
 for(const [key,min,max] of [['cityMinPopulation',0,5000000],['riverWidth',.5,6],['gurdwaraScale',.6,2],['natureOpacity',.1,.85]] as const)if(Number.isFinite(x[key]))next[key]=Math.max(min,Math.min(max,x[key]!));
 return next;
}
export type CityProperties={id?:string;name?:string;population?:number;capital?:boolean};
export const majorCity=(p:CityProperties,d:OverlaySettings)=>d.cityMode==='all'||!!p.capital||(p.population||0)>=d.cityMinPopulation;
export const cityPaintColor=(p:CityProperties,d:OverlaySettings)=>!d.cityAutoColors?d.cityColor:p.capital?'#ce3e45':(p.population||0)>=1000000?'#e8792f':'#2b9b89';
export const shrineTierAllowed=(tier:string,d:OverlaySettings)=>d.gurdwaraFilter==='all'||d.gurdwaraFilter===tier||d.gurdwaraFilter==='special'&&(tier==='takht'||tier==='featured');
export const shrineAllowed=(site:{id?:unknown;tier?:unknown},d:OverlaySettings)=>d.gurdwaraFilter==='directory-famous'?curatedShrines.top_20_famous.includes(String(site.id)):d.gurdwaraFilter==='directory-historic'?curatedShrines.top_50_important_historic.includes(String(site.id)):shrineTierAllowed(String(site.tier),d);
