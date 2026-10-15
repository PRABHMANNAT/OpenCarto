"""Finalize two division unions and the user-defined seven-crore scenario.

All district/tehsil/state polygons and the other ten division polygons remain
unchanged. The previous complete atlas and source statistics are preserved.
"""
import copy
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ('work/geometry-runtime-win' if sys.platform == 'win32' else 'work/geometry-runtime')))
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from geographiclib.geodesic import Geodesic

BASE = ROOT / 'private/united-atlas'
PATH = BASE / 'atlas.json'
config = json.loads((ROOT / 'app/united-punjab-divisions.json').read_text(encoding='utf-8'))
population = json.loads((ROOT / 'app/united-punjab-population.json').read_text(encoding='utf-8'))
environment = json.loads((ROOT / 'app/united-punjab-environment.json').read_text(encoding='utf-8'))
data = json.loads(PATH.read_text(encoding='utf-8'))
assert data['administrativeReorganization']['districtCount'] == 48
backup = BASE / 'before-final-12-divisions.json'
if not backup.exists(): shutil.copy2(PATH, backup)
levels = data['details']['punjab']
districts = {f['properties']['name']: f for f in levels['district']['features']}
divisions = {f['properties']['name']: f for f in levels['division']['features']}
assert len(districts) == 48 and len(divisions) == 12
changed_divisions = {d['name'] for d in config['updatedDivisions']}
unchanged_geometry = {f['properties']['id']: hashlib.sha256(json.dumps(f['geometry'], sort_keys=True).encode()).hexdigest()
    for kind in ('province', 'district', 'tehsil', 'division') for f in levels[kind]['features']
    if not (kind == 'division' and f['properties']['name'] in changed_divisions)}

def area(value):
    total = 0
    for polygon in ([value] if value.geom_type == 'Polygon' else value.geoms):
        for index, ring in enumerate([polygon.exterior, *polygon.interiors]):
            calculator = Geodesic.WGS84.Polygon()
            for lon, lat in ring.coords: calculator.AddPoint(lat, lon)
            total += (1 if index == 0 else -1)*abs(calculator.Compute()[2])/1e6
    return round(total, 2)

for name, members in config['preservedDivisions'].items():
    actual = {n for n, f in districts.items() if f['properties'].get('division') == name}
    assert actual == set(members), name + ' existing assignments differ from approved baseline'

for spec in config['updatedDivisions']:
    division = divisions[spec['name']]
    members = [districts[name] for name in spec['districts']]
    union = unary_union([shape(f['geometry']) for f in members])
    assert union.is_valid and union.geom_type in ('Polygon', 'MultiPolygon')
    division['geometry'] = mapping(union)
    p = division['properties']
    p.update(capital=spec['capital'], memberDistricts=spec['districts'], pendingDistricts=[],
        districtCount=len(members), bbox=list(union.bounds), center=list(union.representative_point().coords[0]),
        areaKm2=area(union), areaNote='WGS84 geodesic area of the union of the existing member district polygons.',
        description=f"{spec['name']} Division comprises " + ', '.join(spec['districts']) + f". Its headquarters is {spec['capital']}. District boundaries, tehsils and district capitals are retained; Amb is an independent Union Territory.")
    for member in members:
        member['properties'].update(division=spec['name'], divisionCapital=spec['capital'])
        for tehsil in levels['tehsil']['features']:
            if tehsil['properties']['parentDistrictId'] == member['properties']['id']:
                tehsil['properties'].update(division=spec['name'], divisionCapital=spec['capital'])

