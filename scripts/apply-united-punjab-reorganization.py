"""Persist the approved 48-district hierarchy. Public source files are read-only.

Uses the existing WGS84 / six-decimal seam convention. The dated source choice
is explicit in the shared specification. Run once on the previous atlas; later
runs are no-ops. A complete ignored backup and retired records are retained.
"""
import copy
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ('work/geometry-runtime-win' if sys.platform == 'win32' else 'work/geometry-runtime')))
import shapely
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union
from geographiclib.geodesic import Geodesic

BASE = ROOT / 'private/united-atlas'
PATH = BASE / 'atlas.json'
spec = json.loads((ROOT / 'app/united-punjab-reorganization.json').read_text(encoding='utf-8'))
data = json.loads(PATH.read_text(encoding='utf-8'))
backup = BASE / 'before-united-punjab-48-amb.json'

repairs = []
def g(f):
    value = shape(f['geometry'])
    if not value.is_valid:
        repaired = shapely.make_valid(value)
        if repaired.geom_type == 'GeometryCollection':
            repaired = unary_union([part for part in repaired.geoms if part.geom_type in ('Polygon', 'MultiPolygon')])
        delta = abs(value.area - repaired.area)
        assert delta < 1e-8 and delta / max(value.area, 1e-12) < 1e-7, 'Unsafe pre-existing invalid geometry: ' + str(f['properties'].get('id'))
        repairs.append({'id': f['properties'].get('id'), 'reason': shapely.is_valid_reason(value), 'areaDifferenceDegrees2': delta, 'method': 'make_valid; polygon components retained; zero-area remnants omitted'})
        f['geometry'] = mapping(repaired)
        value = repaired
    return value

def polygonal(value):
    if value.geom_type == 'GeometryCollection':
        value = unary_union([p for p in value.geoms if p.geom_type in ('Polygon', 'MultiPolygon')])
    assert value.is_valid, shapely.is_valid_reason(value)
    assert value.geom_type in ('Polygon', 'MultiPolygon') and not value.is_empty
    return value

def setg(f, value):
    value = polygonal(value)
    f['geometry'] = mapping(value)
    f['properties'].update(bbox=list(value.bounds), center=list(value.representative_point().coords[0]))

def area(value):
    if value.geom_type == 'GeometryCollection':
        return round(sum(area(p) for p in value.geoms), 2)
    if value.geom_type not in ('Polygon', 'MultiPolygon'): return 0
    total = 0
    for polygon in ([value] if value.geom_type == 'Polygon' else value.geoms):
        for i, ring in enumerate([polygon.exterior, *polygon.interiors]):
            calc = Geodesic.WGS84.Polygon()
            for lon, lat in ring.coords:
                calc.AddPoint(lat, lon)
            total += (1 if i == 0 else -1) * abs(calc.Compute()[2]) / 1e6
    return round(total, 2)

def fc(features):
    return {'type': 'FeatureCollection', 'features': features}

def code(f):
    p = f['properties']
    return p.get('sourceCode') or p.get('sourceId', '').replace('pk-country-t-', '').upper()

def invalidate_stats(p):
    for key in ('population', 'density', 'census', 'hypotheticalDemographics', 'populationRank'):
        if p.get(key) is not None:
            p.setdefault('previousBoundaryStatistics', {})[key] = copy.deepcopy(p[key])
        p.pop(key, None)
    p.update(population=None, density=None, census=None,
             statisticsNote='Unavailable for this boundary edition: no compatible complete population or demographic aggregate is supplied. Previous source values are archived, not extrapolated.')

def aggregate_scenarios(features):
    scenarios = [f['properties'].get('hypotheticalDemographics') for f in features]
    if not scenarios or any(s is None for s in scenarios):
        return None
    religions = {}
    for scenario in scenarios:
        for r in scenario['religions']:
            religions[r['name']] = religions.get(r['name'], 0) + r['population']
    return {'total': sum(s['total'] for s in scenarios),
            'religions': [{'name': name, 'population': n} for name, n in religions.items()],
            'note': 'Sum of existing fictional allocations for unchanged source territories; not a census or forecast. Original allocations and source notes are archived.'}

