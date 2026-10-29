import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await fs.readFile('app/india-punjab-scenario.json','utf8'));
const urls={
 'work/cn-atlas-provinces.json':'https://raw.githubusercontent.com/BarbarossaWang/cn-atlas/6e83a19923e39f2c0e58a0a7ad29b349b2a71b9f/provinces.json',
 'work/cn-atlas-prefectures.json':'https://raw.githubusercontent.com/BarbarossaWang/cn-atlas/6e83a19923e39f2c0e58a0a7ad29b349b2a71b9f/prefectures.json',
 'work/china-ADM2.geojson':'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/CHN/ADM2/geoBoundaries-CHN-ADM2.geojson',
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await fs.mkdir('work',{recursive:true});
for(const [file,url]of Object.entries(urls)){
 const expected=manifest.tibet.inputs.find(i=>i.file===file)?.sha256;if(!expected)throw Error('Missing pinned input '+file);
 let bytes;try{bytes=await fs.readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!bytes||process.argv.includes('--verify-remote')){
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('GIS download '+response.status);
  const raw=Buffer.from(await response.arrayBuffer()),download=file.includes('cn-atlas-')?Buffer.from(JSON.stringify(JSON.parse(raw.toString('utf8')))+'\n'):raw;
  if(hash(download)!==expected)throw Error('Unreviewed GIS content '+url);
  if(!bytes){bytes=download;await fs.writeFile(file,bytes);}
 }
 if(hash(bytes)!==expected)throw Error('GIS input changed: '+file);
}
console.log('Verified pinned authentic Tibet prefecture/province/county GIS inputs. GeographicLib 2.1 is required for WGS84 area calculation.');
