"""Validate the alternate world against immutable source and approved atlas polygons."""
import hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'work/world-python'))
from shapely.geometry import shape
from shapely.ops import unary_union

def read(name):return json.loads((ROOT/name).read_text(encoding='utf-8'))
def same(a,b,label):assert a.symmetric_difference(b).area<1e-10,label
m=read('app/india-punjab-scenario.json');o=read('server/alternate-world-overrides.geojson')
tibet=read('server/alternate-world-tibet.geojson')
o['features'] += [f for f in tibet['features'] if f['properties']['level'] in ['region','province']]
source=read('work/india-punjab/punjab-source.json')
west={f['properties']['id']:shape(f['geometry']) for f in read('work/india-punjab/western-provinces-source.json')['features']}
assert [len(source[k]['features']) for k in ['district','division','tehsil']]==[48,12,193]
assert m['referencePdf']['matchedDistrictNames']==48
assert m['districtNames']==sorted(f['properties']['name'] for f in source['district']['features'])
for entry in m['inputs']:
 assert hashlib.sha256((ROOT/entry['file']).read_bytes()).hexdigest()==entry['sha256'],entry['file']
assert hashlib.sha256((ROOT/'server/alternate-world-overrides.geojson').read_bytes()).hexdigest()==m['outputSha256']
assert (ROOT/'server/alternate-world-overrides.geojson').stat().st_size<4_500_000,'Protected API response size'
features=read('public/data/world-region.geojson')['features']+read('public/data/world-province.geojson')['features']
base={f['id']:shape(f['geometry']) for f in features};props={f['id']:f['properties'] for f in features}
changed={f['id'] for f in o['features']};new={**base,**{f['id']:shape(f['geometry']) for f in o['features']}}
for ident in m['removedIds']:del new[ident]
assert set(m['addedIds'])==changed-set(base)
assert len(m['removedIds'])==8
assert all(i in m['removedIds'] for i in [m['aksaiId'],*m['kashmirSourceIds'],*m['replacedWesternIds']])
for f in o['features']:
 g=shape(f['geometry']);assert not g.is_empty and g.is_valid and g.geom_type in ['Polygon','MultiPolygon'],f['id']
 if f['id'] in base and f['id']!=m['sindhId']:assert f['properties']['parent']==props[f['id']]['parent']
 if f['id'] in [m['sindhId'],m['multanId'],m['bahawalpurId']]:assert f['properties']['parent']==m['indiaId'] and f['properties']['country']=='India'
assert m['areas'][m['balochistanId']]['level']=='region' and not m['areas'][m['balochistanId']]['parent']
up=unary_union([shape(f['geometry']) for f in source['district']['features']]);ac=base[m['aksaiId']]
jk=shape(read('public/data/in-jammu-kashmir-region.geojson')['features'][0]['geometry'])
ld=shape(read('public/data/in-ladakh-region.geojson')['features'][0]['geometry'])
ld_expected=unary_union([base[m['ladakhId']],ld,ac,base['world-c-114'],base['world-c-121']])
jk_expected=unary_union([base[m['kashmirId']],jk,base[m['kashmirSourceIds'][0]],base[m['kashmirSourceIds'][1]]]).difference(unary_union([ld_expected,new[m['punjabId']]]))
same(new[m['punjabId']],unary_union([up,base[m['punjabId']]]),'Punjab reference footprint unchanged')
same(new[m['ladakhId']],ld_expected,'Complete Ladakh including Aksai Chin unchanged')
same(new[m['kashmirId']],jk_expected,'Combined Jammu & Kashmir unchanged')
prior=unary_union([new[m['punjabId']],ld_expected,jk_expected]);balo_state,pak_punjab=m['replacedWesternIds']
balo=unary_union([west['balochistan'],base[balo_state].difference(unary_union([prior,west['sindh'],west['multan'],west['bahawalpur']]))])
sindh=unary_union([west['sindh'],base[m['sindhId']].difference(unary_union([prior,west['balochistan'],west['multan'],west['bahawalpur']]))]).difference(balo)
multan=west['multan'].difference(unary_union([prior,balo,sindh]));bah=west['bahawalpur'].difference(unary_union([prior,balo,sindh,multan]))
for ident,g in [(m['balochistanId'],balo),(m['sindhId'],sindh),(m['multanId'],multan),(m['bahawalpurId'],bah)]:same(new[ident],g,ident+' approved atlas footprint')
# Canonical Punjab edges take priority over tiny inherited rounding slivers.
for name,g in [('multan',multan),('bahawalpur',bah)]:
 same(west[name].difference(g),west[name].intersection(prior),name+' preserves previous Punjab priority')
 assert west[name].difference(g).area/west[name].area<0.0001
