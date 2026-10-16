import assert from 'node:assert/strict';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {decodeAtlas} from '../server/atlas-store.mjs';

export async function buildAtlasShards({source='server/private-atlas.enc',directory='server/atlas-runtime',key,payload,check=false}={}) {
  const sourceBytes=await fs.readFile(source),sourceSha256=createHash('sha256').update(sourceBytes).digest('hex');
  if(check){
    const index=JSON.parse(await fs.readFile(resolve(directory,'index.json'),'utf8'));
    assert.equal(index.version,1);assert.equal(index.sourceSha256,sourceSha256,'Atlas sections are stale. Run npm run data:atlas-runtime after repacking.');
    const entries=[...Object.values(index.sections),...Object.values(index.details).flatMap(levels=>Object.values(levels).flatMap(record=>Object.values(record.pages)))];
    for(const entry of entries)assert.equal((await fs.stat(resolve(directory,entry.file))).size,entry.encryptedBytes,'Missing or truncated atlas section');
    console.log('Verified '+entries.length+' encrypted atlas sections match the editorial archive.');return index;
  }
  if(!key||!/^[a-f0-9]{64}$/i.test(key))throw Error('The existing PRIVATE_ATLAS_DATA_KEY is required to generate atlas sections.');
  const data=payload||decodeAtlas(sourceBytes,key);
  await fs.mkdir(directory,{recursive:true});
  const index={version:1,sourceSha256,sections:{},details:{}};
  const write=async(name,value)=>{
    const file=createHash('sha256').update(name).digest('hex')+'.enc';
    const json=Buffer.from(JSON.stringify(value)),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
    const encrypted=Buffer.concat([cipher.update(gzipSync(json)),cipher.final()]);
    const bytes=Buffer.concat([Buffer.from('UAT1'),iv,cipher.getAuthTag(),encrypted]);
    await fs.writeFile(resolve(directory,file),bytes);
    return {file,jsonBytes:json.length,encryptedBytes:bytes.length};
  };
  for(const [name,value] of Object.entries(data))if(name!=='details')index.sections[name]=await write(name,value);
  for(const [id,levels] of Object.entries(data.details||{})){
    index.details[id]={};
    for(const [level,collection] of Object.entries(levels)){
      const {features,...metadata}=collection,record={metadata,total:features.length,pages:{}};
      for(let offset=0;offset<features.length;offset+=20)record.pages[offset]=await write('detail/'+id+'/'+level+'/'+offset,features.slice(offset,offset+20));
      index.details[id][level]=record;
    }
  }
  // Publish the index last so readers cannot observe a partial generation.
  await fs.writeFile(resolve(directory,'index.json'),JSON.stringify(index));
  const names=new Set([...Object.values(index.sections),...Object.values(index.details).flatMap(levels=>Object.values(levels).flatMap(r=>Object.values(r.pages)))].map(e=>e.file));
  for(const file of await fs.readdir(directory))if(/^[a-f0-9]{64}\.enc$/.test(file)&&!names.has(file))await fs.unlink(resolve(directory,file));
  console.log('Prepared '+names.size+' independently encrypted atlas sections; original geography and archive retained.');return index;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv.includes('--check')){try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}}
  await buildAtlasShards({key:process.env.PRIVATE_ATLAS_DATA_KEY,check:process.argv.includes('--check')});
}
