"""Independent final-division, preservation, population and estimate checks."""
import hashlib
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ('work/geometry-runtime-win' if sys.platform == 'win32' else 'work/geometry-runtime')))
import shapely
from shapely.geometry import shape, Point
from shapely.ops import unary_union
from geographiclib.geodesic import Geodesic

base = ROOT / 'private/united-atlas'
d = json.loads((base / 'atlas.json').read_text(encoding='utf-8'))
b = json.loads((base / 'before-final-12-divisions.json').read_text(encoding='utf-8'))
config = json.loads((ROOT / 'app/united-punjab-divisions.json').read_text(encoding='utf-8'))
environment = json.loads((ROOT / 'app/united-punjab-environment.json').read_text(encoding='utf-8'))
population = json.loads((ROOT / 'app/united-punjab-population.json').read_text(encoding='utf-8'))
levels, before = d['details']['punjab'], b['details']['punjab']
districts = {f['properties']['id']: f for f in levels['district']['features']}
divisions = {f['properties']['name']: f for f in levels['division']['features']}
assert len(districts) == 48 and len(divisions) == 12
assert set(divisions) == set(config['preservedDivisions']) | {'Rawalpindi', 'Hazara'}
seen = set()
for name, division in divisions.items():
    p = division['properties']
    members = [f for f in districts.values() if f['properties']['division'] == name]
    assert members
    assert p['districtCount'] == len(members)
    assert set(p['memberDistricts']) == {f['properties']['name'] for f in members}
    assert p['tehsilCount'] == sum(f['properties']['tehsilCount'] for f in members)
    assert p['hypotheticalPopulation']['total'] == sum(f['properties']['hypotheticalPopulation']['total'] for f in members)
    assert abs(p['density']-p['hypotheticalPopulation']['total']/p['areaKm2']) < 0.051
    for f in members:
        assert f['properties']['id'] not in seen
        seen.add(f['properties']['id'])
        assert f['properties']['divisionCapital'] == p['capital']
    assert shape(division['geometry']).is_valid
assert seen == set(districts)
for target in config['updatedDivisions']:
    current = divisions[target['name']]
    assert current['properties']['capital'] == target['capital']
    assert set(current['properties']['memberDistricts']) == set(target['districts'])
    members = [f for f in districts.values() if f['properties']['name'] in target['districts']]
    assert shape(current['geometry']).equals(unary_union([shape(f['geometry']) for f in members]))
    assert shape(current['geometry']).covers(Point(current['properties']['headquartersCoordinates']))
for name, members in config['preservedDivisions'].items():
    original = next(f for f in before['division']['features'] if f['properties']['name'] == name)
    current = divisions[name]
    assert current['geometry'] == original['geometry'], name + ' polygon changed'
    for key in ('id', 'name', 'capital', 'color', 'headquartersCoordinates', 'headquartersSource', 'memberDistricts', 'areaKm2', 'description', 'photo'):
        assert current['properties'].get(key) == original['properties'].get(key), name + ':' + key + ' changed'
    assert {f['properties']['name'] for f in districts.values() if f['properties']['division'] == name} == set(members)
for level in ('province', 'district', 'tehsil'):
    originals = {f['properties']['id']: f for f in before[level]['features']}
    for f in levels[level]['features']:
        original = originals[f['properties']['id']]
        assert f['geometry'] == original['geometry'], f['properties']['id'] + ' boundary changed'
        for key in ('name', 'capital', 'aliases', 'sourceId', 'sourceCode', 'parentDistrictId'):
            assert f['properties'].get(key) == original['properties'].get(key), f['properties']['id'] + ':' + key + ' changed'
        assert shape(f['geometry']).is_valid
        if level == 'tehsil':
            assert f['properties']['division'] == districts[f['properties']['parentDistrictId']]['properties']['division']
for pid in d['details']:
    if pid != 'punjab': assert d['details'][pid] == b['details'][pid], pid + ' unrelated geography changed'
assert d['exactGeometry'] == b['exactGeometry']
assert d['overview']['geometry'] == b['overview']['geometry']
assert shapely.coverage_is_valid([shape(f['geometry']) for f in d['exactGeometry']['features']])
assert d['details']['amb'] == b['details']['amb']
assert not any(f['properties']['province'] == 'amb' for f in levels['district']['features'])
assert sum(f['properties']['hypotheticalPopulation']['total'] for f in districts.values()) == 70000000
assert sum(f['properties']['hypotheticalPopulation']['total'] for f in divisions.values()) == 70000000
weights = {p['id']: p['weight'] for p in population['weights']}
denominator = sum(weights.values())
for identifier, f in districts.items():
    count = f['properties']['hypotheticalPopulation']['total']
    assert isinstance(count, int) and count > 0
    assert abs(count-70000000*weights[identifier]/denominator) < 1
    assert not f['properties'].get('hypotheticalDemographics')
    assert f['properties']['density'] == round(count/f['properties']['areaKm2'], 1)
    old = next(f for f in before['district']['features'] if f['properties']['id'] == identifier)
    if old['properties'].get('hypotheticalDemographics'):
        assert f['properties']['previousPopulationScenario'] == old['properties']['hypotheticalDemographics']
