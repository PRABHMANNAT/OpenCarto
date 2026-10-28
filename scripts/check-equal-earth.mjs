import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {geoArea,geoPath} from 'd3-geo';
import {loadLocalModule} from './load-map-model.mjs';
const {worldProjection,sphericalFeature,worldSphere}=await loadLocalModule(new URL('../app/world-equal-earth.ts',import.meta.url));
const data=JSON.parse(await fs.readFile(new URL('../public/data/world-region.geojson',import.meta.url),'utf8'));
const byCode=new Map(data.features.map(f=>[f.properties.sourceParentCode,f]));
const africaCodes='DZA AGO BEN BWA BFA BDI CMR CPV CAF TCD COM COD COG DJI EGY GNQ ERI SWZ ETH GAB GMB GHA GIN GNB CIV KEN LSO LBR LBY MDG MWI MLI MRT MUS MAR MOZ NAM NER NGA RWA STP SEN SYC SLE SOM ZAF SSD SDN TZA TGO TUN UGA ZMB ZWE ESH'.split(' ');
for(const code of africaCodes)assert.ok(byCode.has(code),'Africa source record '+code);
const collections={Greenland:[byCode.get('GRL')],Africa:africaCodes.map(c=>byCode.get(c)),Australia:[byCode.get('AUS')],Antarctica:[byCode.get('ATA')]};
const geographic=Object.fromEntries(Object.entries(collections).map(([name,features])=>[name,features.reduce((sum,f)=>sum+geoArea(sphericalFeature(f)),0)]));
const originals=JSON.stringify(data);
const audit=[];
for(const [width,height] of [[1200,660],[1600,600],[390,280],[700,1000]]){
  const projection=worldProjection().fitExtent([[20,20],[width-20,height-20]],worldSphere),path=geoPath(projection);
  const projected=Object.fromEntries(Object.entries(collections).map(([name,features])=>[name,features.reduce((sum,f)=>sum+path.area(sphericalFeature(f)),0)]));
  for(const other of ['Africa','Australia','Antarctica']){
    const expected=geographic.Greenland/geographic[other],actual=projected.Greenland/projected[other],relativeError=Math.abs(actual/expected-1);
    assert.ok(relativeError<.0025,`${width}x${height}: Greenland/${other} area ratio error ${relativeError}`);
    audit.push({viewport:[width,height],comparison:'Greenland / '+other,geographicRatio:expected,projectedRatio:actual,relativeError});
  }
  const bounds=path.bounds(worldSphere);assert.ok(bounds[0][0]>=19.99&&bounds[1][0]<=width-19.99&&bounds[0][1]>=19.99&&bounds[1][1]<=height-19.99);
}
assert.equal(JSON.stringify(data),originals,'Source coordinates are not mutated');
for(const code of ['RUS','USA','FJI','KIR']){
  const feature=byCode.get(code);assert.ok(feature,code);
  let point=null,start=null,maxSegment=0,moves=0;
  const record={moveTo(x,y){point=start=[x,y];moves++;},lineTo(x,y){if(point)maxSegment=Math.max(maxSegment,Math.hypot(x-point[0],y-point[1]));point=[x,y];},closePath(){if(point&&start)maxSegment=Math.max(maxSegment,Math.hypot(point[0]-start[0],point[1]-start[1]));},arc(){}};
  geoPath(worldProjection(),record)(sphericalFeature(feature));
  assert.ok(moves>1,code+' multipart/antimeridian paths remain separate');
  assert.ok(maxSegment<500,code+' has no map-spanning antimeridian segment: '+maxSegment);
}
await fs.mkdir('outputs/world-map',{recursive:true});
await fs.writeFile('outputs/world-map/equal-earth-area-audit.json',JSON.stringify({projection:'Equal Earth',geographicMethod:'Spherical polygon area from the same WGS84 source coordinates (D3 geoArea); no screen-area input',africaCodes,geographicMillionKm2:Object.fromEntries(Object.entries(geographic).map(([n,a])=>[n,a*6371.0088**2/1e6])),cases:audit},null,2));
console.log('Equal Earth area ratios verified across four aspect ratios; maximum relative error '+(100*Math.max(...audit.map(c=>c.relativeError))).toFixed(5)+'%. Antarctica retained; Russia, Alaska/USA, Fiji and Kiribati pass antimeridian checks.');