note = 'Fictional population: 7 crore, allocated across the 48 districts using the retained settlement weights. Religious allocations from the earlier population scenario are archived separately.'
weights = {row['id']: row['weight'] for row in population['weights']}
ordered = sorted(districts.values(), key=lambda f: f['properties']['id'])
assert {f['properties']['id'] for f in ordered} == set(weights)
weight_sum = sum(weights.values())
shares = [population['total'] * weights[f['properties']['id']] / weight_sum for f in ordered]
counts = [math.floor(value) for value in shares]
remainders = sorted(range(len(counts)), key=lambda i: (-(shares[i]-counts[i]), ordered[i]['properties']['id']))
for index in remainders[:population['total']-sum(counts)]: counts[index] += 1
assert sum(counts) == 70000000 and min(counts) > 0
for f, count in zip(ordered, counts):
    p = f['properties']
    if p.get('hypotheticalDemographics'):
        p.setdefault('previousPopulationScenario', copy.deepcopy(p['hypotheticalDemographics']))
        p.pop('hypotheticalDemographics')
    p.update(hypotheticalPopulation={'total': count, 'note': note, 'method': population['method']}, density=round(count/p['areaKm2'], 1),
        populationBasis={'revision': population['revision'], 'weight': weights[p['id']]})
ranked = sorted(ordered, key=lambda f: (-f['properties']['hypotheticalPopulation']['total'], f['properties']['name']))
for i, f in enumerate(ranked): f['properties'].update(populationRank=i+1, populationRankCount=48)

province = next(p for p in data['overview']['provinces'] if p['id'] == 'punjab')
province.update(hypotheticalPopulation={'total': 70000000, 'note': note}, density=round(70000000/province['areaKm2'], 1),
    statisticsNote=note, detailNote='48 districts across exactly 12 divisions; Rawalpindi has 5 districts and Hazara has 3. Amb is an independent Union Territory.')
province.pop('hypotheticalDemographics', None)
for division in levels['division']['features']:
    p = division['properties']
    members = [f for f in ordered if f['properties']['division'] == p['name']]
    assert set(p['memberDistricts']) == {f['properties']['name'] for f in members}
    if p.get('hypotheticalDemographics'): p.setdefault('previousPopulationScenario', copy.deepcopy(p['hypotheticalDemographics']))
    p.pop('hypotheticalDemographics', None)
    p.update(hypotheticalPopulation={'total': sum(f['properties']['hypotheticalPopulation']['total'] for f in members), 'note': note},
        districtCount=len(members), tehsilCount=sum(f['properties']['tehsilCount'] for f in members),
        districtStats=[{k: f['properties'][k] for k in ('name', 'areaKm2', 'tehsilCount')} for f in members],
        provinceAreaShare=round(100*p['areaKm2']/province['areaKm2'], 2))
    p['density'] = round(p['hypotheticalPopulation']['total']/p['areaKm2'], 1)
assert sum(f['properties']['districtCount'] for f in levels['division']['features']) == 48
assert sum(f['properties']['hypotheticalPopulation']['total'] for f in levels['division']['features']) == 70000000

# Thumbnail only; the source geometry is not simplified or modified.
state_geometry = levels['province']['features'][0]['geometry']
state = shape(state_geometry)
thumbnail = state.simplify(0.002, preserve_topology=True)
minx, miny, maxx, maxy = thumbnail.bounds
scale = min(150/(maxx-minx), 90/(maxy-miny))
offsetx, offsety = (160-(maxx-minx)*scale)/2, (100-(maxy-miny)*scale)/2
paths = []
for polygon in ([thumbnail] if thumbnail.geom_type == 'Polygon' else thumbnail.geoms):
    for ring in [polygon.exterior, *polygon.interiors]:
        points = [(offsetx+(x-minx)*scale, offsety+(maxy-y)*scale) for x, y in ring.coords]
        paths.append('M'+' L'.join(f'{x:.2f},{y:.2f}' for x, y in points)+' Z')
province['silhouette'] = ' '.join(paths)
assert province['silhouette']
boundary_hash = hashlib.sha256(state.wkb).hexdigest()
assert boundary_hash == environment['boundarySha256'], 'Environment estimates use a different state polygon'
forest = environment['forest']
province.update(forestArea=round(province['areaKm2']*forest['treeCoverShare']/10)*10,
    forestPercent=round(forest['treeCoverShare']*100, 1),
    forestEstimate={'year': forest['year'], 'sourceUrl': forest['sourceUrl'], 'note': forest['method'],
        'coveragePercent': forest['coveragePercent'], 'credit': forest['credit']},
    highestPoint={k: environment['highestPoint'][k] for k in ('elevationMeters', 'rawElevationMeters', 'coordinates', 'resolutionMeters', 'sourceUrl', 'note', 'coveragePercent')})
