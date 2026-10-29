"""Repair display labels only; preserve every original GIS coordinate and ID."""
import json,hashlib,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8-sig'))
def write(p,v):(ROOT/p).write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
fixes=read('app/world-name-corrections.json')['records']
def repair(p):
 if p.get('id') in fixes:
  entry=fixes[p['id']];assert p['name'] in [entry['original'],entry['name']],p['id'];p.update(name=entry['name'],originalName=entry['original'])
audit=[]
for key in ['world-region','world-province']:
 path='public/data/'+key+'.geojson';v=read(path);before=hashlib.sha256(json.dumps([(f['id'],f['geometry']) for f in v['features']],separators=(',',':')).encode()).hexdigest()
 for f in v['features']:repair(f['properties'])
 after=hashlib.sha256(json.dumps([(f['id'],f['geometry']) for f in v['features']],separators=(',',':')).encode()).hexdigest();assert before==after
 write(path,v);labels=read('public/data/'+key+'-labels.geojson')
 for f in labels['features']:repair(f['properties'])
 write('public/data/'+key+'-labels.geojson',labels);audit.append({'layer':key,'geometrySha256':before,'features':len(v['features'])})
v=read('app/world-areas.json')
for p in v:repair(p)
assert not any('?' in p['name'] or '\ufffd' in p['name'] for p in v)
write('app/world-areas.json',v)
s=read('app/world-sources.json')
for key,entry in s['layers'].items():entry['sha256']=hashlib.sha256((ROOT/('public/data/'+key+'.geojson')).read_bytes()).hexdigest()
s['nameCorrections']={'count':len(fixes),'manifest':'app/world-name-corrections.json','geometryAudit':audit}
write('app/world-sources.json',s)
print('Repaired',len(fixes),'display labels across metadata and polygon/label layers; all geometry hashes unchanged.')
