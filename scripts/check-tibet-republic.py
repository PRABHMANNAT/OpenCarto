"""Independent geometry, area and preservation checks for the Tibet scenario."""
import hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'work/world-python'))
from shapely.geometry import shape,Point
from shapely.ops import unary_union
from geographiclib.geodesic import Geodesic

def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
def same(a,b,label):assert a.symmetric_difference(b).area<1e-9,label
def polygons(g):return [g] if g.geom_type=='Polygon' else [p for sub in getattr(g,'geoms',[]) for p in polygons(sub)]
def area(g):
 total=0
 for p in polygons(g):
  for i,r in enumerate([p.exterior,*p.interiors]):
   acc=Geodesic.WGS84.Polygon()
   for x,y in r.coords:acc.AddPoint(y,x)
   total+=(1 if i==0 else -1)*abs(acc.Compute(False,True)[2])
 return total
m=read('app/india-punjab-scenario.json');t=m['tibet'];geo=read('server/alternate-world-tibet.geojson')['features'];byid={f['id']:f for f in geo};world=read('server/alternate-world-overrides.geojson')['features']
base={f['id']:f for key in ['world-region','world-province'] for f in read('public/data/'+key+'.geojson')['features']};current={**base,**{f['id']:f for f in world}}
for entry in t['inputs']:assert hashlib.sha256((ROOT/entry['file']).read_bytes()).hexdigest()==entry['sha256'],entry['file']
assert hashlib.sha256((ROOT/'server/alternate-world-tibet.geojson').read_bytes()).hexdigest()==t['outputSha256']
assert all((ROOT/p).stat().st_size<4_500_000 for p in ['server/alternate-world-overrides.geojson','server/alternate-world-tibet.geojson'])
for f in geo:
 g=shape(f['geometry']);assert g.is_valid and not g.is_empty,f['id']
 if g.geom_type!='Point':assert g.geom_type in ['Polygon','MultiPolygon'],f['id']
assert len(t['unitIds'])==len(set(t['unitIds']))==19
assert len(t['regions'])==3
units=[byid[i] for i in t['unitIds']];country=shape(byid[t['id']]['geometry']);new_china=shape(current['world-c-chn']['geometry'])
assert abs(area(country)-t['areaM2'])<.1
assert byid[t['id']]['properties']['capital']=='Lhasa'
assert country.covers(Point(t['capitalCoordinates']))
assert any(f['properties'].get('kind')=='capital' and f['properties']['name']=='Lhasa' for f in geo)
assert len([f for f in geo if f['properties']['level']=='place'])==12
assert len([f for f in geo if f['properties']['level']=='mountain'])==5
assert len([f for f in geo if f['properties']['level']=='peak'])==3
assert {f['properties']['sourceCode'] for f in units}=={'540100','540200','540300','540400','540500','540600','542500','632700','632600','632500','632300','632200','632800','513300','513200','623000','533400','17275852B80219081988604','17275852B55564857079783'}
# Existing world edition's India includes all earlier approved fictional edits.
protected=unary_union([shape(current[i]['geometry']) for i in t['protectedCountryIds']])
assert country.intersection(protected).area<1e-10
west_mask=unary_union([shape(current[m[k]]['geometry']) for k in ['punjabId','ladakhId','kashmirId','sindhId','multanId','bahawalpurId','balochistanId']]+[shape(base[m['replacedWesternIds'][1]]['geometry'])])
china_before=shape(base['world-c-chn']['geometry']).difference(west_mask)
same(new_china,china_before.difference(country),'China loses exactly Tibet')
same(unary_union([new_china,country]),china_before,'China/Tibet conserve country coverage')
for ident in ['world-c-npl','world-c-btn']:
 assert current[ident]['geometry']==base[ident]['geometry'],ident+' borders unchanged'
for ident in [m['indiaId'],m['punjabId'],m['kashmirId'],m['ladakhId'],m['balochistanId'],m['sindhId'],m['multanId'],m['bahawalpurId']]:assert ident not in t['beforeGeometryHashes'],ident+' unchanged by Tibet operation'
for i,f in enumerate(units):
 g=shape(f['geometry']);assert g.difference(country).area<1e-10
 for other in units[i+1:]:assert g.intersection(shape(other['geometry'])).area<1e-10,(f['id'],other['id'])
regions=[shape(byid[r['id']]['geometry']) for r in t['regions']]
same(unary_union(regions),country,'Three cultural groups cover exactly Tibet')
for i,g in enumerate(regions):
 for other in regions[i+1:]:assert g.intersection(other).area<1e-10
assert abs(sum(area(g) for g in regions)-t['areaM2'])<t['areaM2']*1e-8 # Geodesic integrations differ slightly when planar clipping inserts shared-edge vertices.
assert {i for r in t['regions'] for i in r['memberIds']}==set(t['unitIds'])
# No selected county is approximated by a district or whole province.
pref={f['properties']['id']:shape(f['geometry']) for f in read('work/cn-atlas-prefectures.json')['features']};counties={f['properties']['shapeID']:shape(f['geometry']) for f in read('work/china-ADM2.geojson')['features']};tar=next(shape(f['geometry']) for f in read('work/cn-atlas-provinces.json')['features'] if f['properties']['id']=='540000')
requested=unary_union([tar,*[(pref if f['properties']['sourceCode'] in pref else counties)[f['properties']['sourceCode']] for f in units if not f['properties']['sourceCode'].startswith('54')]])
same(country,requested.intersection(china_before.difference(protected)),'Exact requested source administrative union')
reference=shape(next(f['geometry'] for f in geo if f['properties']['level']=='reference'))
assert reference.intersection(country).area<1e-10
same(unary_union([country,reference]),requested,'Excluded source territory is explicitly retained as reference')
assert 'protecting all existing communities' in t['scenario']
print('Verified Republic of Tibet: %.2f km2 WGS84; 19 exact source units, 3 covering/non-overlapping cultural groups, capital Lhasa, 12 cities, 5 physical ranges, protected borders, China subtraction/land conservation, independent excluded-reference geometry, source hashes and API payload limits.'%(t['areaM2']/1e6))
