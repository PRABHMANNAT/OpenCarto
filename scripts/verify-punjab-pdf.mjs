import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {chromium} from 'playwright';
import {loadMapModel} from './load-map-model.mjs';
const model=await loadMapModel();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.addInitScript(seed=>localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(seed)),model.initial);
const page=await context.newPage();page.setDefaultTimeout(90000);
const failure=process.env.PDF_CHUNK_FAILURE||'';
let blockedChunks=0,documentLoads=0;
page.on('framenavigated',frame=>{if(frame===page.mainFrame())documentLoads++;});
if(failure)await page.route('**/assets/private-atlas-pdf-*.js',async route=>{
  if(failure==='persistent'||blockedChunks===0){blockedChunks++;await route.fulfill({status:404,contentType:'text/plain',body:'Simulated expired deployment chunk'});}
  else await route.continue();
});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(process.env.MAP_TEST_URL||'http://127.0.0.1:4545/',{waitUntil:'networkidle',timeout:120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout:120000});
  await page.getByRole('button',{name:'My maps',exact:true}).click();
  await page.getByRole('button',{name:'Open custom map',exact:true}).click();
  await page.getByRole('button',{name:'Download detailed Punjab PDF',exact:true}).waitFor({timeout:120000});
  await page.getByRole('button',{name:'Punjab only',exact:true}).click();
  const picker=page.getByLabel('Show separate Punjab district');
  await picker.locator('option').nth(48).waitFor({state:'attached'});
  await picker.selectOption('punjab-d-hazarawala');
  await page.getByRole('button',{name:'Names on',exact:true}).click();
  if(failure==='persistent'){
    await page.getByRole('button',{name:'Download detailed Punjab PDF',exact:true}).click();
    await page.getByText('The PDF exporter could not load.',{exact:false}).waitFor({timeout:180000});
    assert.equal(documentLoads,2,'Persistent import failure reloads only once');
    assert.equal(blockedChunks,2,'The resumed download attempts the new module once');
    assert.equal(await page.getByLabel('Show separate Punjab district').inputValue(),'punjab-d-hazarawala');
    assert.equal(await page.getByRole('button',{name:'Names off',exact:true}).count(),1);
    await page.getByRole('button',{name:'Download detailed Punjab PDF',exact:true}).click();
    await page.getByText('The PDF exporter could not load.',{exact:false}).waitFor();
    assert.equal(documentLoads,2,'Repeated clicks cannot create a reload loop');
    assert.deepEqual(errors,[]);
    console.log('Verified persistent missing PDF module: one bounded recovery, restored view, actionable error and no reload loop.');
    process.exitCode=0;
  }else{
  const download=page.waitForEvent('download',{timeout:180000});
  await page.getByRole('button',{name:'Download detailed Punjab PDF',exact:true}).click();
  await page.locator('.ua-pdf-progress').waitFor();
  await fs.mkdir('outputs/private-atlas',{recursive:true});
  const file='outputs/private-atlas/punjab-pdf-browser.pdf';await(await download).saveAs(file);
  const pdf=await PDFDocument.load(await fs.readFile(file));assert.equal(pdf.getPageCount(),15);
  assert.equal(await picker.inputValue(),'punjab-d-hazarawala','PDF export preserves the on-screen district');
  assert.equal(await page.getByRole('button',{name:'Names off',exact:true}).count(),1,'PDF forces its own labels without changing the screen toggle');
  await page.locator('.ua-pdf-progress').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Download map',exact:true}).click();
  for(const scope of ['division','district','tehsil'])assert.equal(await page.getByRole('button',{name:new RegExp('Punjab '+scope+' maps - PDF')}).count(),1);
  await page.getByRole('button',{name:'Download map',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Download detailed Punjab PDF',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'outputs/private-atlas/punjab-pdf-mobile.png'});
  assert.ok(await page.locator('.ua-dialog').evaluate(n=>n.scrollWidth)<=392);
  assert.deepEqual(errors,[]);
  if(failure){assert.equal(blockedChunks,1);assert.equal(documentLoads,2,'An expired chunk triggers exactly one recovery');}
  console.log('Verified one-click 15-page PDF download from isolated Hazarawala with screen names off, independent PDF labels, preserved view, three individual map options, mobile control and no browser errors.');
  }
}finally{await browser.close();}
