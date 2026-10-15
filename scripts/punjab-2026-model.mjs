import {balancePopulation} from './punjab-population-model.mjs';

// Fictional development parameters, not measured economic or census indicators.
// Columns: settlement base, archetype, Sikh/Hindu/Muslim prior weights.
export const districtParameters = {
  Lahore: [11.5, 'metropolis', 72, 21, 7], Sandalbar: [9, 'industrial', 78, 17, 5],
  Ranjitgarh: [5.6, 'industrial', 73, 23, 4], Rawalpindi: [5.2, 'corridor', 64, 29, 7],
  Ludhiana: [5.2, 'industrial', 66, 31, 3], Harappa: [5, 'agricultural', 75, 19, 6],
  Sargodha: [4.2, 'agricultural', 73, 20, 7], Jhang: [3.2, 'riverine', 75, 16, 9],
  'Sacha Sauda': [3, 'industrial', 87, 10, 3], 'Babe Di Ber': [3.1, 'industrial', 78, 18, 4],
  'Bulleh Shah': [3, 'riverine', 76, 13, 11], Dinga: [2.8, 'corridor', 69, 26, 5],
  Jalandhar: [3.1, 'industrial', 59, 38, 3], Amritsar: [2.9, 'corridor', 93, 5, 2],
  Patiala: [2.8, 'corridor', 72, 25, 3], Sangrur: [3.3, 'agricultural', 77, 17, 6],
  Hoshiarpur: [2.3, 'foothill', 52, 45, 3], Bathinda: [2.2, 'industrial', 85, 12, 3],
  'Panja Sahib': [1.8, 'foothill', 94, 4, 2], Katas: [1.7, 'foothill', 45, 51, 4],
  Chenab: [1.7, 'riverine', 77, 19, 4], 'Rori Sahib': [1.6, 'agricultural', 89, 8, 3],
  Jhelum: [1.8, 'corridor', 70, 25, 5], Khushab: [1.6, 'dryland', 69, 24, 7],
  'Kair Sahib': [1.6, 'agricultural', 76, 20, 4], 'Nankana Sahib': [1.6, 'agricultural', 92, 6, 2],
  'Kartarpur Sahib': [1.7, 'riverine', 94, 4, 2], Nanaksar: [1.6, 'riverine', 75, 15, 10],
  Taxila: [0.65, 'corridor', 65, 31, 4], 'Toba Tek Singh': [2, 'agricultural', 78, 18, 4],
  'Sri Anandpur Sahib': [0.9, 'foothill', 91, 7, 2], Rupnagar: [1.0, 'foothill', 79, 18, 3],
  Mansa: [1.3, 'agricultural', 79, 18, 3], 'Sri Muktsar Sahib': [1.5, 'agricultural', 89, 8, 3],
  'S A S Nagar': [1.7, 'metropolis', 52, 45, 3], Faridkot: [1.1, 'agricultural', 80, 17, 3],
  Moga: [1.7, 'agricultural', 80, 17, 3], 'Shahid Bhagat Singh Nagar': [1.0, 'foothill', 57, 40, 3],
  Kapurthala: [1.5, 'corridor', 78, 19, 3], 'Fatehgarh Sahib': [0.9, 'corridor', 91, 7, 2],
  Ferozepur: [1.5, 'agricultural', 80, 17, 3], Gurdaspur: [1.7, 'riverine', 87, 10, 3],
  'Tarn Taran': [1.4, 'agricultural', 94.5, 4, 1.5], Fazilka: [1.6, 'dryland', 60, 37, 3],
  Pathankot: [1.1, 'foothill', 40, 57, 3], Haripur: [2.6, 'foothill', 70, 22, 8],
  'Akali Phula Singh': [2, 'foothill', 77, 17, 6], Hazarawala: [2.5, 'mountain', 69, 21, 10],
};
// Agriculture, industry, corridor connectivity, water, terrain accessibility,
// rural-hub urban odds. All are explicitly fictional comparative ratings.
export const archetypes = {
  metropolis: [0.8, 1.7, 1.8, 1.4, 1, 0.65], industrial: [1.1, 1.6, 1.6, 1.35, 1, 0.40],
  agricultural: [1.6, 0.75, 1.05, 1.5, 1, 0.19], riverine: [1.5, 0.8, 1.05, 1.65, 1, 0.22],
  corridor: [1.1, 1.25, 1.7, 1.25, 1, 0.38], foothill: [1.0, 0.85, 1.05, 1.1, 0.78, 0.25],
  dryland: [0.85, 0.65, 0.9, 0.7, 0.9, 0.19], mountain: [0.7, 0.45, 0.8, 1.1, 0.65, 0.18],
};
const cityCores = {
  Lahore: ['Lahore', 'Lahore Cantt', 'Model Town', 'Ravi', 'Sabzazar', 'Saddar', 'Shalimar', 'Green Town'],
  Ludhiana: ['Ludhiana East', 'Ludhiana West'], Amritsar: ['Amritsar I', 'Amritsar II'],
  Jalandhar: ['Jalandhar I', 'Jalandhar II'], 'S A S Nagar': ['Mohali', 'Kharar'],
};
const highSikhTehsils = {'Talwandi Sabo': 96.8, 'Anandpur Sahib': 96.9, 'Tarn Taran': 96,
  'Khadur Sahib': 96, 'Kartarpur Sahib': 96.5, 'Panja Sahib': 96, 'Nankana Sahib': 95.5,
  'Amritsar I': 94.5, 'Amritsar II': 94.5, 'Dera Baba Nanak': 95, 'Sultanpur Lodhi': 95,
  'Fatehgarh Sahib': 95, 'Chamkaur Sahib': 95, Muktsar: 94.5, 'Baba Bakala': 95, 'Sacha Sauda': 95};