def refresh_editorial(payload):
    if 'administrativeSearch' in payload['overview']:
        payload['administrativeSearch'] = payload['overview'].pop('administrativeSearch')
    meanings = {'Hund': 'Hund / Udabhanda, the ancient Hindu Shahi capital', 'Mahabanpur': 'Inspired by the Mahaban mountain region', 'Ranigat': 'Inspired by the Ranigat Buddhist archaeological complex', 'Haro': 'Named for the Haro River', 'Sherwan': 'Uses the existing Sherwan place-name; retains the Lower Tanawal polygon', 'Pakhli': 'Named for the historic Pakhli region'}
    for t in payload['details']['punjab']['tehsil']['features']:
        p = t['properties']
        if code(t) in spec['aliases']:
            p.update(namingStatus='renamed', nameMeaning=meanings.get(p['name'], p.get('nameMeaning', 'Existing geographical name')),
                namingReason='Approved administrative name inspired by the district’s recorded heritage; original polygon and settlement names retained.',
                namingProvenance='User-approved fictional reorganization; historical settlement names are retained.', namingSourceUrl=spec['sourceUrl'])
    for t in payload['details']['amb']['tehsil']['features']:
        t['properties']['color'] = spec['amb']['color']
    for district_spec in spec['districts']:
        district = next(f for f in payload['details']['punjab']['district']['features'] if f['properties']['id'] == district_spec['id'])
        district['properties']['keyCities'] = district_spec['keyCities']
    for p in payload['overview']['provinces']:
        if p['id'] == 'amb': p.pop('previousBoundaryStatistics', None)
    source_divisions = {p['name']: p['sourceDistrictCodes'] for p in json.loads((ROOT / 'app/pakistan-division-areas.json').read_text(encoding='utf-8')) if p['parent'].endswith('pk5')}
    for division in payload['details']['kp']['division']['features']:
        p = division['properties']
        codes = source_divisions[p['name']]
        members = [f for f in payload['details']['kp']['district']['features'] if f['properties']['sourceId'].replace('pk-country-d-', '').upper() in codes]
        p.update(districtCount=len(members), tehsilCount=sum(f['properties']['tehsilCount'] for f in members), memberDistricts=[f['properties']['name'] for f in members])
    audit = payload['analysis']['audit']
    if audit.get('territorialReview', {}).get('revision') != spec['revision']:
        audit['previousTerritorialReview'] = audit.get('territorialReview')
    audit['territorialReview'] = {**payload['administrativeReorganization'], 'unresolvedSourceIds': [], 'unresolvedHistoricalBoundaries': ['additional Tanawal', 'Phulra']}
    references = json.loads((ROOT / 'app/united-punjab-reference-places.json').read_text(encoding='utf-8'))
    tehsils = {code(f): f for pid in ('punjab', 'amb') for f in payload['details'][pid]['tehsil']['features']}
    point_checks = []
    for reference in references['places']:
        point = Point(reference['coordinates'])
        tehsil = tehsils[reference['sourceTehsil']]
        contained = g(tehsil).covers(point)
        owner = tehsil['properties']['province'] if contained else next((f['properties']['id'] for f in payload['exactGeometry']['features'] if g(f).covers(point)), None)
        assert owner, 'Reference point outside national footprint: ' + reference['name']
        properties = {**reference, 'province': owner, 'license': references['license'], 'licenseUrl': references['licenseUrl'],
            'retrieved': references['retrieved'], 'accuracy': references['source'],
            'description': reference.get('description', 'Original geographical name retained; this point does not define an administrative boundary.')}
        feature = {'type': 'Feature', 'id': reference['id'], 'properties': properties, 'geometry': {'type': 'Point', 'coordinates': reference['coordinates']}}
        payload['overview']['places']['features'] = [f for f in payload['overview']['places']['features'] if f['properties']['id'] != reference['id']] + [feature]
        point_checks.append({'name': reference['name'], 'sourceTehsil': reference['sourceTehsil'], 'containedInDatedSource': contained, 'currentProvince': owner})
        if reference['name'] == 'Darband' and contained:
            amb = next(p for p in payload['overview']['provinces'] if p['id'] == 'amb')
            amb.update(capitalCoordinates=reference['coordinates'], capitalCoordinateNote=references['source'])
            capital = next(f for f in payload['overview']['capitals']['features'] if f['properties']['id'] == 'amb')
            capital['geometry']['coordinates'] = reference['coordinates']
            capital['properties'].update(accuracy=references['source'], sourceUrl=reference['sourceUrl'])
    payload['administrativeReorganization']['referencePointChecks'] = point_checks
    payload['administrativeReorganization']['unresolvedPointReferences'] = references['unresolvedReferences']
    for p in payload['overview']['provinces']:
        if p['id'] in ('punjab', 'amb') and not any(r['url'] == references['licenseUrl'] for r in p['sources']):
            p['sources'].append({'title': 'OpenStreetMap reference points', 'url': references['licenseUrl'], 'note': references['source'] + '; ODbL-1.0; historical points do not define political boundaries.'})
    audit['placeCount'] = len(payload['overview']['places']['features'])
    audit['administrativeReorganization'] = {**audit['administrativeReorganization'], 'referencePointChecks': point_checks, 'unresolvedPointReferences': references['unresolvedReferences']}

