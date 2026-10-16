import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {decodeAtlas} from '../server/atlas-store.mjs';

if(process.argv.includes('--runtime-child')){
  const root=process.argv.at(-1);process.chdir(root);
  const {privateAtlasHandler}=await import(pathToFileURL(join(root,'server/private-atlas.mjs')));
  const server=createServer(privateAtlasHandler);await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base='http://127.0.0.1:'+server.address().port+'/api/private-atlas?action=';
  let peak=process.memoryUsage().rss;
  const call=async(action,status=200,options={})=>{
    const response=await fetch(base+action,options),body=await response.json();
    assert.equal(response.status,status,action);peak=Math.max(peak,process.memoryUsage().rss);return body;
  };
  try{
    const start=performance.now(),overview=await call('overview'),coldMs=Math.round(performance.now()-start);
    assert.equal(overview.provinces.length,43);
    for(const province of overview.provinces)await call('detail&province='+province.id+'&level=province');
    let offset=0,total=0;
    do{const page=await call('detail&province=punjab&level=tehsil&offset='+offset);total+=page.features.length;offset=page.next;}while(offset!==null);
    assert.equal(total,193);
    const unaligned=await call('detail&province=punjab&level=tehsil&offset=19');assert.equal(unaligned.features.length,20);assert.equal(unaligned.next,39);
    assert.equal((await call('detail&province=punjab&level=tehsil&offset=99999')).features.length,0);
    const demo=await call('demographics');assert.equal(demo.province.hypotheticalDemographics.total,67536450);
    assert.ok((await call('search&q=Khado%20Khel')).length);
    await call('detail&province=../secrets&level=tehsil',400);
    await call('detail&province=punjab&level=tehsil&offset=-1',400);
    await call('overview',403,{headers:{Origin:'https://unrelated.example'}});
    await call('overview',405,{method:'POST'});
    const key=process.env.PRIVATE_ATLAS_DATA_KEY;delete process.env.PRIVATE_ATLAS_DATA_KEY;
    assert.equal((await call('overview',503)).code,'ATLAS_CONFIGURATION_MISSING');process.env.PRIVATE_ATLAS_DATA_KEY=key;
    await assert.rejects(fs.access('server/private-atlas.enc'));
    assert.ok(peak<512*1024*1024,'Runtime RSS remains below 512 MiB');
    console.log(JSON.stringify({productionWithoutArchive:true,heapLimitMiB:128,peakRssMiB:Math.round(peak/1048576),coldOverviewMs:coldMs,provinces:43,tehsils:193,demographicTotal:67536450,unalignedPagination:true,originAndMethodChecks:true}));
  }finally{server.closeAllConnections();await new Promise(done=>server.close(done));}
}else{
  process.loadEnvFile('.env.local');
  const key=process.env.PRIVATE_ATLAS_DATA_KEY;
  const archive=decodeAtlas(await fs.readFile('server/private-atlas.enc'),key);
  const dir='server/atlas-runtime',index=JSON.parse(await fs.readFile(dir+'/index.json','utf8'));
  for(const [name,entry] of Object.entries(index.sections))assert.deepEqual(decodeAtlas(await fs.readFile(dir+'/'+entry.file),key),archive[name],name);
  let pages=0;
  for(const [id,levels] of Object.entries(index.details))for(const [level,record] of Object.entries(levels)){
    const {features,...metadata}=archive.details[id][level];assert.deepEqual(record.metadata,metadata);assert.equal(record.total,features.length);
    for(const [offset,entry] of Object.entries(record.pages)){assert.deepEqual(decodeAtlas(await fs.readFile(dir+'/'+entry.file),key),features.slice(Number(offset),Number(offset)+20),id+'/'+level+'/'+offset);pages++;}
  }
  console.log('Lossless comparison passed for every atlas section and all '+pages+' detail pages.');
  const root=await fs.mkdtemp(join(tmpdir(),'atlas-paged-runtime-'));
  try{
    await fs.mkdir(join(root,'server'));
    for(const file of ['private-atlas.mjs','atlas-store.mjs'])await fs.copyFile('server/'+file,join(root,'server',file));
    await fs.cp(dir,join(root,'server/atlas-runtime'),{recursive:true});
    const result=await promisify(execFile)(process.execPath,['--max-old-space-size=128',resolve(process.argv[1]),'--runtime-child',root],{env:{...process.env,VERCEL:'1'},maxBuffer:1024*1024});
    console.log(result.stdout.trim());
  }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\')||resolve(root).startsWith(resolve(tmpdir())+'/'));await fs.rm(root,{recursive:true,force:true});}
}
