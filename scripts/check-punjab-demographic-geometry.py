"""Independent geography/hierarchy and exact demographic conservation checks."""
import csv
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/('work/geometry-runtime-win' if sys.platform=='win32' else 'work/geometry-runtime')))
from shapely.geometry import shape
base=ROOT/'private/united-atlas'
d=json.loads((base/'atlas.json').read_text(encoding='utf-8'))
b=json.loads((base/'before-demographics-2026.json').read_text(encoding='utf-8'))
c=json.loads((ROOT/'app/punjab-demographic-scenario.json').read_text(encoding='utf-8'))
levels=d['details']['punjab']
counts={'district':48,'tehsil':193,'division':12,'region':6}
assert d['exactGeometry']==b['exactGeometry']
for pid in d['details']:
    if pid!='punjab': assert d['details'][pid]==b['details'][pid],pid+' geography or statistics changed'
for key in b['overview']:
    if key!='provinces': assert d['overview'][key]==b['overview'][key]
for old in b['overview']['provinces']:
    new=next(p for p in d['overview']['provinces'] if p['id']==old['id'])
    if old['id']!='punjab': assert new==old
    else:
        for key in ('areaKm2','forestArea','forestPercent','highestPoint','capital','capitalCoordinates','photos','sources','bbox','center'): assert new[key]==old[key],key
def valid(s,area):
    assert s['version']==c['version'] and s['year']==2026
    assert isinstance(s['total'],int) and s['total']>0
    assert len(s['religions'])==6
    assert sum(r['population'] for r in s['religions'])==s['total']
    assert s['urbanPopulation']+s['ruralPopulation']==s['total']
    assert abs(s['urbanPercent']-100*s['urbanPopulation']/s['total'])<1e-10
    assert sum(r['urbanPopulation'] for r in s['religions'])==s['urbanPopulation']
    for religion,locked in zip(s['religions'],c['religions']):
        assert religion['key']==locked['key']
        for key in ('population','urbanPopulation','ruralPopulation'): assert isinstance(religion[key],int) and religion[key]>=0
        assert religion['population']==religion['urbanPopulation']+religion['ruralPopulation']
        assert abs(religion['percentage']-religion['population']/s['total']*100)<1e-10
    if area: assert abs(s['density']-s['total']/area)<1e-8
def aggregate(parent,children):
    for key in ('total','urbanPopulation','ruralPopulation'): assert parent[key]==sum(s[key] for s in children)
    for i,r in enumerate(parent['religions']):
        for key in ('population','urbanPopulation','ruralPopulation'): assert r[key]==sum(s['religions'][i][key] for s in children)
for level,number in counts.items():
    features=levels[level]['features'];originals={f['properties']['id']:f for f in b['details']['punjab'][level]['features']}
    assert len(features)==len(originals)==number
    for f in features:
        p=f['properties'];old=originals[p['id']]['properties']
        assert f['geometry']==originals[p['id']]['geometry'] and shape(f['geometry']).is_valid
        for key in ('name','capital','parentDistrictId','sourceId','sourceCode','sourceParent','division','divisionCapital','memberDistrictIds','memberTehsils','heritage','summary'):
            if level=='region' and p['id']=='punjab-region-pothohar' and key=='name': assert p[key]=='Pothohar–Gandhara';continue
            assert p.get(key)==old.get(key),p['id']+':'+key
        if level!='tehsil': assert p['areaKm2']==old['areaKm2']
        valid(p['hypotheticalDemographics'],p['areaKm2'])
        assert p['hypotheticalPopulation']['total']==p['hypotheticalDemographics']['total']
        assert p.get('population')==old.get('population') and p.get('census')==old.get('census')
    assert sum(f['properties']['hypotheticalDemographics']['total'] for f in features)==c['total']
    assert sum(f['properties']['hypotheticalDemographics']['urbanPopulation'] for f in features)==c['urbanPopulation']
    for i,r in enumerate(c['religions']): assert sum(f['properties']['hypotheticalDemographics']['religions'][i]['population'] for f in features)==r['population']
