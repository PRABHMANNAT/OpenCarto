"""Append the requested peaceful Republic of Tibet to the existing alternate world.
Run after build-india-punjab-scenario.py. No source-world or neighbour GIS is edited.
"""
import hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'work/world-python'))
from shapely.geometry import shape,mapping,Point,Polygon,MultiPolygon
from shapely.ops import unary_union
from geographiclib.geodesic import Geodesic

def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
def write(p,v):(ROOT/p).write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def digest(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def polygon_parts(g):
 return [g] if g.geom_type=='Polygon' else [p for c in getattr(g,'geoms',[]) for p in polygon_parts(c)]
def area(g):
 def ring(r):
  p=Geodesic.WGS84.Polygon()
  for x,y in r.coords:p.AddPoint(y,x)
  return abs(p.Compute(False,True)[2])
 return sum(ring(p.exterior)-sum(ring(r) for r in p.interiors) for p in polygon_parts(g))
def feature(ident,name,g,level,parent='',**extra):
 g=unary_union(polygon_parts(g)) # Drop only zero-area line intersections.
 assert g.is_valid and not g.is_empty and g.geom_type in ['Polygon','MultiPolygon'],ident
 main=max(g.geoms,key=lambda p:p.area) if g.geom_type=='MultiPolygon' else g;pt=main.representative_point()
 p={'id':ident,'name':name,'region':'world','level':level,'parent':parent,'country':'Republic of Tibet','center':[pt.x,pt.y],'bbox':list(g.bounds),'focusBounds':list(main.bounds),'source':'cn-atlas / CTAmap 2023 (ISC/MIT); geoBoundaries CHN county GIS 2017 (PDDL 1.0); CGAZ context. Fictional negotiated assignment.','areaM2':area(g),**extra}
 return {'type':'Feature','id':ident,'properties':p,'geometry':mapping(g),'bbox':list(g.bounds)}
m=read('app/india-punjab-scenario.json');assert 'tibet' not in m,'Rebuild the western-province base first.'
o=read('server/alternate-world-overrides.geojson');original=o['features']
base={f['id']:f for key in ['world-region','world-province'] for f in read('public/data/'+key+'.geojson')['features']}
current={**base,**{f['id']:f for f in original}}
country='world-c-tibet';china='world-c-chn'
protected=['world-c-ind','world-c-npl','world-c-btn'];protected_geo=unary_union([shape(current[i]['geometry']) for i in protected])
china_before=shape(current[china]['geometry']);available=china_before.difference(protected_geo)
world_tar=next(i for i,f in base.items() if f['properties']['parent']==china and f['properties']['name'] in ['Xizang','Tibet','Tibet Autonomous Region','Xizang Autonomous Region'])
pref={f['properties']['id']:f for f in read('work/cn-atlas-prefectures.json')['features']}
prov={f['properties']['id']:f for f in read('work/cn-atlas-provinces.json')['features']}
counties={f['properties']['shapeID']:f for f in read('work/china-ADM2.geojson')['features']}
# Modern administrative units are grouped into three explicit scenario regions.
# This is not a surveyed reconstruction of fluid cultural/linguistic boundaries.
units=[('540100','Lhasa','u-tsang'),('540200','Shigatse','u-tsang'),('540300','Chamdo','kham'),('540400','Nyingchi','u-tsang'),('540500','Shannan','u-tsang'),('540600','Nagqu','u-tsang'),('542500','Ngari','u-tsang'),('632700','Yushu','kham'),('632600','Golog','amdo'),('632500','Hainan','amdo'),('632300','Huangnan','amdo'),('632200','Haibei','amdo'),('632800','Haixi','amdo'),('513300','Garzê','kham'),('513200','Ngawa','amdo'),('623000','Gannan','amdo'),('533400','Diqing','kham'),('17275852B80219081988604','Muli Tibetan Autonomous County','kham'),('17275852B55564857079783','Tianzhu Tibetan Autonomous County','amdo')]
raw={code:shape((pref if code in pref else counties)[code]['geometry']) for code,_,_ in units}
tar=shape(prov['540000']['geometry']) # Canonical administrative source, not a coarser world-context expansion.
raw_union=unary_union([tar,*[raw[c] for c,_,_ in units if not c.startswith('54')]])
territory=raw_union.intersection(available);assert territory.is_valid
# Retain county source polygons first at mismatched 2017/2023 shared edges;
# the reproducible subtraction removes duplicate ownership without moving vertices.
assigned={};taken=Polygon();overlap_report=[]
for code,name,group in sorted(units,key=lambda row:(row[0] in pref,row[0])):
 candidate=raw[code].intersection(territory);g=unary_union(polygon_parts(candidate.difference(taken)))
 overlap_report.append({'code':code,'name':name,'duplicateSourceAreaM2':area(candidate.intersection(taken)) if not candidate.intersection(taken).is_empty else 0})
 assigned[code]=g;taken=unary_union([taken,g])
residual=territory.difference(taken)
# TAR country-context edge fragments are retained explicitly. They are not an
# invented prefecture: the original source cannot identify a prefecture for them.
assert residual.difference(tar).area<1e-9,'Unexpected non-TAR unassigned area'
additions=[]
for code,name,group in units:
 f=(pref if code in pref else counties)[code];p=f['properties'];aliases=[p.get('name') or p['shapeName'],p.get('地名','')]
 additions.append(feature('world-a1-tibet-'+code,name,assigned[code],'province',country,sourceCode=code,sourceLevel='Prefecture-level' if code in pref else 'County-level',sourceValidOn='2023' if code in pref else '2017',originalName=aliases[0],aliases=[a for a in aliases if a],culturalRegion=group))
capital_source=next(f for f in read('public/data/cities.geojson')['features'] if f['properties']['name']=='Lhasa')
capital=capital_source['geometry']['coordinates']
nation=feature(country,'Republic of Tibet',territory,'region',capital='Lhasa',capitalCoordinates=capital,sourceCode='FICTIONAL-TIBET',sourceLevel='FICTIONAL-ADM0',aliases=['Tibet','Republic of Tibet','Bod','Ü-Tsang','Kham','Amdo'],scenario='Hypothetical peaceful, negotiated independence scenario, protecting all existing communities.')
additions.insert(0,nation)
# Only current Chinese country and province polygons lose transferred land.
changed=[];removed=[];before_hashes={}
for ident,f in current.items():
 if ident in m['removedIds'] or (ident!=china and f['properties']['parent']!=china):continue
 g=shape(f['geometry']);after=g.difference(territory)
 if ident==world_tar:
  removed.append(ident);before_hashes[ident]=hashlib.sha256(json.dumps(f['geometry'],sort_keys=True).encode()).hexdigest();continue
 if g.equals(after):continue
 before_hashes[ident]=hashlib.sha256(json.dumps(f['geometry'],sort_keys=True).encode()).hexdigest()
 if after.is_empty or after.area<1e-12:removed.append(ident);continue
 p=f['properties'];changed.append(feature(ident,p['name'],after,p['level'],p['parent'],**{k:v for k,v in p.items() if k not in ['id','name','region','level','parent','center','bbox','focusBounds','source','areaM2']}))
replace_ids={f['id'] for f in changed}|set(removed)
o['features']=[f for f in original if f['id'] not in replace_ids]+changed
# Three aggregate cultural regions cover the country, while the original 19
# administrative source references remain independent selectable first-level units.
groups=[]
for key,name,color in [('u-tsang','Ü-Tsang','#c4aed2'),('kham','Kham','#93c2be'),('amdo','Amdo','#e5b48f')]:
 members=[f for f in additions if f['properties'].get('culturalRegion')==key];g=unary_union([shape(f['geometry']) for f in members]+([residual] if key=='u-tsang' else []))
 groups.append(feature('world-tibet-cultural-'+key,name,g,'cultural',country,color=color,memberIds=[f['id'] for f in members]))
excluded=raw_union.difference(available)
references=[feature('world-tibet-source-reference','Excluded source claims / boundary differences',excluded,'reference',country,qualification='Reference only: excluded from Republic of Tibet area and ownership. Existing international boundaries are unchanged.')]
cities=[]
for f in read('public/data/cities.geojson')['features']:
 if f['geometry']['type']!='Point' or not territory.covers(shape(f['geometry'])):continue
 p=f['properties'];name=p['name'];name={'Xigazê':'Shigatse','Gyêgu':'Yushu (Gyegu)','Changdu':'Chamdo','Nagchu Town':'Nagqu'}.get(name,name)
 cities.append({'type':'Feature','id':'tibet-city-'+str(p['sourceId']),'properties':{'id':'tibet-city-'+str(p['sourceId']),'name':name,'kind':'capital' if name=='Lhasa' else 'city','level':'place','source':'Natural Earth 1:10m populated places; public domain; source coordinates retained','sourceId':p['sourceId']},'geometry':f['geometry']})
mountains=[]
for f in read('public/data/landforms.geojson')['features']:
 if f['properties']['kind']!='mountain':continue
 g=shape(f['geometry']).intersection(territory)
 if g.is_empty:continue
 mountains.append(feature('tibet-'+f['id'],f['properties']['name'],g,'mountain',country,source='Natural Earth physical regions, public domain; schematic range overview, not a surveyed mountain boundary'))
peaks=[]
for peak in read('app/tibet-peak-data.json'):
 assert territory.covers(Point(peak['coordinates'])),peak['name']+' outside country'
 peaks.append({'type':'Feature','id':peak['id'],'properties':{'id':peak['id'],'name':peak['name'],'level':'peak','source':peak['source'],'sourceUrl':peak['url']},'geometry':{'type':'Point','coordinates':peak['coordinates']}})
tibet={'type':'FeatureCollection','features':additions+groups+references+cities+mountains+peaks}
write('server/alternate-world-overrides.geojson',o);write('server/alternate-world-tibet.geojson',tibet)
for f in changed+additions:m['areas'][f['id']]=f['properties']
for ident in removed:m['areas'].pop(ident,None)
m['removedIds']+=removed;m['addedIds']+=[f['id'] for f in additions]
m['revision']='alternate-world-tibet-republic-2026-10-29';m['notes']+=' Republic of Tibet is independent with Lhasa as capital in a hypothetical peaceful negotiated settlement, protecting all existing communities. India, Nepal and Bhutan are unchanged; excluded source claims are a separate reference.'
m['tibet']={'id':country,'capital':'Lhasa','capitalCoordinates':capital,'areaM2':nation['properties']['areaM2'],'areaMethod':'GeographicLib 2.1 / Karney, WGS84 ellipsoid, geodesic polygon exteriors minus holes; measured from this pinned GIS edition, not exact ground-survey truth.','unitIds':[f['id'] for f in additions[1:]],'regions':[f['properties'] for f in groups],'scenario':nation['properties']['scenario'],'regionMethod':'Explicit fictional grouping by whole modern administrative unit. Chamdo, Yushu, Garzê, Muli and Diqing form Kham; the five other Qinghai prefectures, Ngawa, Gannan and Tianzhu form Amdo; remaining TAR units including Nyingchi form Ü-Tsang. Cultural boundaries are fluid, not surveyed administrative lines.','protectedCountryIds':protected,'countryContextEdgeAreaM2':area(residual),'retiredTARSourceContextAreaM2':area(shape(current[world_tar]['geometry']).difference(territory).intersection(china_before)),'excludedReferenceAreaM2':area(excluded),'overlaps':overlap_report,'beforeGeometryHashes':before_hashes,'sourceWorldTarId':world_tar,'sourceDates':['2023 prefectures','2017 Muli/Tianzhu counties','CGAZ source world snapshot'],'credits':['cn-atlas / CTAmap (ISC/MIT)','geoBoundaries / NASG / Revolutionary GIS (PDDL 1.0)','Natural Earth cities and physical regions (public domain)','GeoNames peak coordinates (CC BY 4.0)'],'sources':['https://github.com/BarbarossaWang/cn-atlas/tree/6e83a19923e39f2c0e58a0a7ad29b349b2a71b9f','https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM2/','https://texts.mandala.library.virginia.edu/text/cultural-regions-tibet','https://www.naturalearthdata.com/about/terms-of-use/','https://www.geonames.org/about.html'],'inputs':[{'file':p,'sha256':digest(p)} for p in ['work/cn-atlas-provinces.json','work/cn-atlas-prefectures.json','work/china-ADM2.geojson','public/data/cities.geojson','public/data/landforms.geojson','app/tibet-peak-data.json']],'outputSha256':digest('server/alternate-world-tibet.geojson')}
m['outputSha256']=digest('server/alternate-world-overrides.geojson');write('app/india-punjab-scenario.json',m)
print('Republic of Tibet:',round(m['tibet']['areaM2']/1e6,2),'km2; 19 units, 3 regions;',len(cities),'cities;',len(mountains),'mountain ranges; removed',removed)
print('Protected file sizes:',(ROOT/'server/alternate-world-overrides.geojson').stat().st_size,(ROOT/'server/alternate-world-tibet.geojson').stat().st_size)
print('Context edges km2',area(residual)/1e6,'excluded reference km2',area(excluded)/1e6)