assert west['sindh'].difference(sindh).area<1e-10
assert west['balochistan'].difference(balo).area<1e-10
india_mask=unary_union([prior,sindh,multan,bah,base[pak_punjab]]).difference(balo)
mask=unary_union([india_mask,balo])
same(new[m['indiaId']],unary_union([base[m['indiaId']],india_mask]).difference(balo),'India country union')
assert up.difference(new[m['indiaId']]).area<1e-10
assert ac.difference(new[m['indiaId']]).area<1e-10
explicit={m[k] for k in ['indiaId','punjabId','ladakhId','kashmirId','sindhId','balochistanId','multanId','bahawalpurId']}
for ident,g in new.items():
 if ident not in explicit and ident not in m['addedIds']:
  current_mask=unary_union([mask,new[m['tibet']['id']]]) if ident=='world-c-chn' or props[ident]['parent']=='world-c-chn' else mask
  same(g,base[ident].difference(current_mask) if ident in changed else base[ident],ident+' only requested transfer')
# No overlapping current owners for any requested new territory.
for ident in ['world-c-pak','world-c-chn','world-c-afg','world-c-irn']:
 assert new[ident].intersection(new[m['indiaId']]).difference(base[ident].intersection(base[m['indiaId']])).area<1e-10,ident+' new India overlap'
 assert new[ident].intersection(balo).area<1e-10,ident+' new Balochistan overlap'
 assert new[ident].intersection(mask).area<1e-10,ident+' transferred land still owned'
assert new[m['indiaId']].intersection(balo).area<1e-10
province_ids=[m[k] for k in ['punjabId','ladakhId','kashmirId','sindhId','multanId','bahawalpurId']]
for i,ident in enumerate(province_ids):
 for other in province_ids[i+1:]:
  if ident in [m['punjabId'],m['ladakhId'],m['kashmirId']] and other in [m['punjabId'],m['ladakhId'],m['kashmirId']]:continue # Exact earlier-edition footprints are asserted above.
  overlap=new[ident].intersection(new[other])
  if ident in base and other in base:overlap=overlap.difference(base[ident].intersection(base[other]))
  assert overlap.area<1e-10,(ident,other)
# Land is conserved at country level. Retiring a province into a country does
# not justify inventing first-level subdivisions or filling unmatched fringes.
affected=changed|set(m['removedIds'])
before=unary_union([base[i] for i in affected if i in props and props[i]['level']=='region'])
after=unary_union([new[f['id']] for f in o['features'] if f['properties']['level']=='region'])
same(after,unary_union([before,mask]),'Country-level land conservation')
fringe=india_mask.difference(unary_union([prior,sindh,multan,bah]))
assert abs(fringe.area-m['westernSourceEdges']['countryOnlyIndiaAngularAreaDegrees2'])<1e-10
for level in ['district','division','tehsil']:
 assert all(shape(f['geometry']).difference(up).area<1e-6 for f in source[level]['features']),level
print('Verified independent Balochistan, Sindh/Multan/Bahawalpur in India, exact approved province splits, unchanged Punjab 48/12/193 and Kashmir/Ladakh, valid polygons, conserved country land, no new overlaps, explicit source-edge context and immutable source hashes.')