if data.get('administrativeReorganization', {}).get('revision') == spec['revision']:
    refresh_editorial(data)
    temporary = PATH.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(PATH)
    (BASE / 'profiles.json').write_text(json.dumps(data['overview']['provinces'], ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Approved reorganization already applied; editorial metadata synchronized, geometry unchanged.')
    sys.exit(0)
if backup.exists():
    assert hashlib.sha256(backup.read_bytes()).digest() == hashlib.sha256(PATH.read_bytes()).digest(), 'Backup differs from current input; inspect before proceeding.'
else:
    shutil.copy2(PATH, backup)
for filename in ('areas.json', 'profiles.json', 'photos.json'):
    editorial_backup = BASE / ('before-united-punjab-48-amb-' + filename)
    if not editorial_backup.exists(): shutil.copy2(BASE / filename, editorial_backup)

punjab, kp = data['details']['punjab'], data['details']['kp']
retired = []
transformations = []
by_id = {f['properties']['id']: f for f in punjab['district']['features']}
for old_id, target_id in spec['retiredDistrictIds'].items():
    old, target = by_id[old_id], by_id[target_id]
    retired.append(copy.deepcopy(old))
    original_target = copy.deepcopy(target)
    setg(target, unary_union([g(target), g(old)]))
    p = target['properties']
    p['aliases'] = sorted(set(p.get('aliases', []) + old['properties'].get('aliases', []) + [old['properties']['name'], old['properties'].get('sourceName', '')]) - {p['name'], ''})
    p['mergedFrom'] = list(dict.fromkeys(p.get('mergedFrom', [p['name']]) + [old['properties']['name']]))
    p['sourceIds'] = list(dict.fromkeys(p.get('sourceIds', [p.get('sourceId')]) + [old['properties'].get('sourceId')]))
    p['sourceId'] = ' + '.join(x for x in p['sourceIds'] if x)
    p['sourceName'] = ' + '.join(dict.fromkeys([p.get('sourceName', ''), old['properties'].get('sourceName', '')]))
    p['keyCities'] = list(dict.fromkeys(p.get('keyCities', []) + old['properties'].get('keyCities', [])))
    p['photos'] = p.get('photos', []) + old['properties'].get('photos', [])
    scenario = aggregate_scenarios([original_target, old])
    if scenario:
        p['hypotheticalDemographics'] = scenario
    else:
        invalidate_stats(p)
    p['reason'] = 'Approved consolidation of ' + ' and '.join(p['mergedFrom']) + '; the complete existing fictional district polygons are retained.'
    p['summary'] = p.get('summary', '') + ' ' + p['reason']
    punjab['district']['features'].remove(old)
    for t in punjab['tehsil']['features']:
        q = t['properties']
        if q.get('parentDistrictId') == old_id:
            q.update(parentDistrictId=target_id, district=p['name'], capital=p['capital'], division=p.get('division', ''))
    transformations.append({'kind': 'district-merge', 'fromId': old_id, 'fromName': old['properties']['name'], 'toId': target_id, 'toName': p['name']})

source_path = ROOT / 'public/data/pk-country-tehsil.geojson'
source = {f['properties']['sourceCode']: f for f in json.loads(source_path.read_text(encoding='utf-8'))['features']}
codes = set(spec['districts'][2]['members']) | set(spec['amb']['members'])
raw = {identifier: shape(mapping(shapely.set_precision(g(source[identifier]), 0.000001))) for identifier in codes}
assert shapely.coverage_is_valid(list(raw.values())), 'Conflicting Mansehra source tehsil polygons; no assignment made.'
exact = {f['properties']['id']: f for f in data['exactGeometry']['features']}
original_ownership = {pid: g(f) for pid, f in exact.items()}
footprint_before = unary_union([g(f) for f in exact.values()])
transfer = unary_union(list(raw.values()))
assert transfer.difference(footprint_before).area < 1e-12, 'Source tehsils extend beyond the existing national footprint.'
to_punjab = unary_union([raw[x] for x in spec['districts'][2]['members']])
to_amb = unary_union([raw[x] for x in spec['amb']['members']])
corrections = []
for pid, f in exact.items():
    overlap = g(f).intersection(transfer)
    if overlap.area > 1e-12:
        corrections.append({'previousOwner': pid, 'areaKm2': area(overlap), 'degrees2': overlap.area,
                            'method': 'Full dated source polygons take ownership; subtract the identical polygon from each prior map owner.'})
        remainder = g(f).difference(transfer)
        if pid == 'punjab':
            remainder = unary_union([remainder, to_punjab])
        setg(f, remainder)
        # Align every affected detail level to this precise political border.
        for level in ('division', 'district', 'tehsil'):
            for child in list(data['details'][pid][level]['features']):
                if pid == 'kp' and level == 'tehsil' and code(child) in codes:
                    continue
                if pid == 'punjab':
                    # Preserve all existing district territory except the tiny
                    # dated Oghi/Darband seam, recorded explicitly in the audit.
                    value = g(child).difference(to_amb)
                else:
                    value = g(child).difference(transfer)
                if value.is_empty:
                    if level == 'district': retired.append(copy.deepcopy(child))
                    data['details'][pid][level]['features'].remove(child)
                elif g(child).symmetric_difference(value).area > 1e-14:
                    setg(child, value)
                    child['properties']['geometryAdjustment'] = 'Approved complete 2022 source transfer; see administrativeReorganization audit.'
                    child['properties']['areaKm2'] = area(value)
                    invalidate_stats(child['properties'])
        setg(data['details'][pid]['province']['features'][0], remainder)

amb_profile = copy.deepcopy(next(p for p in data['overview']['provinces'] if p['id'] == 'chandigarh'))
amb_profile.update(id='amb', name='Amb', officialName=spec['amb']['officialName'], capital='Darband',
    classification='Union territory', color=spec['amb']['color'], aliases=['Union Territory of Amb', 'Oghi', 'Darband', 'Tanawal', 'Shergarh', 'Phulra'],
    largestCity='Unavailable: no comparable city ranking verified.', majorCities=['Darband', 'Oghi'],
    capitalCoordinates=list(raw['PK52205'].representative_point().coords[0]),
    capitalCoordinateNote='Approximate UT map symbol at the Darband tehsil representative point; not a surveyed town location.',
    rivers='Indus and Agror / Tanawal tributaries', landscape='Tanawal and Agror valleys and surrounding Hazara hills',
    etymology='Inspired by the historical Tanoli-ruled Amb princely state.', languages=['Hindko', 'Pashto'], officialLanguages=[],
    communities=['Tanoli and other regional communities'], festivals='Regional community observances; no complete sourced calendar is supplied.',
    heritage=spec['amb']['heritage'], history='Historical royal centre: Shergarh. ' + spec['amb']['limitation'],
    proposal='A separate fictional Union Territory formed from verified Darband and Oghi tehsils.',
    overview='Union Territory of Amb, administered from Darband. ' + spec['amb']['limitation'],
    arts='Tanoli regional heritage and historical royal architecture.', photos=[], silhouette='',
    detailNote=spec['amb']['limitation'], detailCounts={'province': 1, 'division': 0, 'district': 0, 'tehsil': 2},
    sources=[{'title': 'WFP/OCHA 2022 administrative source', 'url': spec['sourceUrl'], 'note': 'Modern dated tehsil polygons; not historical princely-state boundaries.'}],
    historicalReferences=[{'name': 'Shergarh', 'role': 'Historical royal centre', 'geometryStatus': 'reference only'}, {'name': 'Phulra', 'role': 'Historical Tanawal reference', 'geometryStatus': 'unresolved sub-tehsil boundary; excluded from assignments'}])
for key in ('population', 'density', 'census', 'previousBoundaryStatistics', 'previousBoundaryDemographics'):
    amb_profile.pop(key, None)
invalidate_stats(amb_profile)
amb_feature = {'type': 'Feature', 'id': 'amb', 'properties': {'id': 'amb', 'name': 'Amb', 'classification': 'Union territory', 'color': spec['amb']['color']}, 'geometry': None}
setg(amb_feature, to_amb)
data['exactGeometry']['features'].append(copy.deepcopy(amb_feature))
exact['amb'] = data['exactGeometry']['features'][-1]
data['details']['amb'] = {'province': fc([copy.deepcopy(amb_feature)]), 'division': fc([]), 'district': fc([]), 'tehsil': fc([])}
data['overview']['provinces'].append(amb_profile)
data['overview']['capitals']['features'].append({'type': 'Feature', 'id': 'amb', 'properties': {'id': 'amb', 'name': 'Darband', 'province': 'amb', 'color': spec['amb']['color'], 'accuracy': amb_profile['capitalCoordinateNote']}, 'geometry': {'type': 'Point', 'coordinates': amb_profile['capitalCoordinates']}})

# Node the affected shared linework once. Independent differences otherwise
# retain different vertices at a source-edition intersection (T junctions).
# Polygonized faces use only existing and approved source boundary segments.
# No new straight boundary or territorial simplification is introduced.
donors = [r['previousOwner'] for r in corrections]
linework = shapely.union_all([original_ownership[pid].boundary for pid in donors] + [v.boundary for v in raw.values()])
faces = list(shapely.get_parts(shapely.polygonize(shapely.get_parts(shapely.node(linework)))))
assigned = {pid: [] for pid in donors + ['amb']}
for face in faces:
    point = face.representative_point()
    owner = 'amb' if to_amb.covers(point) else 'punjab' if to_punjab.covers(point) else next((pid for pid in donors if original_ownership[pid].covers(point)), None)
    if owner: assigned[owner].append(face)
for pid, members in assigned.items():
    value = unary_union(members)
    setg(exact[pid], value)
    setg(data['details'][pid]['province']['features'][0], value)
assert shapely.coverage_is_valid([g(f) for f in exact.values()]), 'Noded source faces do not form valid coverage.'

all_tehsils = {code(f): f for pid in ('punjab', 'kp') for f in data['details'][pid]['tehsil']['features']}
for identifier in codes:
    feature = all_tehsils[identifier]
    kp['tehsil']['features'].remove(feature)
    setg(feature, raw[identifier])
    if identifier in spec['amb']['members']:
        data['details']['amb']['tehsil']['features'].append(feature)
    else:
        punjab['tehsil']['features'].append(feature)
# A completely transferred source district is retired, including old display remnants.
for f in list(kp['district']['features']):
    if f['properties']['id'] == 'kp-d-mansehra':
        retired.append(copy.deepcopy(f))
        kp['district']['features'].remove(f)

for district_spec in spec['districts']:
    district = by_id.get(district_spec['id'])
    if district is None:
        district = {'type': 'Feature', 'id': district_spec['id'], 'properties': {}, 'geometry': None}
        punjab['district']['features'].append(district)
        setg(district, to_punjab)
    p = district['properties']
    p.update({k: district_spec[k] for k in ('id', 'name', 'capital', 'designation', 'division', 'summary')})
    p.update(province='punjab', origin='Khyber Pakhtunkhwa', divisionCapital='Abbottabad' if p['division'] == 'Hazara' else '',
        sourceTehsils=list(district_spec['members']), heritage=district_spec['heritage'], keyCities=list(district_spec['members'].values()),
        memberTehsils=[{'sourceCode': x, 'name': name, 'sourceName': source[x]['properties']['name'], 'aliases': spec['aliases'].get(x, [])} for x, name in district_spec['members'].items()],
        reason=district_spec['summary'], decision='Approved final fictional district', transferStatus='existing',
        sourceValidOn=spec['sourceDate'], geometrySourceUrl=spec['sourceUrl'],
        limitation='Dated polygons retained in full; later subdivisions are not implied. ' + (spec['mansehraApproval'] if p['name'] == 'Hazarawala' else 'Settlement and heritage-site names remain unchanged.'))
    p.setdefault('sourceName', 'Mansehra')
    p.setdefault('sourceId', 'PK52201 + PK52202 + PK52204')
    invalidate_stats(p)
    for identifier, name in district_spec['members'].items():
        t = all_tehsils[identifier]
        q = t['properties']
        original_name = q.get('originalTehsil') or source[identifier]['properties']['name']
        q.update(name=name, sourceName=original_name, originalTehsil=original_name, aliases=list(dict.fromkeys(spec['aliases'].get(identifier, []) + ([original_name] if original_name != name else []))),
            sourceCode=identifier, sourceValidOn=spec['sourceDate'], geometrySourceUrl=spec['sourceUrl'],
            province='punjab', parentProvinceId='punjab', district=p['name'], proposedDistrict=p['name'], parentDistrictId=p['id'],
            capital=p['capital'], division=p['division'], divisionCapital=p['divisionCapital'], transferStatus='existing',
            decision='Approved final assignment to ' + p['name'], arrangement=p['summary'], limitation=p['limitation'],
            namingStatus='renamed' if name != original_name else 'source', namingReason='Approved administrative name inspired by the district’s recorded heritage; original polygon and settlement names retained.',
            nameMeaning={'Hund': 'Hund / Udabhanda, the ancient Hindu Shahi capital', 'Mahabanpur': 'Inspired by the Mahaban mountain region', 'Ranigat': 'Inspired by the Ranigat Buddhist archaeological complex', 'Haro': 'Named for the Haro River', 'Sherwan': 'Uses the existing Sherwan place-name; retains the Lower Tanawal polygon', 'Pakhli': 'Named for the historic Pakhli region'}.get(name, q.get('nameMeaning', 'Existing geographical name')),
            namingProvenance='User-approved fictional reorganization; historical settlement names are retained.', namingSourceUrl=spec['sourceUrl'],
            areaKm2=area(g(t)))
        transformations.append({'kind': 'tehsil-assignment', 'sourceCode': identifier, 'id': q['id'], 'originalName': original_name, 'name': name, 'province': 'punjab', 'districtId': p['id'], 'aliases': q['aliases']})
for identifier, name in spec['amb']['members'].items():
    q = all_tehsils[identifier]['properties']
    q.update(name=name, province='amb', parentProvinceId='amb', parentUnitId='amb', parentLevel='union-territory',
             district='', proposedDistrict='', division='', capital='Darband', transferStatus='existing',
             sourceCode=identifier, sourceValidOn=spec['sourceDate'], geometrySourceUrl=spec['sourceUrl'],
             decision='Assigned directly to Union Territory of Amb', heritage=spec['amb']['heritage'], limitation=spec['amb']['limitation'],
             areaKm2=area(g(all_tehsils[identifier])))
    q.pop('parentDistrictId', None)
    transformations.append({'kind': 'tehsil-assignment', 'sourceCode': identifier, 'id': q['id'], 'name': name, 'province': 'amb', 'parentLevel': 'union-territory'})

# Refresh counts and area for changed districts; leave the other 45 original
# territories and their underlying statistics untouched.
changed_ids = set(spec['retiredDistrictIds'].values()) | {s['id'] for s in spec['districts']}
for d in punjab['district']['features']:
    p = d['properties']
    if p['id'] in changed_ids:
        members = [t for t in punjab['tehsil']['features'] if t['properties']['parentDistrictId'] == p['id']]
        p.update(tehsilCount=len(members), areaKm2=area(g(d)))
        if p.get('hypotheticalDemographics'):
            p['density'] = round(p['hypotheticalDemographics']['total'] / p['areaKm2'], 1)
assert len(punjab['district']['features']) == spec['districtCount']

for division in punjab['division']['features']:
    p = division['properties']
    members = [f for f in punjab['district']['features'] if f['properties'].get('division') == p['name']]
    # Existing division footprints change only where consolidation crosses them.
    if p['name'] in ('Ludhiana', 'Patiala', 'Hazara'):
        setg(division, unary_union([g(f) for f in members]))
    p.update(memberDistricts=[f['properties']['name'] for f in members], pendingDistricts=[], districtCount=len(members),
             tehsilCount=sum(f['properties']['tehsilCount'] for f in members), areaKm2=area(g(division)),
             districtStats=[{k: f['properties'][k] for k in ('name', 'areaKm2', 'tehsilCount')} for f in members])
    scenario = aggregate_scenarios(members)
    if scenario: p['hypotheticalDemographics'] = scenario
    else: p.pop('hypotheticalDemographics', None)
    if p['name'] == 'Hazara':
        p.update(description='Fictional Hazara Division comprises the merged Haripur district and new Hazarawala district. Abbottabad is divisional headquarters. Amb is a separate Union Territory.', areaNote='Geodesic area of the approved complete district polygons.')
for pid in ('kp', 'amb'):
    for level in ('division', 'district'):
        for f in data['details'][pid][level]['features']:
            p = f['properties']
            if level == 'district':
                p['tehsilCount'] = sum(t['properties'].get('parentDistrictId') == p['id'] for t in data['details'][pid]['tehsil']['features'])
            if pid == 'kp' and p.get('name') == 'Hazara':
                p['description'] = 'Remaining KP Hazara territory after the approved Punjab and Amb transfers.'

affected_profiles = {r['previousOwner'] for r in corrections} | {'amb', 'punjab', 'kp'}
areas = json.loads((BASE / 'areas.json').read_text(encoding='utf-8'))
for p in data['overview']['provinces']:
    pid = p['id']
    if pid not in affected_profiles: continue
    value = g(exact[pid])
    p.update(bbox=list(value.bounds), center=list(value.representative_point().coords[0]), areaKm2=area(value), silhouette='',
             detailCounts={level: len(collection['features']) for level, collection in data['details'][pid].items()})
    areas[pid] = p['areaKm2']
    invalidate_stats(p)
    if pid == 'punjab':
        p.update(detailNote='48 districts: 22 Indian Punjab-origin, 23 Pakistani Punjab-origin and 3 KP-origin. Complete 2022 Mansehra source edition approved; Amb is a separate UT.',
            proposal='Approved 48-district United Punjab, including Barnala merged into Sangrur.',
            overview='United Punjab combines its approved plains and foothill districts with Hazarawala’s complete Kaghan Valley mountain extent. Amb is a separate Union Territory.',
            landscape='Five-river plains, Pothohar plateau, Hazara foothills and the high Himalayan Kaghan Valley',
            heritage=p['heritage'] + ['Mahan Singh Hazarawala', 'Kaghan Valley', 'Babusar Pass'])
    elif pid == 'kp':
        p.update(detailNote='Pabbi, remaining Buner and Tor Ghar stay KP. Mansehra source district has been fully assigned to Hazarawala and Amb using the approved dated tehsil polygons.',
            proposal='Remaining KP after the approved final fictional reorganization.',
            overview='KP retains its other approved districts and heritage. Pabbi remains in Nowshera. The Mansehra source district is divided between Hazarawala in United Punjab and the independent Amb Union Territory.')
for f in punjab['division']['features']:
    f['properties']['provinceAreaShare'] = round(100 * f['properties']['areaKm2'] / areas['punjab'], 2)

values = [g(f) for f in data['exactGeometry']['features']]
if not shapely.coverage_is_valid(values):
    (ROOT / 'work/reorganization-outline-debug.json').write_text(json.dumps(data['exactGeometry']), encoding='utf-8')
    print('Invalid shared edges:', [(f['properties']['id'], list(edge.bounds), edge.length) for f, edge in zip(data['exactGeometry']['features'], shapely.coverage_invalid_edges(values)) if not edge.is_empty], flush=True)
assert shapely.coverage_is_valid(values), 'Invalid shared-edge national coverage.'
assert footprint_before.symmetric_difference(unary_union(values)).area < 1e-9, 'National footprint changed.'
data['overview']['geometry'] = fc([])
for f, value in zip(data['exactGeometry']['features'], shapely.coverage_simplify(values, 0.002)):
    displayed = copy.deepcopy(f)
    setg(displayed, value)
    data['overview']['geometry']['features'].append(displayed)
# Existing place names are preserved; only political ownership follows the map.
for f in data['overview']['places']['features']:
    point = Point(f['geometry']['coordinates'])
    for pid in affected_profiles:
        if g(exact[pid]).covers(point):
            f['properties']['province'] = pid
            break

# Lightweight alias-aware administrative index; source polygons stay paged.
search = []
for pid, levels in data['details'].items():
    for level in ('district', 'tehsil'):
        for f in levels[level]['features']:
            p = f['properties']
            search.append({'id': p['id'], 'name': p['name'], 'province': pid, 'level': level,
                'aliases': list(dict.fromkeys(p.get('aliases', []) + [p.get('sourceName', ''), p.get('originalTehsil', '')])),
                'parentDistrictId': p.get('parentDistrictId'), 'capital': p.get('capital', ''), 'bbox': list(g(f).bounds)})
data['administrativeSearch'] = search
for row in data['analysis']['changes']:
    old_id = row.get('proposedDistrict')
    rename = {'Swabi': 'Akali Phula Singh', 'Abbottabad': 'Haripur', 'Barnala': 'Sangrur', 'Chakwal': 'Katas', 'Narowal': 'Kartarpur Sahib'}
    if row.get('provinceId') == 'punjab' and old_id in rename:
        row['proposedDistrict'] = rename[old_id]
    f = all_tehsils.get(row.get('sourceId'))
    if f and code(f) in set(spec['aliases']) | codes:
        q = f['properties']
        row.update(proposedProvince='Amb' if q['province'] == 'amb' else 'Punjab', provinceId=q['province'], proposedDistrict=q['district'], proposedTehsil=q['name'], proposedCapital=q['capital'])
for identifier in codes:
    q = all_tehsils[identifier]['properties']
    if not any(r['sourceId'] == identifier for r in data['analysis']['changes']):
        data['analysis']['changes'].append({'sourceId': identifier, 'currentDistrict': 'Mansehra', 'currentTehsil': q['originalTehsil'],
            'proposedProvince': 'Amb' if q['province'] == 'amb' else 'Punjab', 'provinceId': q['province'],
            'proposedDistrict': q['district'], 'proposedTehsil': q['name'], 'proposedCapital': q['capital'],
            'proposedDivision': q['division'], 'divisionCapital': 'Abbottabad' if q['province'] == 'punjab' else '',
            'reason': q['decision'], 'method': 'Complete verified 2022-09-09 source polygon; explicit user-approved dated Mansehra edition.'})
for row in data['analysis']['kpReview']:
    f = all_tehsils.get(row['sourceId'])
    if f:
        q = f['properties']
        row.update(proposedProvince={'punjab': 'Punjab', 'amb': 'Amb', 'kp': 'Khyber Pakhtunkhwa'}[q['province']], decision='Transfer approved' if q['province'] != 'kp' else 'Retain', reason=q.get('decision', 'Retained in KP'), source=spec['sourceUrl'])
data['analysis']['decisions'] = [r for r in data['analysis']['decisions'] if not any(x in r for x in ('Mansehra-only', 'remain separate districts', 'pending a verified', '50 districts', '49 districts'))]
data['analysis']['decisions'] += ['Final approved structure: 48 United Punjab districts and separate Amb Union Territory.', spec['mansehraApproval'], spec['amb']['limitation']]
data['territorialReview'].update(revision=spec['revision'], pendingDistricts=[], limitations=[spec['amb']['limitation']], division={'name': 'Hazara', 'headquarters': 'Abbottabad', 'districts': ['Haripur', 'Hazarawala'], 'pending': []})
audit = {'revision': spec['revision'], 'districtCount': 48, 'punjabTehsilCount': len(punjab['tehsil']['features']),
    'sourceDate': spec['sourceDate'], 'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
    'sourceFootprintDifferenceDegrees2': footprint_before.symmetric_difference(unary_union(values)).area,
    'sharedCoverageValid': bool(shapely.coverage_is_valid(values)), 'ownershipCorrections': corrections, 'geometryRepairs': repairs,
    'ambAreaKm2': areas['amb'], 'punjabAreaKm2': areas['punjab'], 'remainingKpAreaKm2': areas['kp'],
    'limitations': [spec['amb']['limitation'], spec['mansehraApproval']]}
data['administrativeReorganization'] = {**audit, 'transformations': transformations, 'retiredDistrictIds': spec['retiredDistrictIds'], 'historicalReferences': amb_profile['historicalReferences']}
data['analysis']['audit'].update(provinceCount=len(values), administrativeReorganization=audit)
data['overview']['auditSummary']['provinceCount'] = len(values)
refresh_editorial(data)

def write(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)

write(BASE / 'administrative-history.json', {'revision': spec['revision'], 'retiredDistricts': retired, 'previousAtlas': backup.name})
write(BASE / 'areas.json', areas)
write(BASE / 'profiles.json', data['overview']['provinces'])
write(PATH, data)
print(json.dumps(audit, ensure_ascii=True))