province['forestEstimate']['method'] = province['forestEstimate']['note']
province['forestEstimate']['note'] = 'Tree-cover estimate from ESA WorldCover 2021. Includes plantations and differs from official recorded forest area.'
province['highestPoint']['method'] = province['highestPoint']['note']
province['highestPoint']['note'] = 'Highest mapped elevation in the Copernicus digital surface model, rounded to 10m. Approximate raster maximum.'
for title, url, description in [('ESA WorldCover 2021 v200', forest['sourceUrl'], forest['method']),
    ('Copernicus digital surface model', environment['highestPoint']['sourceUrl'], environment['highestPoint']['note'])]:
    if not any(source['title'] == title for source in province['sources']):
        province['sources'].append({'title': title, 'url': url, 'note': description})

# Update every persisted hierarchy derivative, retaining source and custom names.
district_by_id = {f['properties']['id']: f['properties'] for f in ordered}
for item in data['administrativeSearch']:
    if item['province'] != 'punjab': continue
    parent = district_by_id.get(item.get('parentDistrictId') or item['id'])
    if parent: item.update(division=parent['division'], divisionCapital=parent['divisionCapital'])
data['administrativeSearch'] = [item for item in data['administrativeSearch'] if not (item['province'] == 'punjab' and item['level'] == 'division')]
for f in levels['division']['features']:
    p = f['properties']
    data['administrativeSearch'].append({'id': p['id'], 'name': p['name']+' Division', 'aliases': [p['name'], p['capital']],
        'province': 'punjab', 'level': 'division', 'capital': p['capital'], 'bbox': p['bbox']})
for row in data['analysis']['changes']:
    if row.get('provinceId') == 'punjab' and row.get('proposedDistrict') in districts:
        p = districts[row['proposedDistrict']]['properties']
        row.update(proposedDivision=p['division'], divisionCapital=p['divisionCapital'])
data['territorialReview']['division'] = {'name': 'Hazara', 'headquarters': 'Abbottabad', 'districts': ['Haripur', 'Hazarawala', 'Akali Phula Singh'], 'pending': []}
audit = {'revision': config['revision'], 'districtCount': 48, 'divisionCount': 12, 'populationTotal': 70000000,
    'updatedDivisions': config['updatedDivisions'], 'preservedDivisionNames': list(config['preservedDivisions']),
    'districtAndTehsilBoundariesPreserved': True, 'ambIndependent': True,
    'populationMethod': population['method'], 'forestEstimate': province['forestArea'],
    'highestMappedElevationMeters': province['highestPoint']['elevationMeters']}
data['divisionFinalization'] = audit
data['analysis']['audit']['divisionFinalization'] = audit
data['analysis']['decisions'] = [row for row in data['analysis']['decisions'] if 'without an assigned division' not in row]
decision = 'Final Punjab: 48 districts in 12 divisions. Rawalpindi: 5 districts, HQ Rawalpindi. Hazara: Haripur, Hazarawala and Akali Phula Singh, HQ Abbottabad. Fictional population: 7 crore; Amb remains independent.'
if decision not in data['analysis']['decisions']:
    data['analysis']['decisions'].append(decision)
for kind in ('province', 'district', 'tehsil', 'division'):
    for f in levels[kind]['features']:
        p = f['properties']
        if kind == 'division' and p['name'] in changed_divisions: continue
        assert hashlib.sha256(json.dumps(f['geometry'], sort_keys=True).encode()).hexdigest() == unchanged_geometry[p['id']]

def write(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)
write(PATH, data)
write(BASE / 'profiles.json', data['overview']['provinces'])
print(json.dumps(audit), flush=True)
