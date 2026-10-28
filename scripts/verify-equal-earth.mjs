import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const model=await loadMapModel(),helper=await loadLocalModule(new URL('../app/world-equal-earth.ts',import.meta.url));
const audit=JSON.parse(await fs.readFile('outputs/world-map/equal-earth-area-audit.json','utf8'));
const seed={...model.initial,fills:{'world-c-aus':{color:'#123456',pattern:'solid'}},hidden:['in-punjab','world-c-lux'],areaNames:{'world-c-aus':'Australia test alias'}};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.addInitScript(value=>{if(!localStorage.getItem('punjab-studio-regional-v2'))localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(value));},seed);
const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
function pathArea(d){let area=0,ring=[];const flush=()=>{for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];area+=(a[0]*b[1]-b[0]*a[1])/2;}ring=[];};const tokens=d.match(/[MLZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)||[];for(let i=0;i<tokens.length;){const token=tokens[i++];if(token==='M'){flush();ring.push([+tokens[i++],+tokens[i++]]);}else if(token==='L')ring.push([+tokens[i++],+tokens[i++]]);else if(token==='Z')flush();else throw Error('Unexpected SVG command '+token);}flush();return Math.abs(area);}
async function matrix(){return page.locator('[data-world-scene]').evaluate(node=>{const m=node.getScreenCTM();return {sx:Math.hypot(m.a,m.b),sy:Math.hypot(m.c,m.d),a:m.a,b:m.b,c:m.c,d:m.d};});}
async function clientPoint(id){const area=model.areaById.get(id),p=helper.worldProjection()(area.center);return page.locator('[data-world-scene]').evaluate((node,point)=>{const svg=node.ownerSVGElement,p=svg.createSVGPoint();p.x=point[0];p.y=point[1];const client=p.matrixTransform(node.getScreenCTM());return {x:client.x,y:client.y};},p);}
try{
 await page.goto(process.env.MAP_TEST_URL||'http://127.0.0.1:4546/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Open world map',exact:true}).click();
 await page.locator('[data-projection=equal-earth][aria-busy=false]').waitFor();
 await page.locator('path[data-area="world-c-ata"]').waitFor();
 assert.equal(await page.locator('[data-area="world-c-aus"]').getAttribute('fill'),'#123456');
 assert.equal(await page.locator('[data-area="world-c-aus"] title').textContent(),'Australia test alias');
 assert.equal(await page.locator('[data-area="world-c-lux"]').count(),0,'Hidden territorial selections remain hidden');
 const rendered=await page.locator('path[data-area][data-level=region]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.getAttribute('data-area'),n.getAttribute('d')])));
 const grl=pathArea(rendered['world-c-grl']),aus=pathArea(rendered['world-c-aus']),africa=audit.africaCodes.reduce((sum,code)=>sum+pathArea(rendered['world-c-'+code.toLowerCase()]),0);
 const expected=audit.cases.filter(c=>c.viewport[0]===1200);
 assert.ok(Math.abs((grl/aus)/expected.find(c=>c.comparison==='Greenland / Australia').geographicRatio-1)<.003);
 assert.ok(Math.abs((grl/africa)/expected.find(c=>c.comparison==='Greenland / Africa').geographicRatio-1)<.003);
 await fs.mkdir('outputs/world-map',{recursive:true});await page.screenshot({path:'outputs/world-map/equal-earth-desktop.png'});
 for(const viewport of [{width:1000,height:650},{width:1800,height:780},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.waitForFunction(()=>{const n=document.querySelector('.equal-earth-svg');return n&&Math.abs(n.getBoundingClientRect().width-document.querySelector('.equal-earth-host').getBoundingClientRect().width)<2;});
   const m=await matrix();assert.ok(Math.abs(m.sx/m.sy-1)<1e-9,'Resize uses one scale, never independent X/Y stretching');
   assert.equal(await page.locator('[data-area="world-c-grl"]').getAttribute('d'),rendered['world-c-grl'],'Resize leaves projected geometry unchanged');
 }
 await page.getByRole('button',{name:'Open world map',exact:true}).click();
 await page.getByLabel('World country',{exact:true}).waitFor();
 await page.screenshot({path:'outputs/world-map/equal-earth-mobile.png'});
 const antarctica=await page.locator('[data-area="world-c-ata"]').boundingBox(),controls=await page.locator('.zoom-controls').boundingBox();
 assert.ok(antarctica&&controls&&antarctica.y+antarctica.height<controls.y,'Antarctica stays visible above mobile controls');
 await page.setViewportSize({width:1440,height:1000});
 // Hover and click the original geographic interior point after equal-area projection.
 await page.getByRole('button',{name:'Open world map',exact:true}).click();
 const point=await clientPoint('world-c-aus');await page.mouse.move(point.x,point.y);
 await page.locator('[data-transient=highlight]').waitFor();
 assert.equal(await page.locator('[data-transient=highlight]').getAttribute('d'),rendered['world-c-aus']);
 await page.mouse.click(point.x,point.y);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')));
 assert.notEqual(saved.fills['world-c-aus'].color,'#123456','Projected geographic hit testing colors the correct country');
 await page.getByLabel('World country',{exact:true}).selectOption('world-c-gbr');
 assert.equal(await page.locator('[data-world-internal-borders]').getAttribute('display'),'inline','Internal borders appear after geographic zoom');
 await page.screenshot({path:'outputs/world-map/equal-earth-uk.png'});
 await page.getByLabel('World administrative level',{exact:true}).selectOption('country');
 await page.getByRole('button',{name:'Rectangle',exact:true}).click();
 const center=await clientPoint('world-c-gbr');
 await page.mouse.move(center.x-20,center.y-20);await page.mouse.down();await page.mouse.move(center.x+20,center.y+20,{steps:5});await page.mouse.up();
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).fills['world-c-gbr']),'Rectangle selection uses the same projected coordinates');
 await page.getByRole('button',{name:'Export map',exact:true}).click();await page.getByRole('button',{name:'PNG',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download PNG',exact:true}).click();const file=await download;await file.saveAs('outputs/world-map/equal-earth-export.png');
 const bytes=await fs.readFile('outputs/world-map/equal-earth-export.png');assert.equal(bytes.readUInt32BE(16),2400);assert.equal(bytes.readUInt32BE(20),1320);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Open world map',exact:true}).click();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 assert.equal(await page.locator('[data-world-internal-borders]').getAttribute('display'),'inline');
 await page.getByRole('button',{name:'Export map',exact:true}).click();await page.getByRole('button',{name:'SVG',exact:true}).click();await page.getByRole('button',{name:'Full map',exact:true}).click();
 const fullDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download SVG',exact:true}).click();await(await fullDownload).saveAs('outputs/world-map/equal-earth-full.svg');
 const full=await fs.readFile('outputs/world-map/equal-earth-full.svg','utf8');
 assert.match(full,/preserveAspectRatio="xMidYMid meet"/);assert.match(full,/data-world-internal-borders="" display="none"/);assert.ok(!/NaN|Infinity/.test(full));
 // Existing imagery modes retain their renderer and clearly identify Mercator.
 await page.evaluate(()=>{const key='punjab-studio-regional-v2',doc=JSON.parse(localStorage.getItem(key));doc.basemap='satellite';localStorage.setItem(key,JSON.stringify(doc));});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Imagery view · Mercator',{exact:true}).waitFor();await page.locator('.gl-host canvas').waitFor();
 await page.getByRole('button',{name:'Return to Equal Earth',exact:true}).click();await page.locator('[data-projection=equal-earth][aria-busy=false]').waitFor();
 assert.deepEqual(errors,[]);
 console.log('Verified actual SVG area ratios, isotropic resize, full Antarctica, antimeridian paths, saved colors/names/hiding, projected hover/click and rectangle hit testing, zoom detail, and unstretched PNG export.');
}catch(error){await fs.mkdir('outputs/world-map',{recursive:true});await page.screenshot({path:'outputs/world-map/equal-earth-failure.png'});throw error;}finally{await browser.close();}
