import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const m=await loadMapModel(),h=await loadLocalModule(new URL('../app/world-equal-earth.ts',import.meta.url)),data=JSON.parse(await fs.readFile('public/data/world-region.geojson','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await context.addInitScript(seed=>{if(!localStorage.getItem('punjab-studio-regional-v2'))localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(seed));},m.initial);
const page=await context.newPage();page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const url=process.env.MAP_TEST_URL||'http://127.0.0.1:4546/';
async function ready(){await page.locator('[data-projection=equal-earth][aria-busy=false]').waitFor();}
const countRings=p=>(p.match(/M/g)||[]).length;
try{
 await fs.mkdir('outputs/world-readability',{recursive:true});await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Open world map',exact:true}).click();await ready();await page.getByLabel('World color scheme').selectOption('colorful');
 const optionNames=await page.getByLabel('World color scheme').locator('option').allTextContents();for(const name of ['Default political','Muted','Marine','Royal','Modern','Earth tones'])assert.ok(optionNames.includes(name));
 const canada=data.features.find(f=>f.id==='world-c-can'),raw=h.worldRenderedGeometry(canada.geometry).path,outline=await page.locator('[data-world-border="world-c-can"]').getAttribute('d');assert.ok(countRings(outline)<countRings(raw)*.25);assert.equal(await page.locator('[data-area="world-c-can"]').getAttribute('d'),raw,'Full land fills and hit targets are unchanged');
 await page.screenshot({path:'outputs/world-readability/default-world.png'});
 await page.getByLabel('World color scheme').selectOption('muted');await page.screenshot({path:'outputs/world-readability/muted-world.png'});
 await page.getByLabel('World color scheme').selectOption('marine');await page.screenshot({path:'outputs/world-readability/marine-world.png'});
 await page.getByLabel('World country',{exact:true}).selectOption('world-c-ind');
 const picker=page.getByLabel('World first-level division');const names=await picker.locator('option').allTextContents();for(const name of ['Haryana','Himachal Pradesh','Maharashtra','Chhattisgarh'])assert.ok(names.includes(name),name);assert.ok(!names.some(n=>/[?\ufffd]/.test(n)));
 await picker.selectOption('world-a1-1811400B68407848780347');await page.locator('[data-world-label="world-a1-1811400B68407848780347"]').waitFor();assert.equal(await page.locator('[data-world-label="world-a1-1811400B68407848780347"]').textContent(),'Haryana');await page.screenshot({path:'outputs/world-readability/haryana.png'});
 await page.getByRole('button',{name:'Export map',exact:true}).click();await page.getByRole('button',{name:'SVG',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download SVG',exact:true}).click();const file=await download;await file.saveAs('outputs/world-readability/haryana.svg');const svg=await fs.readFile('outputs/world-readability/haryana.svg','utf8');assert.match(svg,/>Haryana<\/text>/);assert.match(svg,/data-world-border/);assert.ok(!/NaN|Infinity/.test(svg));await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Open alternate world map',exact:true}).click();await page.getByLabel('Alternate world map password').fill('4688');await page.getByRole('button',{name:'Open map',exact:true}).click();await page.getByLabel('Alternate world map password').waitFor({state:'hidden'});await ready();
 await page.getByLabel('World color scheme').selectOption('white-gray');await page.getByLabel('World province border visibility').selectOption('always');await page.getByRole('button',{name:'Focus India',exact:true}).click();await page.screenshot({path:'outputs/world-readability/asia-clean-borders.png'});
 await page.getByLabel('World country',{exact:true}).selectOption('world-c-ind');const altNames=await page.getByLabel('World first-level division').locator('option').allTextContents();assert.ok(!altNames.some(n=>/[?\ufffd]/.test(n)));assert.ok(altNames.includes('United Punjab'));
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=392);await page.screenshot({path:'outputs/world-readability/mobile.png'});assert.deepEqual(errors,[]);
 console.log('Verified coordinated standard palettes, clean world/Asia coastlines, unchanged land fills and hit targets, restored Indian names in both editions, Haryana labels/SVG, alternate-map access and mobile layout.');
}finally{await browser.close();}
