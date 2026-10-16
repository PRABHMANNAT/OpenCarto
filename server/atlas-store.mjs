import {createDecipheriv} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function decodeAtlas(encoded,key) {
  if(encoded.subarray(0,4).toString()!=='UAT1')throw Error('Invalid custom atlas dataset');
  const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),encoded.subarray(4,16));
  decipher.setAuthTag(encoded.subarray(16,32));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(encoded.subarray(32)),decipher.final()])).toString('utf8'));
}
let indexPromise,legacyPromise,cacheKey;
const cache=new Map();let cachedBytes=0;
const maxCacheBytes=8*1024*1024;
async function readLocated(relative,adjacent) {
  try{return {bytes:await readFile(resolve(process.cwd(),relative)),path:resolve(process.cwd(),relative)};}
  catch(error){if(error.code!=='ENOENT')throw error;return {bytes:await readFile(adjacent),path:adjacent};}
}
async function runtimeIndex() {
  if(!indexPromise)indexPromise=(async()=>{
    try {
      const file=await readLocated('server/atlas-runtime/index.json',fileURLToPath(new URL('./atlas-runtime/index.json',import.meta.url)));
      const index=JSON.parse(file.bytes.toString('utf8'));
      if(index.version!==1||!index.sections||!index.details)throw Error('Invalid atlas runtime index');
      return {index,directory:dirname(file.path)};
    }catch(error){
      // Old local fixtures can still use the editorial archive. Production
      // must never fall back to its 238 MB JSON cold-start allocation.
      if(error.code!=='ENOENT'||process.env.VERCEL)throw error;
      return null;
    }
  })().catch(error=>{indexPromise=undefined;throw error;});
  return indexPromise;
}
async function legacy(key) {
  if(!legacyPromise)legacyPromise=readLocated('server/private-atlas.enc',fileURLToPath(new URL('./private-atlas.enc',import.meta.url)))
    .then(file=>decodeAtlas(file.bytes,key)).catch(error=>{legacyPromise=undefined;throw error;});
  return legacyPromise;
}
async function shard(store,entry,key) {
  if(!entry)return undefined;
  if(!/^[a-f0-9]{64}\.enc$/.test(entry.file)||!Number.isSafeInteger(entry.jsonBytes)||entry.jsonBytes<0)throw Error('Invalid atlas section reference');
  const cached=cache.get(entry.file);
  if(cached){cache.delete(entry.file);cache.set(entry.file,cached);return cached.promise;}
  const promise=readFile(resolve(store.directory,entry.file)).then(bytes=>decodeAtlas(bytes,key));
  // Cache only completed values, keeping simultaneous reads and failures from
  // pinning an unbounded set of parsed geometries in a warm function.
  const value=await promise;
  if(entry.jsonBytes<=maxCacheBytes){
    const existing=cache.get(entry.file);if(existing)cachedBytes-=existing.bytes;
    cache.delete(entry.file);cache.set(entry.file,{promise:Promise.resolve(value),bytes:entry.jsonBytes});cachedBytes+=entry.jsonBytes;
    while(cachedBytes>maxCacheBytes){const [name,item]=cache.entries().next().value;cache.delete(name);cachedBytes-=item.bytes;}
  }
  return value;
}
export async function atlasStore(key) {
  if(cacheKey!==key){cacheKey=key;cache.clear();cachedBytes=0;legacyPromise=undefined;}
  const store=await runtimeIndex();
  if(!store){
    const data=await legacy(key);
    return {hasProvince:id=>Object.hasOwn(data.details||{},id),section:async name=>data[name],detail:async(id,level,offset)=>{
      const collection=data.details[id][level]||{type:'FeatureCollection',features:[]};
      return {...collection,features:collection.features.slice(offset,offset+20),next:offset+20<collection.features.length?offset+20:null,total:collection.features.length};
    }};
  }
  return {hasProvince:id=>Object.hasOwn(store.index.details,id),section:name=>shard(store,store.index.sections[name],key),detail:async(id,level,offset)=>{
    const record=store.index.details[id][level]||{metadata:{type:'FeatureCollection'},total:0,pages:{}};
    const start=Math.floor(offset/20)*20;
    const first=offset<record.total?await shard(store,record.pages[start],key):[];
    const next=offset%20&&start+20<record.total?await shard(store,record.pages[start+20],key):[];
    return {...record.metadata,features:[...first,...next].slice(offset%20,offset%20+20),next:offset+20<record.total?offset+20:null,total:record.total};
  }};
}