districts={f['properties']['id']:f['properties'] for f in levels['district']['features']}
tehsils={f['properties']['id']:f['properties'] for f in levels['tehsil']['features']}
for district in districts.values(): aggregate(district['hypotheticalDemographics'],[p['hypotheticalDemographics'] for p in tehsils.values() if p['parentDistrictId']==district['id']])
for level in ('division','region'):
    for f in levels[level]['features']:
        p=f['properties']
        children=[v['hypotheticalDemographics'] for v in districts.values() if (v['division']==p['name'] if level=='division' else v['id'] in p['memberDistrictIds'])]
        aggregate(p['hypotheticalDemographics'],children)
province=next(p for p in d['overview']['provinces'] if p['id']=='punjab')
valid(province['hypotheticalDemographics'],province['areaKm2'])
aggregate(province['hypotheticalDemographics'],[p['hypotheticalDemographics'] for p in districts.values()])
assert province['population'] is None and province['census'] is None
assert c['religions'][1]['population']*100==c['total']*22
assert 72<province['hypotheticalDemographics']['religions'][0]['percentage']<76
assert province['hypotheticalDemographics']['urbanPercent']==40
assert len(d['demographics']['rows'])==259
for row in d['demographics']['rows']:
    p=next(f['properties'] for f in levels[row['level']]['features'] if f['properties']['id']==row['id'])
    assert row['hypotheticalDemographics']==p['hypotheticalDemographics']
used=set()
for city in d['demographics']['cities']:
    s=city['hypotheticalDemographics'];valid(s,None)
    assert s['urbanPopulation']==s['total']
    assert sum(row['population'] for row in city['coreAllocations'])==s['total']
    for row in city['coreAllocations']:
        assert row['tehsilId'] not in used;used.add(row['tehsilId'])
        assert row['population']<=tehsils[row['tehsilId']]['hypotheticalDemographics']['urbanPopulation']
    for i,r in enumerate(s['religions']): assert r['population']<=sum(tehsils[identifier]['hypotheticalDemographics']['religions'][i]['urbanPopulation'] for identifier in city['coreTehsilIds'])
cities=d['demographics']['cities'];lahore=next(row for row in cities if row['name']=='Lahore')
assert lahore['hypotheticalDemographics']['total']==4500000
assert max(cities,key=lambda row:row['hypotheticalDemographics']['total'])['name']=='Lahore'
assert max(cities,key=lambda row:row['hypotheticalDemographics']['religions'][0]['population'])['name']=='Lahore'
top_tehsils=sorted(tehsils.values(),key=lambda p:-p['hypotheticalDemographics']['religions'][0]['percentage'])
assert {p['name'] for p in top_tehsils[:2]}=={'Talwandi Sabo','Anandpur Sahib'}
top_districts=sorted(districts.values(),key=lambda p:-p['hypotheticalDemographics']['religions'][0]['percentage'])
assert {p['name'] for p in top_districts[:5]}=={'Tarn Taran','Kartarpur Sahib','Panja Sahib','Sri Anandpur Sahib','Amritsar'}
lahore_d=next(p for p in districts.values() if p['name']=='Lahore')
assert 68<=lahore_d['hypotheticalDemographics']['religions'][0]['percentage']<=77
for name in ('Balakot','Murree'):
    p=next(p for p in tehsils.values() if p['name']==name)
    assert p['density']<province['density']
for level in (*counts,'city'):
    with (ROOT/'reports/punjab-demographics-2026'/f'{level}.csv').open(encoding='utf-8-sig') as handle: rows=list(csv.DictReader(handle))
    assert len(rows)==(8 if level=='city' else counts[level])
    if level!='city': assert sum(int(row['total']) for row in rows)==c['total']
report={'version':c['version'],'total':c['total'],'religions':{r['key']:r['population'] for r in c['religions']},'hinduPercent':22,'urbanPercent':40,
    'counts':counts,'geometryAndParentagePreserved':True,'ambExcludedAndUnchanged':True,'allMarginsAndUrbanRuralReconcile':True,
    'topSikhTehsils':[p['name'] for p in top_tehsils[:2]],'lahoreCityPopulation':4500000,'lahoreCitySikhPopulation':lahore['hypotheticalDemographics']['religions'][0]['population'],'cityInventoriesBounded':True}
(ROOT/'outputs/private-atlas/demographics-2026-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report),flush=True)
