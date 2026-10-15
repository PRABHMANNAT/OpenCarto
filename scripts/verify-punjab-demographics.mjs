import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel} from './load-map-model.mjs';
const model=await loadMapModel();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.addInitScript(seed=>{
  localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(seed));
  localStorage.setItem('private-atlas-punjab-districts-v1',JSON.stringify({revision:'united-punjab-48-amb-2026-10-15',groups:[],names:{'punjab-d-amritsar':'Amritsar custom'},colors:{'punjab-d-lahore':'#FF00FF'}}));
},model.initial);
const page=await context.newPage();page.setDefaultTimeout(60000);
const errors=[],apiFailures=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.url().includes('/api/private-atlas')&&response.status()>=400)apiFailures.push([response.status(),response.url()]);});
const url=process.env.MAP_TEST_URL||'http://127.0.0.1:4545/';
await fs.mkdir('outputs/private-atlas',{recursive:true});
const count=n=>n.toLocaleString('en-IN');
async function ready(){await page.locator('.ua-map[aria-busy=false]').waitFor({timeout:120000});await page.waitForFunction(()=>!document.querySelector('.ua-map-caption')?.textContent.includes('Loading'),{timeout:120000});}
async function search(term,name,level){await page.getByLabel('Find a province or capital').fill(term);let result=page.locator('.ua-search li button').filter({hasText:name});if(level)result=result.filter({hasText:level});await result.first().click();await ready();}
async function selectView(mode,number){await page.getByLabel('Administrative detail view').selectOption(mode);await page.waitForFunction(({mode,number})=>JSON.parse(document.querySelector('.ua-map')?.getAttribute('data-province-details')||'{}').punjab===mode&&Number(document.querySelector('.ua-map')?.getAttribute('data-detail-count'))===number,{mode,number},{timeout:120000});await ready();}
try{
  const data=await (await context.request.get(url+'api/private-atlas?action=demographics')).json();
  assert.equal(data.province.hypotheticalDemographics.total,67536450);
  await page.goto(url,{waitUntil:'networkidle',timeout:120000});
  await page.locator('.gl-host[aria-busy=false]').waitFor({timeout:120000});
  await page.getByRole('button',{name:'My maps',exact:true}).click();
  await page.getByRole('button',{name:'Open custom map',exact:true}).click();await ready();
  await page.getByRole('button',{name:'Demographics 2026',exact:true}).click();
  const dashboard=page.getByLabel('Punjab demographics dashboard');await dashboard.waitFor();
  await dashboard.locator('.ua-demo-total strong').first().filter({hasText:'6,75,36,450'}).waitFor();
  const summary=dashboard.locator('.ua-demographic-summary').first();
  assert.match(await summary.innerText(),/4,98,05,065/);assert.match(await summary.innerText(),/1,48,58,019/);assert.match(await summary.innerText(),/27,00,000/);
  assert.match(await summary.innerText(),/45,000/);assert.match(await summary.innerText(),/52,000/);assert.match(await summary.innerText(),/76,366/);
  assert.match(await dashboard.innerText(),/Fictional Alternate-History Demographic Scenario — 2026/);
  await summary.getByRole('button',{name:'Hindu',exact:true}).click();
  assert.match(await summary.locator('.ua-demo-chart-focus').innerText(),/22.0000000%/);
  await page.screenshot({path:'outputs/private-atlas/demographics-2026-summary-desktop.png'});
  const scope=page.getByLabel('Demographic ranking scope'),metric=page.getByLabel('Demographic ranking metric');
  for(const [level,number] of [['district',48],['tehsil',193],['division',12],['region',6]]){
    await scope.selectOption(level);await metric.selectOption('total');
    assert.equal(await dashboard.locator('.ua-demo-ranking-table tbody tr').count(),number);
    const expected=data.rows.filter(row=>row.level===level).sort((a,b)=>b.hypotheticalDemographics.total-a.hypotheticalDemographics.total||a.id.localeCompare(b.id));
    const actual=await dashboard.locator('.ua-demo-ranking-table tbody tr td:nth-child(3)').allTextContents();
    assert.deepEqual(actual,expected.map(row=>count(row.hypotheticalDemographics.total)));
  }
  await scope.selectOption('tehsil');await metric.selectOption('sikhShare');
  const top=await dashboard.locator('.ua-demo-ranking-table tbody tr td:nth-child(2) button').allTextContents();
  assert.deepEqual(top.slice(0,2),['Anandpur Sahib','Talwandi Sabo']);
  for(const key of ['hinduShare','muslimShare','density']){await metric.selectOption(key);const first=await dashboard.locator('.ua-demo-ranking-table tbody tr').first().innerText();assert.ok(first.length>20);}
  const csvDownload=page.waitForEvent('download');
  await dashboard.getByRole('button',{name:'Download this demographic table',exact:true}).click();
  await (await csvDownload).saveAs('outputs/private-atlas/demographics-2026-tehsils.csv');
  const csv=(await fs.readFile('outputs/private-atlas/demographics-2026-tehsils.csv','utf8')).trim().split(/\r?\n/);assert.equal(csv.length,194);
  const values=csv.slice(1).map(line=>line.match(/"([^"]*)"/g).map(cell=>cell.slice(1,-1)));
  assert.equal(values.reduce((sum,row)=>sum+Number(row[6]),0),67536450);assert.equal(values.reduce((sum,row)=>sum+Number(row[11]),0),49805065);
  await scope.selectOption('city');await metric.selectOption('sikhCount');
  assert.equal(await dashboard.locator('.ua-demo-ranking-table tbody tr').count(),8);
  assert.equal(await dashboard.locator('.ua-demo-ranking-table tbody tr td:nth-child(2) button').first().innerText(),'Lahore');
  assert.match(await dashboard.locator('.ua-demo-ranking-table tbody tr').first().innerText(),/45,00,000/);
  await dashboard.getByRole('button',{name:'Lahore',exact:true}).click();
  assert.match(await dashboard.getByLabel('Selected demographic unit').innerText(),/illustrative city estimate/);
  await page.screenshot({path:'outputs/private-atlas/demographics-2026-dashboard-desktop.png'});
  await dashboard.getByRole('button',{name:'Show Lahore on map',exact:true}).click();
  await dashboard.waitFor({state:'hidden'});
  await page.locator('.ua-map-pane').waitFor({state:'visible'});
  const layer=page.getByLabel('Punjab demographic map layer');assert.equal(await layer.locator('option').count(),14);
  for(const key of ['total','density','sikhCount','sikhShare','hinduCount','hinduShare','muslimCount','muslimShare','buddhistShare','christianShare','otherShare','urban','largest']){
    await layer.selectOption(key);await ready();
    await page.getByLabel('Demographic map legend').waitFor();
    assert.equal(await page.locator('.ua-map').getAttribute('data-population-metric'),key);
    assert.ok(await page.getByLabel('Demographic map legend').locator('div').count()>0);
  }
  await selectView('region',6);
  await page.getByLabel('Choose Punjab historical region').selectOption('punjab-region-pothohar');
  const regionPanel=page.getByLabel('Punjab historical region information');
  await regionPanel.getByRole('heading',{name:'Pothohar–Gandhara',exact:true}).waitFor();
  assert.equal(await regionPanel.locator('.ua-demo-total strong').innerText(),count(data.rows.find(row=>row.id==='punjab-region-pothohar').hypotheticalDemographics.total));
  await selectView('division',12);
  await page.getByLabel('Choose Punjab division').selectOption('punjab-div-hazara');
  const divisionPanel=page.getByLabel('Punjab division information');
  assert.equal(await divisionPanel.locator('.ua-demo-total strong').innerText(),count(data.rows.find(row=>row.id==='punjab-div-hazara').hypotheticalDemographics.total));
  assert.match(await divisionPanel.innerText(),/Abbottabad/);
  await selectView('tehsil',193);
  await search('Topi','Mahabanpur','Tehsil / subdistrict');
  const tehsilPanel=page.getByLabel('Punjab tehsil name history');
  await tehsilPanel.getByRole('heading',{name:'Mahabanpur',exact:true}).waitFor();
  assert.equal(await tehsilPanel.locator('.ua-demo-total strong').innerText(),count(data.rows.find(row=>row.level==='tehsil'&&row.name==='Mahabanpur').hypotheticalDemographics.total));
  await selectView('region',6);
  await page.getByLabel('Choose Punjab historical region').selectOption('punjab-region-doaba');
  await regionPanel.getByRole('heading',{name:'Doaba',exact:true}).waitFor();await page.waitForTimeout(850);
  const geo=await (await context.request.get(url+'api/private-atlas?action=detail&province=punjab&level=region')).json();
  const doaba=geo.features.find(f=>f.properties.name==='Doaba').properties;
  const project=([lon,lat])=>[(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];
  const [west,north]=project([doaba.bbox[0],doaba.bbox[3]]),[east,south]=project([doaba.bbox[2],doaba.bbox[1]]),[x,y]=project(doaba.center);
  const canvas=page.locator('.ua-map canvas.maplibregl-canvas'),box=await canvas.boundingBox();
  const scale=Math.min((box.width-140)/(east-west),(box.height-140)/(south-north));
  await page.mouse.move(box.x+box.width/2+(x-(west+east)/2)*scale,box.y+box.height/2+(y-(north+south)/2)*scale);
  await page.locator('.ua-demographic-tooltip').waitFor();assert.match(await page.locator('.ua-demographic-tooltip').innerText(),/Fictional 2026/);
  await page.mouse.move(0,0);
  await page.getByRole('button',{name:'Punjab only',exact:true}).click();await ready();await layer.selectOption('density');
  await page.setViewportSize({width:1047,height:715});await page.waitForTimeout(850);
  await page.screenshot({path:'outputs/private-atlas/demographics-2026-density-map.png'});
  const pngDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download map',exact:true}).click();await page.getByRole('button',{name:/^Current view/}).click();
  await (await pngDownload).saveAs('outputs/private-atlas/demographics-2026-map-export.png');
  await page.getByRole('button',{name:'Demographics 2026',exact:true}).click();await dashboard.waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/private-atlas/demographics-2026-mobile.png'});
  assert.ok(await page.locator('.ua-dialog').evaluate(node=>node.scrollWidth)<=392);
  assert.deepEqual(errors,[]);assert.deepEqual(apiFailures,[]);assert.equal(await page.locator('.ua-map-error').count(),0);
  await fs.writeFile('outputs/private-atlas/demographics-2026-browser-check.json',JSON.stringify({total:67536450,exactIndianFormatting:true,interactiveComposition:true,scopeRows:{district:48,tehsil:193,division:12,region:6,city:8},mapLayers:13,regionAndDivisionProfiles:true,tehsilStats:true,oldNameSearch:true,hoverStatistics:true,tehsilCsvRows:193,cityEstimatesDistinct:true,lahoreCityPopulation:4500000,topSikhTehsils:top.slice(0,2),densityLegend:true,pngExport:true,desktopAndMobile:true,pageErrors:errors,apiFailures},null,2));
  console.log('Verified exact 2026 totals, interactive composition, 48/193/12/6 rankings, Lahore city estimates, 13 choropleths, region/division/tehsil statistics, old aliases, hover, CSV/PNG exports and mobile layout.');
}catch(error){await page.screenshot({path:'outputs/private-atlas/demographics-2026-failure.png'});throw error;}finally{await browser.close();}