const hinduTehsils = {Abohar: 64, Pathankot: 62, 'Dhar Kalan': 53, Hoshiarpur: 52,
  Jalandhar: 46, 'Jalandhar I': 48, 'Jalandhar II': 48, Nawanshahr: 50, Mohali: 53,
  'Kharar': 47, Malot: 63, 'Kallar Kahar': 52, Chakwal: 46, Tamman: 45};
const christianDistricts = new Set(['Lahore','Rawalpindi','Sandalbar','Babe Di Ber','Amritsar','Ludhiana','Jalandhar','Ranjitgarh']);
export function apportion(total, weights, ids = weights.map((_, i) => String(i))) {
  if (!Number.isSafeInteger(total) || total < 0 || weights.some(w => !Number.isSafeInteger(w) || w < 0)) throw Error('Integer apportionment requires integer inputs');
  const denominator = weights.reduce((sum, w) => sum + BigInt(w), 0n);
  if (!denominator) throw Error('Empty apportionment weights');
  const products = weights.map(w => BigInt(total) * BigInt(w));
  const counts = products.map(value => Number(value / denominator));
  const order = products.map((value, i) => ({i, remainder: value % denominator})).sort((a,b) =>
    a.remainder === b.remainder ? ids[a.i].localeCompare(ids[b.i]) : a.remainder > b.remainder ? -1 : 1);
  const left = total - counts.reduce((a,b) => a+b,0);
  for (let i=0; i<left; i++) counts[order[i].i]++;
  return counts;
}
function capacity(tehsil, district, number) {
  const parameter = districtParameters[district.name];
  if (!parameter) throw Error('No fictional settlement parameter: ' + district.name);
  const [base, type] = parameter;
  const [agriculture, industry, connectivity, water, accessibility, hubUrban] = archetypes[type];
  const core = cityCores[district.name]?.includes(tehsil.name) || tehsil.name === district.capital || tehsil.name === district.name;
  let centrality = core ? 1.7 : 0.9, terrain = accessibility;
  let urbanPrior = core ? Math.max(0.62, hubUrban + 0.25) : hubUrban;
  if (district.name === 'Rawalpindi' && tehsil.name === 'Rawalpindi') {centrality=4; urbanPrior=0.88;}
  if (district.name === 'Sandalbar' && tehsil.name === 'Sandalbar') {centrality=3.8; urbanPrior=0.88;}
  if (district.name === 'Ranjitgarh' && tehsil.name === 'Ranjitgarh') {centrality=2.8; urbanPrior=0.84;}
  if (district.name === 'Ludhiana' && core) {centrality=2.8; urbanPrior=0.87;}
  if (tehsil.name === 'Murree') {terrain=0.25; centrality=0.8; urbanPrior=0.28;}
  if (tehsil.name === 'Balakot') {terrain=0.18; centrality=0.8; urbanPrior=0.13;}
  if (['Haro','Sherwan'].includes(tehsil.name) && district.name === 'Haripur') {terrain=0.38; urbanPrior=0.16;}
  if (district.name === 'Haripur' && ['Abbottabad','Haripur'].includes(tehsil.name)) {centrality=1.8; terrain=0.92; urbanPrior=0.65;}
  const score = Math.max(1, Math.round(base / number * centrality * (agriculture+industry+connectivity+water)/4 * terrain * 1000000));
  return {score, archetype:type, districtSettlementBase:base, centrality, agriculture, industry, connectivity, water, terrainAccessibility:terrain, urbanPrior,
    basis:'Editorial fictional settlement-capacity ratings; not measured infrastructure or present-day religious data.'};
}
function priors(tehsil, district, inputs) {
  let [sikh,hindu,muslim] = districtParameters[district.name].slice(2);
  if (highSikhTehsils[tehsil.name]) {sikh=highSikhTehsils[tehsil.name]; muslim=Math.min(muslim,1); hindu=100-sikh-muslim;}
  if (hinduTehsils[tehsil.name]) {hindu=hinduTehsils[tehsil.name]; sikh=100-hindu-muslim;}
  if (tehsil.name === 'Malerkotla') {sikh=25; hindu=7; muslim=68;}
  if (district.name === 'Bulleh Shah' && tehsil.name === 'Kasur') {sikh=65; hindu=15; muslim=20;}
  if (district.name === 'Nanaksar' && tehsil.name === 'Ajodhan') {sikh=64; hindu=14; muslim=22;}
  let buddhist=0.015, christian=christianDistricts.has(district.name) ? 0.20 : 0.025;
  if (tehsil.name === 'Taxila') buddhist=8;
  if (tehsil.name === 'Ranigat') buddhist=4;
  if (district.name === 'Hazarawala' && ['Mansehra','Pakhli'].includes(tehsil.name)) buddhist=2;
  if (district.name === 'Rawalpindi' && tehsil.name === 'Rawalpindi') buddhist=0.12;
  christian *= inputs.urbanPrior > 0.6 ? 1.4 : 0.8;
  return [Math.max(sikh,0.2), Math.max(hindu,0.2), muslim, buddhist, christian, inputs.urbanPrior > 0.6 ? 0.20 : 0.09];
}
export function generateScenario(input, config) {
  const districts=[...input.districts].sort((a,b)=>a.id.localeCompare(b.id));
  const tehsils=[...input.tehsils].sort((a,b)=>a.id.localeCompare(b.id));
  const byDistrict=new Map(districts.map(d=>[d.id,d]));
  const members=new Map(districts.map(d=>[d.id,tehsils.filter(t=>t.parentDistrictId===d.id)]));
  const inputs=tehsils.map(t=>capacity(t,byDistrict.get(t.parentDistrictId),members.get(t.parentDistrictId).length));
  const weights=new Map(tehsils.map((t,i)=>[t.id,inputs[i].score]));
  const districtCapacity=d=>members.get(d.id).reduce((s,t)=>s+weights.get(t.id),0);
  const divisions=[...input.divisions].sort((a,b)=>a.id.localeCompare(b.id));
  const divisionWeights=divisions.map(v=>districts.filter(d=>d.division===v.name).reduce((s,d)=>s+districtCapacity(d),0));
  const divisionTotals=apportion(config.total,divisionWeights,divisions.map(d=>d.id));
  const districtTotals=new Map();
  divisions.forEach((v,i)=>{
    const ds=districts.filter(d=>d.division===v.name);
    const totals=apportion(divisionTotals[i],ds.map(districtCapacity),ds.map(d=>d.id));
    ds.forEach((d,j)=>districtTotals.set(d.id,totals[j]));
  });
  const tehsilTotals=new Map();
  for (const d of districts) {
    const ts=members.get(d.id), totals=apportion(districtTotals.get(d.id),ts.map(t=>weights.get(t.id)),ts.map(t=>t.id));
    ts.forEach((t,i)=>tehsilTotals.set(t.id,totals[i]));
  }
  const rowTotals=tehsils.map(t=>tehsilTotals.get(t.id));
  const seedPriors=tehsils.map((t,i)=>priors(t,byDistrict.get(t.parentDistrictId),inputs[i]));
  const religions=balancePopulation(rowTotals,config.religions.map(r=>r.population),seedPriors);
  const urbanRural=balancePopulation(rowTotals,[config.urbanPopulation,config.total-config.urbanPopulation],inputs.map(i=>[i.urbanPrior,1-i.urbanPrior]));
  const demographic=(total, counts, urbanCounts, area)=>({
    version:config.version, year:config.year, total, urbanPopulation:urbanCounts.reduce((a,b)=>a+b,0),
    ruralPopulation:total-urbanCounts.reduce((a,b)=>a+b,0), urbanPercent:urbanCounts.reduce((a,b)=>a+b,0)/total*100,
    density:area>0 ? total/area : null,
    religions:config.religions.map((r,j)=>({key:r.key,name:r.name,population:counts[j],percentage:counts[j]/total*100,urbanPopulation:urbanCounts[j],ruralPopulation:counts[j]-urbanCounts[j],color:r.color})),
    largestCommunity:config.religions[counts.indexOf(Math.max(...counts))].key, note:config.note,
  });
  const rows=tehsils.map((t,i)=>{
    const urbanCounts=apportion(urbanRural[i][0],religions[i],config.religions.map(r=>r.key));
    return {...t,historicalRegion:t.historicalRegionId==='punjab-region-pothohar'?'Pothohar–Gandhara':t.historicalRegion,level:'tehsil',hypotheticalDemographics:demographic(rowTotals[i],religions[i],urbanCounts,t.areaKm2),settlementAssumptions:{...inputs[i],religionPriors:seedPriors[i]}};
  });
  const aggregate=(p,level,children)=>{
    const counts=config.religions.map((_,j)=>children.reduce((s,c)=>s+c.hypotheticalDemographics.religions[j].population,0));
    const urbanCounts=config.religions.map((_,j)=>children.reduce((s,c)=>s+c.hypotheticalDemographics.religions[j].urbanPopulation,0));
    return {...p,level,hypotheticalDemographics:demographic(children.reduce((s,c)=>s+c.hypotheticalDemographics.total,0),counts,urbanCounts,p.areaKm2)};
  };
  const districtRows=districts.map(d=>aggregate({...d,historicalRegion:d.historicalRegionId==='punjab-region-pothohar'?'Pothohar–Gandhara':d.historicalRegion},'district',rows.filter(t=>t.parentDistrictId===d.id)));
  const divisionRows=divisions.map(d=>aggregate(d,'division',districtRows.filter(t=>t.division===d.name)));
  const regionRows=input.regions.map(r=>aggregate({...r,name:r.id==='punjab-region-pothohar'?'Pothohar–Gandhara':r.name},'region',districtRows.filter(d=>r.memberDistrictIds.includes(d.id))));
  const province=aggregate(input.province,'province',districtRows);
  const citySpecifications=[['Lahore','Lahore',4500000],['Sandalbar','Sandalbar',2200000],['Ludhiana','Ludhiana',1500000],['Rawalpindi','Rawalpindi',1300000],['Ranjitgarh','Ranjitgarh',1200000],['Amritsar','Amritsar',1000000],['Jalandhar','Jalandhar',750000],['Patiala','Patiala',550000]];
  const cities=citySpecifications.map(([name,districtName,wanted])=>{
    const d=districtRows.find(d=>d.name===districtName);
    const core=rows.filter(t=>t.parentDistrictId===d.id && (cityCores[districtName]?.includes(t.name) || t.name===name));
    const urbanInventory=core.map(t=>t.hypotheticalDemographics.urbanPopulation);
    const available=urbanInventory.reduce((a,b)=>a+b,0);
    const total=name==='Lahore'?wanted:Math.min(wanted,Math.floor(available*0.9));
    if (total>available || !core.length) throw Error(name+' city exceeds its constituent urban inventory: '+available);
    const parts=apportion(total,urbanInventory,core.map(t=>t.id));
    const byReligion=config.religions.map(()=>0);
    core.forEach((t,i)=>{
      const counts=apportion(parts[i],t.hypotheticalDemographics.religions.map(r=>r.urbanPopulation),config.religions.map(r=>r.key));
      counts.forEach((n,j)=>byReligion[j]+=n);
    });
    const sourcePlace=input.places.find(p=>p.properties.kind==='city' && [name,d.capital].includes(p.properties.name));
    return {id:'fictional-city-'+d.id,name,level:'city',district:d.name,parentDistrictId:d.id,division:d.division,historicalRegion:d.historicalRegion,
      coordinates:sourcePlace?.geometry.coordinates || (name==='Lahore'?input.province.capitalCoordinates:null), bbox:d.bbox, coreTehsilIds:core.map(t=>t.id),
      coreAllocations:core.map((t,i)=>({tehsilId:t.id,population:parts[i]})),
      basis:'Illustrative fictional city estimate, a subset of the listed tehsil urban populations. No city boundary or census is implied; it is not additive to administrative totals.',
      ...(name==='Lahore'?{developmentProfile:config.lahoreCityDevelopment}:{}),
      hypotheticalDemographics:demographic(total,byReligion,byReligion,null)};
  });
  for(const row of [province,...districtRows,...divisionRows,...regionRows,...rows]) {
    row.hypotheticalPopulation={total:row.hypotheticalDemographics.total,note:config.note};
    row.density=row.hypotheticalDemographics.density;
  }
  return {province,districts:districtRows,divisions:divisionRows,regions:regionRows,tehsils:rows,cities,
    model:{...config,districtParameters,archetypes,tehsilAssumptions:rows.map(t=>({id:t.id,name:t.name,district:t.district,...t.settlementAssumptions})),
      cityMethod:'Explicit subsets of modelled tehsil urban religious inventories; cities are not another population margin.',
      religionMethod:config.religionMethod,capacityFormula:config.capacityFormula}};
}
