"""Add the approved six district-based historical regions as a parallel layer.

Existing district/tehsil/state polygons, divisions, capitals and statistics are
preserved. This grouping does not make divisions children of historical regions.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ('work/geometry-runtime-win' if sys.platform == 'win32' else 'work/geometry-runtime')))
from geographiclib.geodesic import Geodesic
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

base = ROOT / 'private/united-atlas'
path = base / 'atlas.json'
spec = json.loads((ROOT / 'app/united-punjab-regions.json').read_text(encoding='utf-8'))
data = json.loads(path.read_text(encoding='utf-8'))
backup = base / 'before-historical-regions.json'
if not backup.exists(): shutil.copy2(path, backup)
levels = data['details']['punjab']
districts = {f['properties']['name']: f for f in levels['district']['features']}
assigned = [name for region in spec['regions'] for name in region['districts']]
assert len(spec['regions']) == 6 and len(assigned) == len(set(assigned)) == len(districts) == 48
assert set(assigned) == set(districts)
preserved = hashlib.sha256(json.dumps({
    'geometries': {level: [f['geometry'] for f in levels[level]['features']] for level in ('province', 'division', 'district', 'tehsil')},
    'divisions': levels['division'],
}, sort_keys=True).encode()).hexdigest()

def area(geometry):
    total = 0
    for polygon in ([geometry] if geometry.geom_type == 'Polygon' else geometry.geoms):
        for index, ring in enumerate([polygon.exterior, *polygon.interiors]):
            calculator = Geodesic.WGS84.Polygon()
            for lon, lat in ring.coords: calculator.AddPoint(lat, lon)
            total += (1 if index == 0 else -1) * abs(calculator.Compute()[2]) / 1e6
    return round(total, 2)

province = next(p for p in data['overview']['provinces'] if p['id'] == 'punjab')
features = []
region_by_district = {}
for region in spec['regions']:
    members = [districts[name] for name in region['districts']]
    geometry = unary_union([shape(f['geometry']) for f in members])
    assert geometry.is_valid and geometry.geom_type in ('Polygon', 'MultiPolygon')
    region_area = area(geometry)
    population = sum(f['properties']['hypotheticalPopulation']['total'] for f in members)
    properties = {
        'id': region['id'], 'name': region['name'], 'province': 'punjab',
        'classification': 'Historical region', 'color': region['color'],
        'bbox': list(geometry.bounds), 'center': list(geometry.representative_point().coords[0]),
        'memberDistrictIds': [f['properties']['id'] for f in members],
        'memberDistricts': region['districts'], 'districtCount': len(members),
        'districtStats': [{key: f['properties'][key] for key in ('id', 'name', 'capital', 'areaKm2', 'tehsilCount', 'hypotheticalPopulation')} for f in members],
        'tehsilCount': sum(f['properties']['tehsilCount'] for f in members),
        'areaKm2': region_area, 'provinceAreaShare': round(region_area / province['areaKm2'] * 100, 2),
        'areaNote': 'WGS84 geodesic area of the complete existing member district polygons. Inherited source seams are preserved.',
        'hypotheticalPopulation': {'total': population, 'note': 'Sum of the existing fictional district allocations within the user-defined 7-crore Punjab scenario.'},
        'density': round(population / region_area, 1),
        'description': f"{region['name']} groups {len(members)} districts in this atlas. Historical regions and administrative divisions are separate views; all existing divisions, district capitals and tehsil names are retained.",
    }
    features.append({'type': 'Feature', 'properties': properties, 'geometry': mapping(geometry)})
    for member in members:
        region_by_district[member['properties']['id']] = region
levels['region'] = {'type': 'FeatureCollection', 'features': features}
for level in ('district', 'tehsil'):
    for feature in levels[level]['features']:
        p = feature['properties']
        region = region_by_district[p['id'] if level == 'district' else p['parentDistrictId']]
        p.update(historicalRegion=region['name'], historicalRegionId=region['id'])
province['detailCounts']['region'] = 6
province['detailNote'] = '48 districts across 12 divisions and 6 historical regions. Amb is an independent Union Territory.'
for item in data['administrativeSearch']:
    if item['province'] != 'punjab': continue
    region = region_by_district.get(item.get('parentDistrictId') or item['id'])
    if region: item.update(historicalRegion=region['name'], historicalRegionId=region['id'])
data['administrativeSearch'] = [item for item in data['administrativeSearch'] if not (item['province'] == 'punjab' and item['level'] == 'region')]
for feature in features:
    p = feature['properties']
    data['administrativeSearch'].append({'id': p['id'], 'name': p['name'] + ' Historical Region',
        'aliases': [p['name'], p['name'] + ' region'], 'province': 'punjab', 'level': 'region', 'capital': '', 'bbox': p['bbox']})
for row in data['analysis']['changes']:
    if row.get('provinceId') == 'punjab' and row.get('proposedDistrict') in districts:
        row['proposedHistoricalRegion'] = districts[row['proposedDistrict']]['properties']['historicalRegion']
audit = {'revision': spec['revision'], 'regionCount': 6, 'districtCount': 48,
    'regions': [{'id': f['properties']['id'], 'name': f['properties']['name'], 'districtCount': f['properties']['districtCount']} for f in features],
    'divisionsUnchanged': True, 'districtAndTehsilBoundariesPreserved': True, 'ambIndependent': True}
data['historicalRegions'] = audit
data['analysis']['audit']['historicalRegions'] = audit
decision = 'Punjab has 6 historical regions: Majha (13), Malwa (10), Doaba (4), Puadh (4), Bar (9) and Pothohar (8). All 48 districts belong to exactly one region; the 12 administrative divisions remain unchanged and Amb remains independent.'
if decision not in data['analysis']['decisions']: data['analysis']['decisions'].append(decision)
assert preserved == hashlib.sha256(json.dumps({
    'geometries': {level: [f['geometry'] for f in levels[level]['features']] for level in ('province', 'division', 'district', 'tehsil')},
    'divisions': levels['division'],
}, sort_keys=True).encode()).hexdigest()
assert sum(f['properties']['hypotheticalPopulation']['total'] for f in features) == 70000000
for target, value in [(path, data), (base / 'profiles.json', data['overview']['provinces'])]:
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(target)
print(json.dumps(audit), flush=True)
