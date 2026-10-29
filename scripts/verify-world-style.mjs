import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel} from './load-map-model.mjs';
const model=await loadMapModel(),seed={...model.initial,fills:{'world-c-ind':{color:'#123456',pattern:'solid'},'in-d-608':{color:'#aabbcc',pattern:'solid'}}};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await context.addInitScript(value=>{if(!localStorage.getItem('punjab-studio-regional-v2'))localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(value));},seed);
const page=await context.newPage();page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.MAP_TEST_URL||'http://127.0.0.1:4546/';
async function ready(){await page.locator('[data-projection=equal-earth][aria-busy=false]').waitFor();}
async function countryColors(){return page.locator('path[data-area][data-level=region]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('fill')));}
try{
 await fs.mkdir('outputs/world-style',{recursive:true});await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Open world map',exact:true}).click();await ready();
 assert.equal(await page.locator('[data-area="world-c-ind"]').getAttribute('fill'),'#123456');
 for(const scheme of ['colorful','pastel','white','gray','white-gray']){
  await page.getByLabel('World color scheme',{exact:true}).selectOption(scheme);
  await page.waitForFunction(value=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).worldColorScheme===value,scheme);
  const colors=await countryColors();if(scheme==='colorful'||scheme==='pastel')assert.equal(new Set(colors).size,218);if(scheme==='white')assert.deepEqual([...new Set(colors)],['#ffffff']);if(scheme==='gray')assert.deepEqual([...new Set(colors)],['#e5e7eb']);if(scheme==='white-gray')assert.equal(new Set(colors).size,3);
  const countryStroke=page.locator('[data-world-country-borders] path').first();assert.equal(await countryStroke.getAttribute('stroke'),'#000000');assert.equal(await countryStroke.getAttribute('stroke-opacity'),'1');
  assert.equal(await page.locator('[data-world-internal-borders] path').first().getAttribute('stroke'),'#9ca3af');
  if(['colorful','white','white-gray'].includes(scheme))await page.screenshot({path:'outputs/world-style/'+scheme+'.png'});
 }
 await page.getByLabel('World province border visibility').selectOption('always');assert.equal(await page.locator('[data-world-internal-borders]').getAttribute('display'),'inline');await page.screenshot({path:'outputs/world-style/white-gray-provinces.png'});
 await page.getByLabel('World province border visibility').selectOption('hidden');assert.equal(await page.locator('[data-world-internal-borders]').getAttribute('display'),'none');
 await page.getByLabel('World province border visibility').selectOption('always');
 await page.getByRole('button',{name:'Export map',exact:true}).click();await page.getByRole('button',{name:'SVG',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download SVG',exact:true}).click();const file=await download;await file.saveAs('outputs/world-style/white-gray.svg');const svg=await fs.readFile('outputs/world-style/white-gray.svg','utf8');assert.match(svg,/scheme.*white-gray/);assert.match(svg,/stroke="#000000"/);assert.match(svg,/stroke="#9ca3af"/);assert.ok(!/NaN|Infinity/.test(svg));await page.keyboard.press('Escape');
 await page.reload({waitUntil:'domcontentloaded'});await ready();assert.equal(await page.getByLabel('World color scheme').inputValue(),'white-gray');assert.equal(await page.getByLabel('World province border visibility').inputValue(),'always');
 await page.getByRole('button',{name:'Restore saved colors',exact:true}).click();assert.equal(await page.locator('[data-area="world-c-ind"]').getAttribute('fill'),'#123456');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')));assert.deepEqual(stored.fills,seed.fills);
 await page.getByLabel('World color scheme').selectOption('white');
 await page.getByRole('button',{name:'Open alternate world map',exact:true}).click();await page.getByLabel('Alternate world map password').fill('4688');await page.getByRole('button',{name:'Open map',exact:true}).click();await page.getByLabel('Alternate world map password').waitFor({state:'hidden'});await ready();
 assert.deepEqual([...new Set(await countryColors())],['#ffffff']);assert.equal(await page.getByLabel('World color scheme').inputValue(),'white');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=392);await page.screenshot({path:'outputs/world-style/mobile.png'});
 assert.deepEqual(errors,[]);console.log('Verified six scheme choices, unique country colors, complete white/gray fills, black international and gray province borders, visibility controls, SVG appearance, save/reload, color restoration, alternate-world access and mobile layout.');
}finally{await browser.close();}
