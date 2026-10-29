"""Validate the hypothetical India edition against its immutable GIS inputs."""
import hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'work/world-python'))
from shapely.geometry import shape
from shapely.ops import unary_union

def read(name):return json.loads((ROOT/name).read_text(encoding='utf-8'))
def same(a,b,label):assert a.symmetric_difference(b).area<1e-10,label
m=read('app/india-punjab-scenario.json');o=read('public/data/india-punjab-world-overrides.geojson')
source=read('work/india-punjab/punjab-source.json')
assert [len(source[k]['features']) for k in ['district','division','tehsil']]==[48,12,193]
assert m['referencePdf']['matchedDistrictNames']==48
assert m['districtNames']==sorted(f['properties']['name'] for f in source['district']['features'])
for entry in m['inputs'][:2]:
 assert hashlib.sha256((ROOT/entry['file']).read_bytes()).hexdigest()==entry['sha256'],entry['file']
assert hashlib.sha256((ROOT/'public/data/india-punjab-world-overrides.geojson').read_bytes()).hexdigest()==m['outputSha256']
features=read('public/data/world-region.geojson')['features']+read('public/data/world-province.geojson')['features']
base={f['id']:shape(f['geometry']) for f in features};props={f['id']:f['properties'] for f in features}
new={**base,**{f['id']:shape(f['geometry']) for f in o['features']}}
for ident in m['removedIds']:del new[ident]
assert m['removedIds']==[m['aksaiId']]
for f in o['features']:
 g=shape(f['geometry']);assert not g.is_empty and g.is_valid and g.geom_type in ['Polygon','MultiPolygon'],f['id']
 assert f['properties']['parent']==props[f['id']]['parent']
up=unary_union([shape(f['geometry']) for f in source['district']['features']]);ac=base[m['aksaiId']]
mask=unary_union([up,base[m['punjabId']],ac])
same(new[m['punjabId']],unary_union([up,base[m['punjabId']]]),'Punjab reference footprint')
same(new[m['ladakhId']],unary_union([base[m['ladakhId']],ac]),'Aksai Chin in Ladakh')
same(new[m['indiaId']],unary_union([base[m['indiaId']],up,base[m['punjabId']],ac]),'India union')
assert up.difference(new[m['indiaId']]).area<1e-10
assert ac.difference(new[m['indiaId']]).area<1e-10
changed={f['id'] for f in o['features']}
for ident,g in new.items():
 if ident not in [m['indiaId'],m['punjabId'],m['ladakhId']]:same(g,base[ident].difference(mask) if ident in changed else base[ident],ident+' only requested transfer')
# Source-resolution overlaps outside the transfer are retained, never expanded.
for ident in ['world-c-pak','world-c-chn']:
 before=base[ident].intersection(base[m['indiaId']]);after=new[ident].intersection(new[m['indiaId']])
 assert after.difference(before).area<1e-10,ident+' new overlap'
 assert new[ident].intersection(mask).area<1e-10,ident+' transferred land still owned'
# The two polygon sets retain exactly the same total land, with no introduced gap.
for level in ['region','province']:
 affected=changed|set(m['removedIds']);before=unary_union([base[i] for i in affected if props[i]['level']==level]);after=unary_union([new[i] for i in changed if props[i]['level']==level])
 same(after,unary_union([before,up,ac]),level+' land conservation')
# Canonical tehsil edges have inherited rounding slivers (maximum 4.35e-7
# square degrees, Taxila). Retain them without altering approved detailed GIS.
for level in ['district','division','tehsil']:
 assert all(shape(f['geometry']).difference(up).area<1e-6 for f in source[level]['features']),level
print('Verified exact PDF Punjab footprint, 48/12/193 hierarchy, complete Aksai Chin in Ladakh and India, valid polygons, conserved land, no new country overlap, unchanged source files and no transfers beyond the requested mask.')
