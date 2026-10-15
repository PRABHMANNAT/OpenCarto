"""Independently check six-region membership, geometry and data preservation."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ('work/geometry-runtime-win' if sys.platform == 'win32' else 'work/geometry-runtime')))
from shapely.geometry import shape
from shapely.ops import unary_union
from geographiclib.geodesic import Geodesic

base = ROOT / 'private/united-atlas'
current = json.loads((base / 'atlas.json').read_text(encoding='utf-8'))
before = json.loads((base / 'before-historical-regions.json').read_text(encoding='utf-8'))
spec = json.loads((ROOT / 'app/united-punjab-regions.json').read_text(encoding='utf-8'))
levels = current['details']['punjab']
districts = {f['properties']['id']: f for f in levels['district']['features']}
regions = levels['region']['features']
assert len(regions) == 6 and len({f['properties']['id'] for f in regions}) == 6
assert [f['properties']['name'] for f in regions] == ['Majha', 'Malwa', 'Doaba', 'Puadh', 'Bar', 'Pothohar']
assert [f['properties']['districtCount'] for f in regions] == [13, 10, 4, 4, 9, 8]
seen = set()
def area(geometry):
    total = 0
    for polygon in ([geometry] if geometry.geom_type == 'Polygon' else geometry.geoms):
        for index, ring in enumerate([polygon.exterior, *polygon.interiors]):
            polygon_area = Geodesic.WGS84.Polygon()
            for lon, lat in ring.coords: polygon_area.AddPoint(lat, lon)
            total += (1 if index == 0 else -1) * abs(polygon_area.Compute()[2]) / 1e6
    return round(total, 2)
for feature, expected in zip(regions, spec['regions']):
    p = feature['properties']
    assert p['id'] == expected['id'] and p['color'] == expected['color']
    assert p['memberDistricts'] == expected['districts']
    members = [districts[identifier] for identifier in p['memberDistrictIds']]
    assert [f['properties']['name'] for f in members] == expected['districts']
    for member in members:
        identifier = member['properties']['id']
        assert identifier not in seen
        seen.add(identifier)
        assert member['properties']['historicalRegion'] == p['name']
        assert member['properties']['historicalRegionId'] == p['id']
    geometry = shape(feature['geometry'])
    assert geometry.is_valid and geometry.equals(unary_union([shape(f['geometry']) for f in members]))
    assert p['areaKm2'] == area(geometry)
    assert p['districtCount'] == len(members)
    assert p['tehsilCount'] == sum(f['properties']['tehsilCount'] for f in members)
    assert p['hypotheticalPopulation']['total'] == sum(f['properties']['hypotheticalPopulation']['total'] for f in members)
    assert p['density'] == round(p['hypotheticalPopulation']['total'] / p['areaKm2'], 1)
    assert not p.get('headquartersCoordinates') and not p.get('capital')
assert seen == set(districts)
# Grouped GEOS unions may retain different zero-area linework at inherited
# source seams; compare covered area as well as each exact member union above.
footprint_difference = unary_union([shape(f['geometry']) for f in regions]).symmetric_difference(unary_union([shape(f['geometry']) for f in districts.values()])).area
assert footprint_difference < 1e-12
assert sum(f['properties']['hypotheticalPopulation']['total'] for f in regions) == 70000000
assert sum(f['properties']['tehsilCount'] for f in regions) == 193
for level in ('district', 'tehsil'):
    original = before['details']['punjab'][level]['features']
    assert len(levels[level]['features']) == len(original)
    for feature, previous in zip(levels[level]['features'], original):
        assert feature['geometry'] == previous['geometry']
        filtered = {k: v for k, v in feature['properties'].items() if k not in ('historicalRegion', 'historicalRegionId')}
        assert filtered == previous['properties']
        if level == 'tehsil':
            p = feature['properties']
            assert p['historicalRegionId'] == districts[p['parentDistrictId']]['properties']['historicalRegionId']
assert levels['division'] == before['details']['punjab']['division']
assert levels['province'] == before['details']['punjab']['province']
assert current['exactGeometry'] == before['exactGeometry']
for key, value in before['overview'].items():
    if key != 'provinces': assert current['overview'][key] == value
for province, previous in zip(current['overview']['provinces'], before['overview']['provinces']):
    if province['id'] != 'punjab': assert province == previous
    else:
        assert province['detailCounts']['region'] == 6
        assert {k: v for k, v in province.items() if k not in ('detailCounts', 'detailNote')} == {k: v for k, v in previous.items() if k not in ('detailCounts', 'detailNote')}
        assert {k: v for k, v in province['detailCounts'].items() if k != 'region'} == previous['detailCounts']
for identifier in current['details']:
    if identifier != 'punjab': assert current['details'][identifier] == before['details'][identifier]
assert current['divisionFinalization'] == before['divisionFinalization']
report = {'historicalRegions': 6, 'districtCounts': [13, 10, 4, 4, 9, 8], 'uniqueDistricts': 48,
    'mappedTehsils': 193, 'fictionalPopulation': 70000000, 'allRegionPolygonsValid': True,
    'completeDistrictUnions': True, 'regionDistrictFootprintDifferenceDegrees2': footprint_difference,
    'districtAndTehsilGeometryUnchanged': True, 'allTwelveDivisionsUnchanged': True,
    'ambAndOtherProvincesUnchanged': True, 'stateGeometryAndStatisticsUnchanged': True,
    'inheritedDistrictSourceSeamsPreserved': True}
(ROOT / 'outputs/private-atlas').mkdir(parents=True, exist_ok=True)
(ROOT / 'outputs/private-atlas/historical-regions-geometry-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report), flush=True)