p = next(p for p in d['overview']['provinces'] if p['id'] == 'punjab')
assert p['hypotheticalPopulation']['total'] == 70000000 and p['population'] is None and p['census'] is None
assert p['silhouette'].startswith('M') and len(p['silhouette']) > 500
assert abs(p['density']-70000000/p['areaKm2']) < 0.051
assert p['forestArea'] == round(p['areaKm2']*environment['forest']['treeCoverShare']/10)*10
assert p['forestPercent'] == round(environment['forest']['treeCoverShare']*100, 1)
assert p['forestEstimate']['year'] == 2021 and p['forestEstimate']['coveragePercent'] > 99.9
assert p['highestPoint']['elevationMeters'] > 4000
assert shape(levels['province']['features'][0]['geometry']).covers(Point(p['highestPoint']['coordinates']))
assert p['highestPoint']['coveragePercent'] > 99.9
assert hashlib.sha256(shape(levels['province']['features'][0]['geometry']).wkb).hexdigest() == environment['boundarySha256']

# Report inherited cross-layer seams without changing the approved district
# boundaries or silently passing them off as perfectly matching source editions.
def geodesic_area(geometry):
    if geometry.is_empty or geometry.area == 0: return 0
    if geometry.geom_type not in ('Polygon', 'MultiPolygon'):
        return sum(geodesic_area(part) for part in geometry.geoms)
    total = 0
    for polygon in ([geometry] if geometry.geom_type == 'Polygon' else geometry.geoms):
        for index, ring in enumerate([polygon.exterior, *polygon.interiors]):
            calculator = Geodesic.WGS84.Polygon()
            for lon, lat in ring.coords: calculator.AddPoint(lat, lon)
            total += (1 if index == 0 else -1) * abs(calculator.Compute()[2]) / 1e6
    return total

district_union = unary_union([shape(f['geometry']) for f in districts.values()])
assert district_union.equals(unary_union([shape(f['geometry']) for f in before['district']['features']]))
state = shape(levels['province']['features'][0]['geometry'])
expected_divisions = {f['properties']['name']: shape(f['geometry']) for f in before['division']['features']}
for target in config['updatedDivisions']:
    expected_divisions[target['name']] = unary_union([shape(f['geometry']) for f in before['district']['features']
        if f['properties']['name'] in target['districts']])
overlaps = []
for index, (name, feature) in enumerate(divisions.items()):
    for other_name, other in list(divisions.items())[index+1:]:
        intersection = shape(feature['geometry']).intersection(shape(other['geometry']))
        original_intersection = expected_divisions[name].intersection(expected_divisions[other_name])
        assert intersection.symmetric_difference(original_intersection).area < 1e-15
        if intersection.area > 1e-15:
            overlaps.append({'divisions': [name, other_name], 'areaKm2': geodesic_area(intersection)})
source_seams = {'districtUnionUnchanged': True, 'newDivisionOverlapAreaKm2': 0,
    'stateWithoutDistrictCoverageKm2': geodesic_area(state.difference(district_union)),
    'districtCoverageOutsideStateKm2': geodesic_area(district_union.difference(state)),
    'strictDivisionEdgeCoverageValid': bool(shapely.coverage_is_valid([shape(f['geometry']) for f in divisions.values()])),
    'inheritedDivisionOverlaps': overlaps}
report = {'districts': 48, 'divisions': 12, 'rawalpindiDistricts': 5, 'hazaraDistricts': 3,
    'unchangedDivisions': 10, 'districtAndTehsilBoundariesPreserved': True, 'ambIndependent': True,
    'population': 70000000, 'density': p['density'], 'forestEstimateKm2': p['forestArea'],
    'treeCoverPercent': p['forestPercent'], 'highestMappedElevationMeters': p['highestPoint']['elevationMeters'],
    'nationalGeometryUnchanged': True, 'sourceEditionSeams': source_seams}
(ROOT / 'outputs/private-atlas').mkdir(parents=True, exist_ok=True)
(ROOT / 'outputs/private-atlas/final-divisions-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
