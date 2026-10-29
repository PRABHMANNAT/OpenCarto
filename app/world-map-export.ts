import type {MapAPI} from './map-view';
import {download} from './map-model';

export async function rasterizeWorldSvg(svg:string,width:number,height:number,format:string){
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Equal Earth image could not render.'));image.src=url;});
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas export unavailable.');ctx.fillStyle='white';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
    return canvas.toDataURL(format==='jpg'?'image/jpeg':'image/png',.95);
  }finally{URL.revokeObjectURL(url);}
}
export async function exportEqualEarthMap(api:MapAPI,format:string,width:number,current:boolean,filename="world-countries-first-level-divisions"){
  if(!api.exportWorld)throw Error('The Equal Earth map is still loading. Please try again.');
  const height=Math.round(width*660/1200),svg=await api.exportWorld(width,height,current);
  if(format==='svg'){download(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),filename+'.svg');return;}
  const image=await rasterizeWorldSvg(svg,width,height,format);const response=await fetch(image);download(await response.blob(),filename+'.'+format);
}
