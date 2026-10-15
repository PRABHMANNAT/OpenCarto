"""Independent spatial, preservation and hierarchy acceptance checks."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ('work/geometry-runtime-win' if sys.platform == 'win32' else 'work/geometry-runtime')))
import shapely
from shapely.geometry import shape
from shapely.ops import unary_union

base = ROOT / 'private/united-atlas'
d = json.loads((base / 'atlas.json').read_text(encoding='utf-8'))
b = json.loads((base / 'before-united-punjab-48-amb.json').read_text(encoding='utf-8'))
s = json.loads((ROOT / 'app/united-punjab-reorganization.json').read_text(encoding='utf-8'))
raw = {f['properties']['sourceCode']: f for f in json.loads((ROOT / 'public/data/pk-country-tehsil.geojson').read_text(encoding='utf-8'))['features']}
assert d['administrativeReorganization']['revision'] == s['revision']
districts = {f['properties']['id']: f for f in d['details']['punjab']['district']['features']}
assert len(districts) == 48
assert not set(s['retiredDistrictIds']) & set(districts)
assert {f['properties']['name'] for f in districts.values() if f['properties'].get('origin') == 'Khyber Pakhtunkhwa'} == {'Akali Phula Singh', 'Haripur', 'Hazarawala'}
tehsils = {}
baseline_tehsils = {f['properties']['id']: f for pid in ('punjab', 'kp') for f in b['details'][pid]['tehsil']['features']}
baseline_parents = {f['properties']['id']: f for pid in ('punjab', 'kp') for f in b['details'][pid]['district']['features']}
inherited_detail_mismatches = []
precision_seams = []
for pid in ('punjab', 'kp', 'amb'):
    levels = d['details'][pid]
    parents = {f['properties']['id']: f for f in levels['district']['features']}
    for f in levels['tehsil']['features']:
        p = f['properties']
        code = p.get('sourceCode') or p.get('sourceId', '').replace('pk-country-t-', '').upper()
        assert code not in tehsils, code + ' duplicate canonical source record'
        tehsils[code] = f
        assert p['province'] == pid
        if pid == 'amb':
            assert 'parentDistrictId' not in p and p['parentUnitId'] == 'amb'
            parent = levels['province']['features'][0]
        else:
            parent = parents[p['parentDistrictId']]
            assert p['district'] == parent['properties']['name']
            assert p['capital'] == parent['properties']['capital']
        outside = shape(f['geometry']).difference(shape(parent['geometry'])).area
        if outside >= 2e-6:
            old = baseline_tehsils[p['id']]
            old_parent = baseline_parents[old['properties']['parentDistrictId']]
            old_g, old_p = shape(old['geometry']), shape(old_parent['geometry'])
            if not old_g.is_valid: old_g = shapely.make_valid(old_g)
            if not old_p.is_valid: old_p = shapely.make_valid(old_p)
            previous = old_g.difference(old_p).area
            assert outside <= previous + 2e-6, code + ' new geometry outside parent'
            inherited_detail_mismatches.append({'sourceCode': code, 'outsideParentDegrees2': outside, 'previousOutsideParentDegrees2': previous})
    profile = next(p for p in d['overview']['provinces'] if p['id'] == pid)
    assert profile['detailCounts'] == {k: len(v['features']) for k, v in levels.items()}
    assert profile['population'] is None and not profile.get('hypotheticalDemographics')

for spec in s['districts']:
    f = districts[spec['id']]
    p = f['properties']
    assert p['name'] == spec['name'] and p['capital'] == spec['capital']
    members = {code: t for code, t in tehsils.items() if t['properties'].get('parentDistrictId') == spec['id']}
    assert set(members) == set(spec['members'])
    assert p['tehsilCount'] == len(spec['members'])
    assert p['heritage'] == spec['heritage']
    for code, name in spec['members'].items():
        assert members[code]['properties']['name'] == name
        assert set(s['aliases'].get(code, [])) <= set(members[code]['properties'].get('aliases', []))
        if code.startswith('PK522'):
            expected = shapely.set_precision(shape(raw[code]['geometry']), 1e-6)
            assert shape(members[code]['geometry']).equals(expected), code + ' must retain complete dated source geometry'
        else:
            previous = baseline_tehsils[members[code]['properties']['id']]
            current_g, previous_g = shape(members[code]['geometry']), shape(previous['geometry'])
            if not current_g.equals(previous_g):
                difference = current_g.symmetric_difference(previous_g)
                assert code in ('PK51101', 'PK51102'), code + ' unexpected changed existing tehsil'
                assert difference.area < 5e-7 and difference.difference(previous_g.boundary.buffer(0.00005)).is_empty, code + ' changed beyond declared source-edition seam'
                precision_seams.append({'sourceCode': code, 'areaDifferenceDegrees2': difference.area, 'maximumEdgeDistanceDegrees': current_g.hausdorff_distance(previous_g)})
assert tehsils['PK52602']['properties']['province'] == 'kp', 'Pabbi must remain KP'
assert tehsils['PK50104']['properties']['province'] == 'punjab'
assert tehsils['PK50503']['properties']['name'] == 'Ranigat'
assert not any(t['properties']['name'] == 'Panjtar' for t in tehsils.values())
amb = next(p for p in d['overview']['provinces'] if p['id'] == 'amb')
assert amb['classification'] == 'Union territory' and amb['capital'] == 'Darband'
assert amb['detailCounts']['district'] == 0
assert {code for code, t in tehsils.items() if t['properties']['province'] == 'amb'} == {'PK52203', 'PK52205'}
assert 'Phulra' in amb['aliases'] and amb['historicalReferences']
assert all(p['geometryStatus'] != 'administrative polygon' for p in amb['historicalReferences'])
references = json.loads((ROOT / 'app/united-punjab-reference-places.json').read_text(encoding='utf-8'))
point_checks = []
for reference in references['places']:
    from shapely.geometry import Point
    contained = shape(tehsils[reference['sourceTehsil']]['geometry']).covers(Point(reference['coordinates']))
    feature = next(f for f in d['overview']['places']['features'] if f['properties']['id'] == reference['id'])
    assert feature['properties']['sourceUrl'] == reference['sourceUrl']
    assert feature['properties']['license'] == 'ODbL-1.0'
    point_checks.append({'name': reference['name'], 'containedInDatedTehsil': contained, 'owner': feature['properties']['province']})
    if reference['name'] != 'Babusar Pass': assert contained, reference['name'] + ' outside expected source tehsil'
phulra = next(f for f in d['overview']['places']['features'] if f['properties']['id'] == 'up-phulra')
assert phulra['properties']['province'] == 'punjab' and phulra['properties']['kind'] == 'historical reference'

old_districts = {f['properties']['id']: f for f in b['details']['punjab']['district']['features']}
changed = set(s['retiredDistrictIds']) | set(s['retiredDistrictIds'].values()) | {f['id'] for f in s['districts']}
preserved = 0
for identifier, old in old_districts.items():
    if identifier in changed: continue
    new = districts[identifier]
    old_geometry = shape(old['geometry'])
    if not old_geometry.is_valid: old_geometry = shapely.make_valid(old_geometry)
    assert old_geometry.equals(shape(new['geometry'])), identifier + ' unrelated district changed'
    for key in ('name', 'capital', 'hypotheticalDemographics', 'sourceId'):
        assert old['properties'].get(key) == new['properties'].get(key), identifier + ' statistics or identity changed'
    preserved += 1
for old_id, target_id in s['retiredDistrictIds'].items():
    if old_id in ('punjab-d-swabi', 'punjab-d-abbottabad'): continue
    expected = unary_union([shape(old_districts[old_id]['geometry']), shape(old_districts[target_id]['geometry'])])
    assert expected.equals(shape(districts[target_id]['geometry'])), target_id + ' consolidated territory changed'
    scenarios = [old_districts[x]['properties'].get('hypotheticalDemographics') for x in (old_id, target_id)]
    if all(scenarios):
        new = districts[target_id]['properties']['hypotheticalDemographics']
        assert new['total'] == sum(p['total'] for p in scenarios)
        assert new['total'] == sum(r['population'] for r in new['religions'])

new_exact = [shape(f['geometry']) for f in d['exactGeometry']['features']]
old_exact = [shape(f['geometry']) for f in b['exactGeometry']['features']]
assert shapely.coverage_is_valid(new_exact)
assert shapely.coverage_is_valid([shape(f['geometry']) for f in d['overview']['geometry']['features']])
assert unary_union(new_exact).symmetric_difference(unary_union(old_exact)).area < 1e-9
valid_count = 0
for pid, levels in d['details'].items():
    for level, collection in levels.items():
        for f in collection['features']:
            assert shape(f['geometry']).is_valid, pid + ':' + level + ':' + f['properties']['id']
            valid_count += 1
search = d['administrativeSearch']
for code, aliases in s['aliases'].items():
    matches = [item for item in search if item['id'] == tehsils[code]['properties']['id']]
    assert len(matches) == 1
    assert set(aliases) <= set(matches[0]['aliases'])
report = {'districts': 48, 'punjabTehsils': len(d['details']['punjab']['tehsil']['features']),
    'ambTehsils': 2, 'singleOwnerTehsilsChecked': len(tehsils), 'unchangedRawPunjabDistricts': preserved,
    'validDetailPolygons': valid_count, 'completeBalakotSourcePreserved': True,
    'nationalFootprintPreserved': True, 'exactAndOverviewSharedCoverageValid': True,
    'inheritedSourceEditionDetailMismatches': inherited_detail_mismatches, 'sourceEditionDetailSeams': precision_seams, 'referencePointChecks': point_checks}
(ROOT / 'outputs/private-atlas').mkdir(parents=True, exist_ok=True)
(ROOT / 'outputs/private-atlas/reorganization-geometry-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
