import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const model=await loadMapModel(),helper=await loadLocalModule(new URL('../app/world-equal-earth.ts',import.meta.url));
const manifest=JSON.parse(await fs.readFile('app/india-punjab-scenario.json','utf8'));
const overrides=JSON.parse(await fs.readFile('public/data/india-punjab-world-overrides.geojson','utf8'));
const seed={...model.initial,fills:{[manifest.punjabId]:{color:'#abcdef',pattern:'solid'}}};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.addInitScript(value=>{if(!localStorage.getItem('punjab-studio-regional-v2'))localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(value));},seed);
const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.MAP_TEST_URL||'http://127.0.0.1:4546/';
const polygon=id=>page.locator('path[data-area="'+id+'"]');
async function ready(){await page.locator('[data-projection=equal-earth][aria-busy=false]').waitFor();}
async function privateReady(level){await page.locator('.ua-map[aria-busy=false]').waitFor({timeout:120000});await page.waitForFunction(level=>{const n=document.querySelector('.ua-map');return n&&JSON.parse(n.getAttribute('data-province-details')||'{}').punjab===level&&Number(n.getAttribute('data-detail-count'))===({district:48,division:12,tehsil:193})[level]&&!document.querySelector('.ua-map-caption')?.textContent.includes('Loading');},level,{timeout:120000});}
try{
 await fs.mkdir('outputs/india-punjab',{recursive:true});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Open hypothetical India with United Punjab',exact:true}).click();
 await ready();
 assert.equal(await page.getByLabel('World boundary edition').inputValue(),'india-punjab');
 assert.equal(await page.getByLabel('World country',{exact:true}).inputValue(),manifest.indiaId);
 for(const id of [manifest.indiaId,manifest.punjabId,manifest.ladakhId]){
  const expected=helper.worldRenderedGeometry(overrides.features.find(f=>f.id===id).geometry).path;
  assert.equal(await polygon(id).getAttribute('d'),expected,id+' renders override coordinates');
 }
 assert.equal(await polygon(manifest.punjabId).getAttribute('fill'),'#abcdef','Existing colors retained');
 assert.equal(await polygon(manifest.aksaiId).count(),0);
 assert.equal(await page.getByLabel('World country',{exact:true}).locator('option[value="'+manifest.aksaiId+'"]').count(),0);
 await page.screenshot({path:'outputs/india-punjab/hypothetical-india.png'});
 await page.getByRole('button',{name:'Focus United Punjab',exact:true}).click();
 await page.screenshot({path:'outputs/india-punjab/punjab-in-india.png'});
 await page.getByRole('button',{name:'Focus Ladakh + Aksai Chin',exact:true}).click();
 await page.locator('[data-scenario-context=aksai-chin]').waitFor();
 await page.screenshot({path:'outputs/india-punjab/ladakh-aksai-chin.png'});
 await page.getByRole('button',{name:'Focus United Punjab',exact:true}).click();
 await page.getByRole('button',{name:'Export map',exact:true}).click();
 await page.getByRole('button',{name:'SVG',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download SVG',exact:true}).click();
 const file=await download;assert.equal(file.suggestedFilename(),'india-united-punjab.svg');await file.saveAs('outputs/india-punjab/india-united-punjab.svg');
 const svg=await fs.readFile('outputs/india-punjab/india-united-punjab.svg','utf8');assert.match(svg,/Hypothetical India/);assert.match(svg,/Aksai Chin/);assert.match(svg,/WFP\/OCHA/);assert.ok(!/NaN|Infinity/.test(svg));
 await page.keyboard.press('Escape');
 for(const level of ['district','division','tehsil']){
  await page.getByRole('button',{name:'Punjab '+level+'s',exact:true}).click();await privateReady(level);
  await page.screenshot({path:'outputs/india-punjab/punjab-'+level+'.png'});
  assert.equal(await page.locator('.ua-error').count(),0);
  await page.getByRole('button',{name:'India + United Punjab',exact:true}).click();await ready();
 }
 const overviewResponse=await context.request.get(new URL('/api/private-atlas?action=overview',url).href);assert.equal(overviewResponse.status(),200);const overview=await overviewResponse.json();
 const punjab=overview.provinces.find(p=>p.id==='punjab');assert.equal(punjab.detailCounts.district,48);assert.equal(punjab.detailCounts.division,12);assert.equal(punjab.detailCounts.tehsil,193);assert.ok(overview.provinces.some(p=>p.id==='amb'));
 await page.reload({waitUntil:'domcontentloaded'});await ready();assert.equal(await page.getByLabel('World boundary edition').inputValue(),'india-punjab');
 await page.getByLabel('World boundary edition').selectOption('source');await ready();
 const original=JSON.parse(await fs.readFile('public/data/world-province.geojson','utf8')).features.find(f=>f.id===manifest.punjabId);
 await page.waitForFunction(({id,path})=>document.querySelector('path[data-area="'+id+'"]')?.getAttribute('d')===path,{id:manifest.punjabId,path:helper.worldRenderedGeometry(original.geometry).path});
 await page.getByLabel('World boundary edition').selectOption('india-punjab');await ready();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open hypothetical India with United Punjab',exact:true}).click();await ready();
 assert.equal(await page.locator('.equal-earth-svg').getAttribute('preserveAspectRatio'),'xMidYMid meet');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=392);
 await page.screenshot({path:'outputs/india-punjab/mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Verified India/Punjab/Ladakh override paths, existing colors, no duplicate Aksai, detailed 48/12/193 maps and API, Amb independence, scenario SVG, save/reload, source restoration and mobile layout without browser errors.');
}finally{await browser.close();}
