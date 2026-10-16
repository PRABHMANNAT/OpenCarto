import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createDecipheriv} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {PDFDocument} from 'pdf-lib';
import {loadLocalModule} from './load-map-model.mjs';
process.loadEnvFile('.env.local');
const encoded=await fs.readFile('server/private-atlas.enc');
const decipher=createDecipheriv('aes-256-gcm',Buffer.from(process.env.PRIVATE_ATLAS_DATA_KEY,'hex'),encoded.subarray(4,16));
decipher.setAuthTag(encoded.subarray(16,32));
const atlas=JSON.parse(gunzipSync(Buffer.concat([decipher.update(encoded.subarray(32)),decipher.final()])).toString('utf8'));
const {createPunjabAtlasPdf}=await loadLocalModule(new URL('../app/private-atlas-pdf.ts',import.meta.url));
const editor=await loadLocalModule(new URL('../app/private-atlas-districts.ts',import.meta.url));
const input=atlas.details.punjab;
const district=editor.styleDistrictFeatures(input.district,input.district,editor.defaultDistrictEdits());
const parents=new Map(district.features.map(f=>[f.properties.id,f.properties]));
const tehsil={...input.tehsil,features:input.tehsil.features.map(f=>({...f,properties:{...f.properties,color:parents.get(f.properties.parentDistrictId).color}}))};
const result=await createPunjabAtlasPdf({district,division:input.division,tehsil},'all',console.log);
assert.equal(result.pages.length,15);
assert.deepEqual(result.pages.slice(0,3).map(p=>p.labels.length),[12,48,193]);
const detailIds=result.pages.slice(3).flatMap(p=>p.labels.map(l=>l.id));
assert.equal(detailIds.length,193);assert.equal(new Set(detailIds).size,193);
for(const page of result.pages){
  assert.equal(new Set(page.labels.map(l=>l.id)).size,page.labels.length);
  for(const [i,a] of page.labels.entries()){
    assert.ok(a.x>=48&&a.y>=112&&a.x+a.w<=page.width-48&&a.y+a.h<=page.height-148,a.name+' within page');
    for(const b of page.labels.slice(i+1))assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'Label overlap: '+a.name+' / '+b.name);
  }
}
const out='output/pdf';await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/united-punjab-detailed-atlas.pdf',result.bytes);
const source=await PDFDocument.load(result.bytes);
for(const [scope,indices] of [['division',[0]],['district',[1]],['tehsil',Array.from({length:13},(_,i)=>i+2)]]){
  const doc=await PDFDocument.create();doc.setTitle('United Punjab - '+scope+' maps');
  for(const p of await doc.copyPages(source,indices))doc.addPage(p);
  await fs.writeFile(out+'/united-punjab-'+scope+'-maps.pdf',await doc.save());
}
await fs.mkdir('outputs/private-atlas',{recursive:true});
await fs.writeFile('outputs/private-atlas/punjab-pdf-label-audit.json',JSON.stringify({pages:result.pages.map(p=>({title:p.title,labels:p.labels.length,width:p.width,height:p.height})),allNamesPresent:true,noOverlappingLabelBoxes:true,allTehsilsInEnlargements:true},null,2));
console.log('Verified 15 vector map pages, 48 districts, 12 divisions, all 193 tehsil labels at both overview and enlarged scales; no overlapping label boxes.');
