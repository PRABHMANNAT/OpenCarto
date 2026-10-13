import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
import {configureExport,triggerExport,downloadSettings} from './workspace-ui.mjs';
const model=await loadMapModel(),study=await loadLocalModule(new URL('../app/case-study-model.ts',import.meta.url));
const browser=await chromium.launch({channel:process.env.MAP_BROWSER_CHANNEL||'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
page.setDefaultTimeout(30000);
const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('localhost')&&r.status()>=400)failed.push(r.status()+' '+r.url());});
const key='punjab-studio-regional-v2';await page.addInitScript(({key,doc})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(doc));},{key,doc:model.initial});
const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const idle=()=>page.waitForFunction(()=>document.querySelector('.gl-host')?.getAttribute('aria-busy')==='false',null,{timeout:120000});
const inspector=page.getByRole('complementary',{name:'Inspected area',exact:true});
await fs.mkdir('outputs/case-study',{recursive:true});
async function search(name){await page.getByRole('button',{name:'Search and add areas',exact:true}).click();await page.getByLabel('Find an area').fill(name);}
async function exported(format,path){await configureExport(page,{format,width:1600});const event=page.waitForEvent('download',{timeout:120000});await triggerExport(page);await (await event).saveAs(path);return fs.readFile(path);}
try{
 await page.goto(process.env.MAP_TEST_URL||'http://localhost:4545/',{waitUntil:'networkidle',timeout:60000});await idle();
 await page.getByRole('tab',{name:'History',exact:true}).click();
 assert.ok(await page.getByLabel('Historical empire').isVisible());
 assert.equal(await page.getByLabel('History case study',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Load Sikh military & heritage case study',exact:true}).count(),0);
 assert.equal(await page.locator('.case-study-controls').count(),0);
 await page.screenshot({path:'outputs/case-study/history-without-case-study.png'});
 await page.getByRole('button',{name:'Guide & sources',exact:true}).click();
 const guide=page.getByRole('dialog');
 assert.equal(await guide.getByRole('heading',{name:'Sikh military & heritage case study',exact:true}).count(),0);
 await guide.getByRole('button',{name:'Close',exact:true}).click();await guide.waitFor({state:'hidden'});
 // Existing settings files remain editable even though History no longer offers the preset.
 const legacy=model.validate({...model.initial,...study.caseStudyLoadPreset(model.initial)});
 await fs.writeFile('outputs/case-study/legacy-settings.json',JSON.stringify(legacy));
 await page.locator('input[type=file]').first().setInputFiles('outputs/case-study/legacy-settings.json');await idle();
 assert.equal(await page.getByLabel('Jump to a region').locator('option[value="pk-lahore-study"]').count(),0);
 const loaded=await saved();assert.equal(loaded.mapScope,'full');assert.equal(loaded.regions['pk-country'].province,true);assert.deepEqual(loaded.scopeAreas,study.caseStudyAreaIds);assert.equal(loaded.caseStudyId,'sikh-heritage-core');assert.equal(loaded.areaNames.PK609,'Maharaja Ranjit Singh');
 assert.ok(await page.getByLabel('History case study caption').isVisible());assert.equal(await page.locator('.floating-legend>div').count(),4);
 await page.screenshot({path:'outputs/case-study/heritage-core.png'});
 await search('Lahore');await page.locator('.area-search-card[data-area="PK617"]').getByRole('button',{name:'Zoom to Lahore',exact:true}).click();await idle();
 const lahoreSvg=(await exported('svg','outputs/case-study/lahore.svg')).toString();for(const id of ['case-lahore-city','case-lahore-shalimar','case-lahore-cantonment'])assert.ok(lahoreSvg.includes('data-area="'+id+'"'));
 assert.ok(lahoreSvg.includes('alternate-history'));assert.ok(lahoreSvg.includes('OpenStreetMap'));await page.screenshot({path:'outputs/case-study/lahore.png'});
 await page.getByRole('button',{name:'Fit visible regions',exact:true}).click();await idle();
 await search('Maharaja Ranjit Singh');const card=page.locator('.area-search-card[data-area="PK609"]');await card.waitFor();
 await card.getByRole('button',{name:'Rename Gujranwala',exact:true}).click();await inspector.waitFor();
 assert.ok((await inspector.innerText()).includes('Source name: Gujranwala'));
 const name='Khalsa District <West> & East';await inspector.getByLabel('Area display name').fill(name);await inspector.getByRole('button',{name:'Save name',exact:true}).click();await idle();assert.equal((await saved()).areaNames.PK609,name);
 assert.equal(await inspector.getByRole('heading').innerText(),name);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await idle();assert.equal((await saved()).areaNames.PK609,'Maharaja Ranjit Singh');
 await page.getByRole('button',{name:'Redo',exact:true}).click();await idle();assert.equal((await saved()).areaNames.PK609,name);
 await page.getByLabel('Find an area').fill('Khalsa District');await card.waitFor();assert.ok((await card.innerText()).includes(name));
 await page.getByLabel('Find an area').fill('Gujranwala');await card.waitFor();await card.getByRole('button',{name:'Show only Gujranwala',exact:true}).click();await idle();
 await page.getByRole('button',{name:'Close inspected area',exact:true}).click();
 const svg=(await exported('svg','outputs/case-study/renamed.svg')).toString();assert.ok(svg.includes('Khalsa District &lt;West&gt; &amp; East'));assert.ok(svg.includes('areaNames'));assert.ok(!svg.includes('<West>'),'Custom names are escaped as text');
 for(const format of ['png','jpg']){const bytes=await exported(format,'outputs/case-study/renamed.'+format);assert.ok(bytes.length>10000);if(format==='png')assert.equal(bytes.subarray(1,4).toString(),'PNG');else assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8');}
 await page.getByRole('button',{name:'Rename selected area',exact:true}).click();await inspector.waitFor();await page.screenshot({path:'outputs/case-study/rename-area.png'});
 const before=await saved(),download=page.waitForEvent('download');await downloadSettings(page);await (await download).saveAs('outputs/case-study/settings.json');
 await inspector.getByRole('button',{name:'Reset name',exact:true}).click();await idle();assert.ok(!(await saved()).areaNames.PK609);assert.equal(await inspector.getByLabel('Area display name').inputValue(),'Gujranwala');
 await page.locator('input[type=file]').first().setInputFiles('outputs/case-study/settings.json');await idle();assert.deepEqual(await saved(),before);
 await page.reload({waitUntil:'networkidle'});await idle();assert.deepEqual(await saved(),before);
 await page.setViewportSize({width:390,height:844});await search('Lahore City');const city=page.locator('.area-search-card[data-area="case-lahore-city"]');await city.waitFor();await city.getByRole('button',{name:'Rename Lahore City',exact:true}).click();await inspector.waitFor();
 assert.ok(await inspector.getByLabel('Area display name').isVisible(),'Mobile Rename exposes the editor');await inspector.getByLabel('Area display name').fill('Lahore heritage city');await inspector.getByRole('button',{name:'Save name',exact:true}).click();await idle();
 assert.equal((await saved()).areaNames['case-lahore-city'],'Lahore heritage city');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'outputs/case-study/mobile-rename.png'});
 console.log('Case-study exports, names, saved settings and mobile editing verified; checking empire switching.');
 await page.getByRole('tab',{name:'History',exact:true}).click();await page.getByLabel('Historical empire').selectOption('sikh-1839');await idle();assert.equal((await saved()).caseStudyId,'none');assert.equal(await page.getByLabel('History case study caption').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log('Verified case-study controls and guide removed from History, retained empire controls, legacy settings loading/colors/names, Lahore geometry and area zoom, renaming/reset, SVG/PNG/JPG, Save/Load, reload, undo/redo, mobile editing and empire switching.');
}catch(e){console.error('Page errors:',errors,'HTTP errors:',failed);console.error('Status:',await page.locator('.statusbar').innerText({timeout:3000}).catch(()=>''));await page.screenshot({path:'outputs/case-study/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
