import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Only the server receives the requested access code or its verifier.
const passwordHash=Buffer.from('cea10c90eee9f29280e698a1a2c4a70831fee2881d425c883de61d5b6e72e823','hex');
const cookieName='alternate_world_access',duration=2*60*60*1000;
const failures=new Map();
const boundaries=new Map();
async function readBoundaries(part){const name=part==='tibet'?'alternate-world-tibet.geojson':'alternate-world-overrides.geojson';try{return await readFile(resolve(process.cwd(),'server',name),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;return readFile(new URL('./'+name,import.meta.url),'utf8');}}
function respond(res,status,value){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));}
function key(){const value=process.env.ALTERNATE_WORLD_SESSION_KEY||process.env.PRIVATE_ATLAS_DATA_KEY;if(!value||value.length<32)throw Error('Alternate map access is not configured.');return value;}
function signature(value,secret){return createHmac('sha256',secret).update('alternate-world-v1|'+value).digest('hex');}
function authenticated(req,secret){
 const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
 const match=/^(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);if(!match)return false;
 const expires=Number(match[1]);if(expires<=Date.now()||expires>Date.now()+duration+60000)return false;
 return timingSafeEqual(Buffer.from(match[3],'hex'),Buffer.from(signature(match[1]+'.'+match[2],secret),'hex'));
}
function cookie(req,value,age){const secure=req.headers['x-forwarded-proto']==='https'||req.socket?.encrypted;return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/api/alternate-world; Max-Age=${age}${secure?'; Secure':''}`;}
async function body(req){
 if(req.body!==undefined){const text=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(text)>512)throw Error('Invalid request.');return JSON.parse(text);}
 let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>512)throw Error('Invalid request.');}return JSON.parse(text||'{}');
}
export async function alternateWorldHandler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Cookie');
 try{
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return respond(res,403,{error:'Open this map from the application.'});
  const secret=key();
  if(req.method==='DELETE'){res.setHeader('Set-Cookie',cookie(req,'',0));return respond(res,200,{ok:true});}
  if(req.method==='POST'){
   const ip=req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket?.remoteAddress||'local',now=Date.now();
   for(const [id,row] of failures)if(row.until<now)failures.delete(id);
   if(failures.size>5000)failures.clear();
   const row=failures.get(ip);if(row&&row.count>=10){res.setHeader('Retry-After',String(Math.ceil((row.until-now)/1000)));return respond(res,429,{error:'Too many attempts. Please try again in a few minutes.'});}
   let value;try{value=await body(req);}catch{return respond(res,400,{error:'Enter the map password.'});}
   const supplied=createHash('sha256').update(typeof value.password==='string'?value.password:'').digest();
   if(!timingSafeEqual(supplied,passwordHash)){failures.set(ip,{count:(row?.count||0)+1,until:row?.until||now+10*60*1000});return respond(res,401,{error:'Incorrect password. Please try again.'});}
   failures.delete(ip);const payload=(now+duration)+'.'+randomBytes(16).toString('hex');res.setHeader('Set-Cookie',cookie(req,payload+'.'+signature(payload,secret),duration/1000));return respond(res,200,{ok:true});
  }
  if(req.method!=='GET'){res.setHeader('Allow','GET, POST, DELETE');return respond(res,405,{error:'Method not allowed.'});}
  if(!authenticated(req,secret))return respond(res,401,{error:'Enter the password to open the alternate world map.'});
  const part=new URL(req.url||'/', 'https://atlas.local').searchParams.get('part')||'world';
  if(!['world','tibet'].includes(part))return respond(res,400,{error:'Unknown map section.'});
  if(!boundaries.has(part))boundaries.set(part,readBoundaries(part).catch(error=>{boundaries.delete(part);throw error;}));
  res.statusCode=200;res.setHeader('Content-Type','application/geo+json; charset=utf-8');res.end(await boundaries.get(part));
 }catch{return respond(res,503,{error:'The alternate world map is temporarily unavailable. Please try again.'});}
}
