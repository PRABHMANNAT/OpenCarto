import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes,createHmac} from 'node:crypto';
import {alternateWorldHandler} from '../server/alternate-world.mjs';
const original=process.env.ALTERNATE_WORLD_SESSION_KEY,secret=randomBytes(32).toString('hex');process.env.ALTERNATE_WORLD_SESSION_KEY=secret;
async function call(method='GET',{body,cookie='',origin='https://atlas.test',ip='unit'}={}){
 const req=Readable.from(body===undefined?[]:[typeof body==='string'?body:JSON.stringify(body)]);req.method=method;req.headers={host:'atlas.test',origin,cookie,'x-forwarded-proto':'https','x-forwarded-for':ip};req.socket={remoteAddress:'127.0.0.1'};
 const res={headers:{},statusCode:200,setHeader(key,value){this.headers[key.toLowerCase()]=value;},end(text){this.body=text;}};await alternateWorldHandler(req,res);return res;
}
try{
 assert.equal((await call()).statusCode,401,'No boundaries before authentication');
 const wrong=await call('POST',{body:{password:'0000'}});assert.equal(wrong.statusCode,401);assert.equal(wrong.headers['set-cookie'],undefined);
 assert.equal((await call('POST',{body:{password:'4688'},origin:'https://other.test'})).statusCode,403);
 assert.equal((await call('POST',{body:'x'.repeat(600)})).statusCode,400);
 const unlock=await call('POST',{body:{password:'4688'}});assert.equal(unlock.statusCode,200);
 assert.match(unlock.headers['set-cookie'],/HttpOnly; SameSite=Strict; Path=\/api\/alternate-world/);assert.match(unlock.headers['set-cookie'],/Secure/);
 const cookie=unlock.headers['set-cookie'].split(';')[0];
 const permitted=await call('GET',{cookie});assert.equal(permitted.statusCode,200);assert.equal(JSON.parse(permitted.body).type,'FeatureCollection');assert.match(permitted.headers['cache-control'],/no-store/);
 assert.equal((await call('GET',{cookie:cookie+'x'})).statusCode,401,'Tampered cookie rejected');
 const expired=(Date.now()-1000)+'.'+randomBytes(16).toString('hex');const signed=createHmac('sha256',secret).update('alternate-world-v1|'+expired).digest('hex');
 assert.equal((await call('GET',{cookie:'alternate_world_access='+expired+'.'+signed})).statusCode,401,'Expired signed cookie rejected');
 assert.equal((await call('PUT')).statusCode,405);
 const lock=await call('DELETE',{cookie});assert.match(lock.headers['set-cookie'],/Max-Age=0/);assert.equal((await call()).statusCode,401);
 for(let n=0;n<10;n++)assert.equal((await call('POST',{body:{password:'bad'},ip:'throttle'})).statusCode,401);
 assert.equal((await call('POST',{body:{password:'4688'},ip:'throttle'})).statusCode,429);
 console.log('Verified server-only access, incorrect/correct password, no-store protected geometry, origin checks, payload limit, HttpOnly secure signed session, tamper/expiry rejection, logout and throttling.');
}finally{if(original===undefined)delete process.env.ALTERNATE_WORLD_SESSION_KEY;else process.env.ALTERNATE_WORLD_SESSION_KEY=original;}
