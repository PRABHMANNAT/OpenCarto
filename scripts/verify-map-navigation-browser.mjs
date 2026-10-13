import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
import {configureExport,triggerExport,setPaintColor} from './workspace-ui.mjs';
const model=await loadMapModel(),scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url)),study=await loadLocalModule(new URL('../app/case-study-model.ts',import.meta.url)),navigation=await loadLocalModule(new URL('../app/map-navigation-model.ts',import.meta.url));
const amritsar=model.areas.find(a=>a.name==='Amritsar'&&a.region==='in-punjab'&&a.level==='district');
const seed=model.validate({...model.initial,...scope.scopePreset(model.initial,'combination',{scopeRegions:['in-punjab','pk-punjab']}),title:'My Punjab combination',hidden:['PK614'],fills:{[amritsar.id]:{color:'#123456',pattern:'dots'}},areaNames:{[amritsar.id]:'My Amritsar'}});
const key='punjab-studio-regional-v2',output='outputs/map-navigation';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.MAP_BROWSER_CHANNEL||'chrome',headless:true,args:['--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});page.setDefaultTimeout(30000);
const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('localhost')&&r.status()>=400)failed.push(r.status()+' '+r.url());});
await page.addInitScript(({seed,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{seed,key});
const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const idle=()=>page.waitForFunction(()=>document.querySelector('.gl-host')?.getAttribute('aria-busy')==='false',null,{timeout:120000});
const popup=page.locator('.map-view-popup');
const zoom=async()=>Number((await page.locator('.zoom-controls span').innerText()).replace(/[^\d.]/g,''));
async function menu(){await page.getByRole('button',{name:'Map views',exact:true}).click();await popup.waitFor();await popup.evaluate(node=>Promise.all(node.getAnimations({subtree:true}).map(animation=>animation.finished)));}
async function choose(name){await menu();await popup.getByRole('button',{name,exact:false}).click();await popup.waitFor({state:'hidden'});await idle();}
async function history(id){await page.getByRole('tab',{name:'History',exact:true}).click();await page.getByLabel('Historical empire').selectOption(id);await idle();}
async function paint(id,query,color){await page.getByRole('tab',{name:'Areas',exact:true}).click();await page.getByLabel('Find an area',{exact:true}).fill(query);await setPaintColor(page,color);await page.locator('.area-search-card[data-area="'+id+'"]').locator('.area-name').click();await idle();}
try{
 await page.goto(process.env.MAP_TEST_URL||'http://localhost:4545/',{waitUntil:'networkidle',timeout:60000});await idle();
 await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.waitForFunction(()=>!!document.fullscreenElement);await menu();
 assert.ok(await popup.evaluate(node=>document.fullscreenElement.contains(node)),'Map views stay inside the fullscreen surface');await page.screenshot({path:output+'/fullscreen-menu.png'});
 await popup.getByRole('button',{name:/Selected map/}).click();await popup.waitFor({state:'hidden'});await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.waitForFunction(()=>!document.fullscreenElement);await idle();
 if(process.env.MAP_NAVIGATION_FULLSCREEN_ONLY==='1')console.log('Verified fullscreen map view popup, selection action and return to the regular workspace.');else{
 assert.ok(await page.getByRole('button',{name:'Normal map',exact:true}).isDisabled());
 await menu();assert.ok(await popup.getByRole('button',{name:/Focus edited area/}).isDisabled());await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});assert.ok(await page.getByRole('button',{name:'Map views',exact:true}).evaluate(e=>e===document.activeElement));
 const original=await saved(),selectedZoom=await zoom();
 await choose('Complete map');assert.equal((await saved()).mapScope,'full');assert.deepEqual((await saved()).fills,original.fills);const fullZoom=await zoom();assert.ok(fullZoom<selectedZoom-.5,'Complete view frames the whole atlas');
 await menu();await page.screenshot({path:output+'/complete-view-menu.png'});await page.keyboard.press('Escape');
 await choose('Selected map');assert.deepEqual(await saved(),original);assert.ok(await zoom()>fullZoom+.5);
 await paint('PK617','Lahore','#7c498e');const edited=await saved();
 await choose('Complete map');await choose('Focus edited area');assert.equal((await saved()).mapScope,'combination');assert.deepEqual((await saved()).fills,edited.fills);assert.ok(await zoom()>selectedZoom+1,'Focus zooms to the edited district');
 await configureExport(page,{format:'svg',extent:'This view',width:1600});const event=page.waitForEvent('download');await triggerExport(page);const file=output+'/focused.svg';await(await event).saveAs(file);const svg=await fs.readFile(file,'utf8'),metadata=JSON.parse(svg.match(/<metadata>(.*?)<\/metadata>/s)[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
 assert.ok(metadata.scope.bounds[2]-metadata.scope.bounds[0]<3);assert.ok(svg.includes('data-area="PK617"'));await page.screenshot({path:output+'/focus-area.png'});
 await history('sikh-1839');assert.ok(await page.getByRole('button',{name:'Normal map',exact:true}).isEnabled());await menu();await page.screenshot({path:output+'/history-toolbar.png'});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Normal map',exact:true}).click();await idle();assert.deepEqual(await saved(),edited);assert.equal(await page.getByLabel('Empire legend').count(),0);
 await history('maurya-250-bce');await page.getByLabel('Historical empire').selectOption('none');await idle();assert.deepEqual(await saved(),edited,'Existing Off control uses the same restore behavior');
 // Exercise navigation for an existing saved case-study map through settings import.
 const legacy=model.validate({...edited,...navigation.recordHistoryChange(edited,study.caseStudyLoadPreset(edited))});
 await fs.writeFile(output+'/legacy-settings.json',JSON.stringify(legacy));
 await page.locator('input[type=file]').first().setInputFiles(output+'/legacy-settings.json');await idle();await paint('PK609','Gujranwala','#d54c70');
 const card=page.locator('.area-search-card[data-area="PK609"]');await card.getByRole('button',{name:'Rename Gujranwala',exact:true}).click();const inspector=page.getByRole('complementary',{name:'Inspected area',exact:true});await inspector.getByLabel('Area display name').fill('My edited Gujranwala');await inspector.getByRole('button',{name:'Save name',exact:true}).click();await idle();await card.getByRole('button',{name:'Hide Gujranwala',exact:true}).click();await idle();
 await history('mughal-late-1600s');const historyDraft=await saved();assert.equal(historyDraft.historyReturn.before.title,edited.title);
 await page.getByRole('button',{name:'Save',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Map name',{exact:true}).fill('History return test');await dialog.getByRole('button',{name:'Save map',exact:true}).click();await dialog.getByRole('button',{name:'Save changes',exact:true}).waitFor();await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});await idle();assert.deepEqual(await saved(),historyDraft);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Normal map',exact:true}).click();await idle();const normal=await saved();assert.equal(normal.empireId,'none');assert.equal(normal.caseStudyId,'none');assert.equal(normal.mapScope,'combination');assert.equal(normal.fills.PK609.color,'#D54C70');assert.equal(normal.fills[amritsar.id].color,'#123456');assert.equal(normal.areaNames.PK609,'My edited Gujranwala');assert.ok(normal.hidden.includes('PK609'));assert.ok(normal.hidden.includes('PK614'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await menu();const box=await popup.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390+1,'Mobile popup stays within the screen');await page.screenshot({path:output+'/mobile-menu.png'});await popup.getByRole('button',{name:/Complete map/}).click();await idle();await choose('Selected map');assert.deepEqual(await saved(),normal);
 await page.getByRole('button',{name:'My maps',exact:true}).click();await dialog.getByRole('button',{name:'Open History return test',exact:true}).click();await idle();assert.equal((await saved()).empireId,'mughal-late-1600s');await page.getByRole('button',{name:'Normal map',exact:true}).click();await idle();assert.deepEqual(await saved(),normal,'A reopened named history map can also return to normal');
 await choose('Complete map');await page.getByRole('tab',{name:'Areas',exact:true}).click();await page.getByLabel('Find an area',{exact:true}).fill('Amritsar');await page.locator('.area-search-card[data-area="'+amritsar.id+'"]').getByRole('button',{name:'Show only Amritsar',exact:true}).click();await idle();const changed=await saved();assert.equal(changed.viewReturn,null);assert.deepEqual(changed.scopeAreas,[amritsar.id]);await page.locator('.settings .inspector-close').click();await choose('Selected map');assert.deepEqual(await saved(),changed,'An explicit new selection replaces the earlier remembered combination');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log('Verified floating normal/complete/selected/focus controls, camera and SVG extent, empire Off, saved case-study colors/names/hidden areas, reload, named-map reopening, keyboard dismissal and mobile popup.');
 }
}catch(error){console.error('Page errors:',errors,'HTTP errors:',failed);await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
