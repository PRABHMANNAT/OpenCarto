import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
const cwd=process.cwd(),root=await fs.mkdtemp(path.resolve('work/alternate-world-deployment-')),original=process.env.ALTERNATE_WORLD_SESSION_KEY;
try{
 await fs.mkdir(path.join(root,'api'));await fs.mkdir(path.join(root,'server'));
 await fs.copyFile(path.resolve('server/alternate-world.mjs'),path.join(root,'api/alternate-world.mjs'));
 const fixture={type:'FeatureCollection',features:[]};await fs.writeFile(path.join(root,'server/alternate-world-overrides.geojson'),JSON.stringify(fixture));
 process.env.ALTERNATE_WORLD_SESSION_KEY=randomBytes(32).toString('hex');process.chdir(root);
 const {alternateWorldHandler}=await import(pathToFileURL(path.join(root,'api/alternate-world.mjs')));
 async function call(method,cookie=''){const req={method,headers:{host:'atlas.test',cookie},body:{password:'4688'}};const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};await alternateWorldHandler(req,res);return res;}
 const unlock=await call('POST');assert.equal(unlock.statusCode,200);const data=await call('GET',unlock.headers['Set-Cookie'].split(';')[0]);assert.equal(data.statusCode,200);assert.deepEqual(data.body,fixture);
 delete process.env.ALTERNATE_WORLD_SESSION_KEY;const originalAtlas=process.env.PRIVATE_ATLAS_DATA_KEY;delete process.env.PRIVATE_ATLAS_DATA_KEY;
 try{assert.equal((await call('GET')).statusCode,503);}finally{if(originalAtlas!==undefined)process.env.PRIVATE_ATLAS_DATA_KEY=originalAtlas;}
 console.log('Verified flattened deployment handler locates protected server file from deployment root and handles missing configuration safely.');
}finally{
 process.chdir(cwd);if(original===undefined)delete process.env.ALTERNATE_WORLD_SESSION_KEY;else process.env.ALTERNATE_WORLD_SESSION_KEY=original;
 await fs.unlink(path.join(root,'api/alternate-world.mjs'));await fs.unlink(path.join(root,'server/alternate-world-overrides.geojson'));await fs.rmdir(path.join(root,'api'));await fs.rmdir(path.join(root,'server'));await fs.rmdir(root);
}
