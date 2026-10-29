import data from './india-punjab-scenario.json';
import type {Area,MapDoc} from './map-model';
export const tibetRepublic=data.tibet;
export type TibetSettings={tibetView:'administrative'|'cultural';tibetCities:boolean;tibetMountains:boolean;tibetReferences:boolean};
export const tibetDefaults:TibetSettings={tibetView:'administrative',tibetCities:true,tibetMountains:true,tibetReferences:false};
export function validateTibetSettings(value:Partial<TibetSettings>):TibetSettings{const result={...tibetDefaults};if(value.tibetView==='cultural')result.tibetView='cultural';for(const key of ['tibetCities','tibetMountains','tibetReferences'] as const)if(typeof value[key]==='boolean')result[key]=value[key]!;return result;}
export function tibetCulturalColor(area:Area,doc:MapDoc){if(!doc.indiaPunjabScenario||doc.tibetView!=='cultural'||doc.fills[area.id])return;return tibetRepublic.regions.find(region=>region.memberIds.includes(area.id))?.color;}
export const tibetAreaLabel=(m2:number)=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2}).format(m2/1e6)+' km²';
