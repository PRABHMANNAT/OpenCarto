"""Apply the reviewed Punjab district changes to the private atlas payload.

Run after private/united-atlas/finalize.py and before compact.py and packing.
The plain payload is ignored by Git; this tracked step keeps edits reproducible.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'work/geometry-runtime'))
from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union
from geographiclib.geodesic import Geodesic

PATH = ROOT / 'private/united-atlas/atlas.json'
payload = json.loads(PATH.read_text(encoding='utf-8'))
punjab = payload['details']['punjab']
districts = punjab['district']['features']
tehsils = punjab['tehsil']['features']
by_id = {feature['properties']['id']: feature for feature in districts}


def geometry(feature):
    return shape(feature['geometry'])


def set_geometry(feature, value):
    if value.is_empty or not value.is_valid:
        raise ValueError(f"Invalid geometry for {feature['properties']['id']}")
    feature['geometry'] = mapping(value)
    feature['properties']['bbox'] = list(value.bounds)
    feature['properties']['center'] = list(value.representative_point().coords[0])


def combine(keep_id, remove_id, name, reason):
    if remove_id not in by_id:
        if keep_id not in by_id or by_id[keep_id]['properties']['name'] != name:
            raise ValueError(f'Expected source district {remove_id}')
        return
    keep, remove = by_id[keep_id], by_id.pop(remove_id)
    left, right = geometry(keep), geometry(remove)
    joined = unary_union([left, right])
    if abs(joined.area - (left.area + right.area - left.intersection(right).area)) > 1e-8:
        raise ValueError(f'Area changed while merging {keep_id} and {remove_id}')
    old_names = [keep['properties']['name'], remove['properties']['name']]
    set_geometry(keep, joined)
    keep['properties'].update(
        name=name,
        mergedFrom=old_names,
        sourceId=' + '.join(dict.fromkeys([
            keep['properties']['sourceId'], remove['properties']['sourceId']
        ])),
        sourceTehsils=sorted({
            tehsil['properties']['sourceId'] for tehsil in tehsils
            if tehsil['properties'].get('district') in old_names
        }),
        reason=reason,
    )
    districts.remove(remove)


combine(
    'punjab-d-panja-sahib', 'punjab-d-attock', 'Panja Sahib',
    'The full Attock source district, including Hasan Abdal, forms the proposed Panja Sahib district.',
)

rawalpindi = by_id['punjab-d-rawalpindi']
taxila_id = 'punjab-d-taxila'
if taxila_id not in by_id:
    source = next(
        feature for feature in tehsils
        if feature['properties']['sourceId'] == 'PK63007'
    )
    before = geometry(rawalpindi)
    taxila_shape = before.intersection(geometry(source))
    remainder = before.difference(taxila_shape)
    if taxila_shape.area < 0.02 or remainder.area < 0.4:
        raise ValueError('Taxila source tehsil does not partition Rawalpindi as expected')
    taxila = {
        'type': 'Feature',
        'id': taxila_id,
        'properties': {
            **rawalpindi['properties'],
            'id': taxila_id,
            'name': 'Taxila',
            'capital': 'Taxila',
            'sourceTehsils': ['PK63007'],
            'reason': 'Taxila source tehsil forms a separate proposed district; the rest remains Rawalpindi.',
        },
        'geometry': None,
    }
    set_geometry(taxila, taxila_shape)
    set_geometry(rawalpindi, remainder)
    districts.insert(districts.index(rawalpindi) + 1, taxila)
    by_id[taxila_id] = taxila

combine(
    'punjab-d-haripur-hazara', 'punjab-d-havelian-lora', 'Haripur',
    'Ghazi, Haripur and Khanpur join Havelian and Lora in one proposed Haripur district.',
)
combine(
    'punjab-d-sahiwal', 'punjab-d-okara', 'Harappa',
    'The Sahiwal and Okara source districts form one proposed Harappa district.',
)
combine(
    'punjab-d-sangrur', 'punjab-d-malerkotla', 'Sangrur',
    'The Malerkotla source district joins Sangrur in this proposed district.',
)

renames = {
    'punjab-d-katas-raj-salt-range': 'Katas',
    'punjab-d-gujrat': 'Dinga',
    'punjab-d-gujranwala': 'Ranjitgarh',
    'punjab-d-faisalabad': 'Sandalbar',
    'punjab-d-kasur-bulleh-shah': 'Bulleh Shah',
    'punjab-d-pakpattan': 'Nanaksar',
    'punjab-d-sheikhupura': 'Sacha Sauda',
    'punjab-d-mandi-bahauddin': 'Kair Sahib',
    'punjab-d-sialkot': 'Babe Di Ber',
    'punjab-d-hafizabad': 'Rori Sahib',
    'punjab-d-chiniot': 'Chenab',
    'punjab-d-kartarpur-ravi': 'Kartarpur Sahib',
}
for district_id, name in renames.items():
    by_id[district_id]['properties']['name'] = name

district_names = {
    'Attock': 'Panja Sahib',
    'Panja Sahib': 'Panja Sahib',
    'Havelian–Lora': 'Haripur',
    'Haripur–Hazara': 'Haripur',
    'Sahiwal': 'Harappa',
    'Okara': 'Harappa',
    'Malerkotla': 'Sangrur',
    'Sangrur': 'Sangrur',
    'Katas Raj–Salt Range': 'Katas',
    'Gujrat': 'Dinga',
    'Gujranwala': 'Ranjitgarh',
    'Faisalabad': 'Sandalbar',
    'Kasur–Bulleh Shah': 'Bulleh Shah',
    'Pakpattan': 'Nanaksar',
    'Ganjshakar': 'Nanaksar',
    'Sheikhupura': 'Sacha Sauda',
    'Mandi Bahauddin': 'Kair Sahib',
    'Sialkot': 'Babe Di Ber',
    'Hafizabad': 'Rori Sahib',
    'Chiniot': 'Chenab',
    'Kartarpur–Ravi': 'Kartarpur Sahib',
}
district_notes = {
    'punjab-d-gujranwala': ('Ranjitgarh is a proposed commemorative name honouring Maharaja Ranjit Singh, whose family home and Sikh rule are part of Gujranwala’s history.', 'https://gujranwala.punjab.gov.pk/important-places'),
    'punjab-d-sheikhupura': ('Sacha Sauda recalls the Guru Nanak tradition of selfless service at the historic shrine in the Sheikhupura area.', 'https://etpb.gov.pk/virtual-tour/gurdwara-sacha-sauda/'),
    'punjab-d-pakpattan': ('Nanaksar is a proposed symbolic name linking Guru Nanak’s travels with Pakpattan and the verses of Baba Farid preserved in Sikh scripture; it does not relocate a Nanaksar shrine.', 'https://sgpc.net/sri-guru-granth-sahib-2/'),
    'punjab-d-mandi-bahauddin': ('Kair Sahib recalls the local tradition of Gurdwara Kair Sahib at Jai Sukh Wala in the Mandi Bahauddin area.', 'https://www.worldgurudwaras.com/gurudwara-kair-sahib-at-jai-sukh-wala-district-mandi-bahauddin/'),
    'punjab-d-sialkot': ('Babe Di Ber recalls the historic Guru Nanak-associated gurdwara in Sialkot.', 'https://etpb.gov.pk/shrines/gurdwaras/functional/'),
    'punjab-d-hafizabad': ('Rori Sahib is a proposed heritage tribute. The well-documented Gurdwara Rori Sahib at Eminabad is in Gujranwala, not Hafizabad.', 'https://etpb.gov.pk/shrines/gurdwaras/functional/'),
    'punjab-d-chiniot': ('Chenab recalls the river and its long role in the landscape of this part of Punjab.', 'https://epd.punjab.gov.pk/system/files/2025%20295.pdf'),
}
for district_id, (reason, url) in district_notes.items():
    by_id[district_id]['properties'].update(reason=reason, namingSourceUrl=url)
capitals = {feature['properties']['name']: feature['properties']['capital'] for feature in districts}
for tehsil in tehsils:
    props = tehsil['properties']
    old_name = props.get('district')
    props['district'] = (
        'Taxila' if props['sourceId'] == 'PK63007'
        else district_names.get(old_name, old_name)
    )
    if props['district'] in capitals:
        props['capital'] = capitals[props['district']]

# The source tehsil edition omits Guru Har Sahai even though the Ferozepur
# district contains its area. Reconstruct the missing polygon from that
# district's uncovered space; the official town point must lie inside it.
guru_id = 'in-t-guru-har-sahai'
if not any(feature['properties']['sourceId'] == guru_id for feature in tehsils):
    ferozepur = next(feature for feature in districts if feature['properties']['name'] == 'Ferozepur')
    local_tehsils = [feature for feature in tehsils if feature['properties']['district'] == 'Ferozepur']
    uncovered = geometry(ferozepur).difference(unary_union([geometry(feature) for feature in local_tehsils]))
    parts = list(uncovered.geoms) if uncovered.geom_type == 'MultiPolygon' else [uncovered]
    missing = max(parts, key=lambda part: part.area)
    if not 0.04 < missing.area < 0.05 or not missing.covers(Point(74.3998, 30.7113)):
        raise ValueError('The expected Guru Har Sahai coverage is missing or has moved')
    template = next(feature for feature in local_tehsils if feature['properties']['sourceId'] == 'in-t-235')
    source_url = 'https://ferozepur.nic.in/administrative-setup/'
    guru = {
        'type': 'Feature',
        'id': f'punjab-t-{guru_id}',
        'properties': {
            **template['properties'],
            'id': f'punjab-t-{guru_id}',
            'sourceId': guru_id,
            'sourceName': 'Guru Har Sahai',
            'name': 'Guru Har Sahai',
            'source': 'Reconstructed from the uncovered Ferozepur district area',
            'note': 'Official tehsil listed by Ferozepur district; map outline reconstructed from uncovered district space, not independently surveyed.',
            'geometryAdjustment': 'Reconstructed from uncovered Ferozepur district coverage; official boundary not independently verified.',
            'geometrySourceUrl': source_url,
        },
        'geometry': None,
    }
    set_geometry(guru, missing)
    tehsils.append(guru)
    ferozepur['properties']['sourceTehsils'] = sorted(set(ferozepur['properties']['sourceTehsils']) | {guru_id})
    source_row = next(row for row in payload['analysis']['changes'] if row.get('sourceId') == 'in-t-235')
    payload['analysis']['changes'].append({
        **source_row,
        'currentTehsil': 'Guru Har Sahai',
        'sourceId': guru_id,
        'proposedTehsil': 'Guru Har Sahai',
        'reason': 'Restore the official Guru Har Sahai tehsil omitted by the source tehsil geometry.',
        'method': 'Approximate outline from Ferozepur district area not covered by the other source tehsils.',
    })

# Lahore's source tehsils leave visible strips inside their parent district.
# Join each uncovered face to the Lahore tehsil sharing the most boundary.
lahore = next(feature for feature in districts if feature['properties']['name'] == 'Lahore')
lahore_tehsils = [feature for feature in tehsils if feature['properties']['district'] == 'Lahore']
uncovered = geometry(lahore).difference(unary_union([geometry(feature) for feature in lahore_tehsils]))
parts = list(uncovered.geoms) if uncovered.geom_type == 'MultiPolygon' else [uncovered]
for piece in sorted((part for part in parts if part.area > 1e-7), key=lambda part: part.area, reverse=True):
    owner = max(lahore_tehsils, key=lambda feature: piece.boundary.intersection(geometry(feature).boundary).length)
    shared = piece.boundary.intersection(geometry(owner).boundary).length
    if shared <= 1e-7:
        raise ValueError(f'A Lahore coverage gap does not touch a tehsil: area={piece.area}, bounds={piece.bounds}')
    set_geometry(owner, unary_union([geometry(owner), piece]))
    owner['properties']['geometryAdjustment'] = 'Unassigned space inside Lahore district joined to the adjoining source tehsil.'
remaining = geometry(lahore).difference(unary_union([geometry(feature) for feature in lahore_tehsils]))
if remaining.area > 1e-6:
    raise ValueError(f'Lahore still has uncovered tehsil area: {remaining.area}')

name_rows = json.loads((ROOT / 'scripts/punjab-tehsil-heritage-names.json').read_text(encoding='utf-8'))['rows']
if len(name_rows) != 181 or len({row['sourceId'] for row in name_rows}) != 181:
    raise ValueError('Name registry must contain 180 reviewed and one restored Punjab tehsil')
review_by_id = {row['sourceId']: row for row in name_rows}
source_ids = {feature['properties']['sourceId'] for feature in tehsils}
if source_ids != set(review_by_id):
    raise ValueError('Heritage review does not cover the current Punjab tehsil source IDs')

display_districts = {
    'Chakwal': 'Katas',
    'Narowal': 'Kartarpur Sahib',
    'Kartarpur–Ravi': 'Kartarpur Sahib',
}
for tehsil in tehsils:
    props = tehsil['properties']
    row = review_by_id[props['sourceId']]
    source = props.get('sourceName') or props['name']
    if source != row['oldName'] or display_districts.get(props['district'], props['district']) != row['proposedDistrict']:
        raise ValueError(f"Review source or district mismatch for {props['sourceId']}")
    if row['decision'] not in {'Retained', 'Renamed', 'Added'}:
        raise ValueError(f"Unknown review decision for {props['sourceId']}")
    if not all(row[key].strip() for key in ('newName', 'meaning', 'history')) or any(
        mark in row['newName'] for mark in ('-', '·')
    ):
        raise ValueError(f"Invalid review label or description for {props['sourceId']}")
    props.update(
        sourceName=source,
        name=row['newName'],
        nameMeaning=row['meaning'],
        namingReason=row['history'],
        namingStatus={'Renamed': 'renamed', 'Retained': 'source', 'Added': 'restored'}[row['decision']],
        namingProvenance=row.get('provenance', 'User-provided United Panjab heritage review'),
    )
    props.pop('namingSourceUrl', None)
    if row.get('sourceUrl'):
        props['namingSourceUrl'] = row['sourceUrl']

tehsil_names = {feature['properties']['sourceId']: feature['properties']['name'] for feature in tehsils}
for row in payload['analysis']['changes']:
    if row.get('provinceId') == 'punjab' and row.get('sourceId') in tehsil_names:
        row['proposedTehsil'] = tehsil_names[row['sourceId']]

for row in payload['analysis']['changes']:
    if row.get('provinceId') != 'punjab':
        continue
    old_name = row.get('proposedDistrict')
    row['proposedDistrict'] = (
        'Taxila' if row.get('sourceId') == 'PK63007'
        else district_names.get(old_name, old_name)
    )
    if row['proposedDistrict'] in capitals:
        row['proposedCapital'] = capitals[row['proposedDistrict']]

# Division outlines follow the requested district grouping exactly, including
# the two separate Kartarpur Sahib and Narowal district features.
division_specs = json.loads((ROOT / 'scripts/punjab-divisions.json').read_text(encoding='utf-8'))
division_profiles = json.loads((ROOT / 'scripts/punjab-division-profiles.json').read_text(encoding='utf-8'))
division_photos = json.loads((ROOT / 'scripts/punjab-division-photos.json').read_text(encoding='utf-8'))
shrine_photos = {photo['id']: photo for photo in json.loads((ROOT / 'app/gurdwara-photo-sources.json').read_text(encoding='utf-8'))['photos']}
province_photos = json.loads((ROOT / 'private/united-atlas/photos.json').read_text(encoding='utf-8'))['punjab']
cities = {feature['properties']['name']: feature for feature in json.loads((ROOT / 'public/data/cities.geojson').read_text(encoding='utf-8'))['features']}
district_by_name = {feature['properties']['name']: feature for feature in districts}
district_to_division = {}
new_divisions = []


def division_member_geometry(feature):
    original = geometry(feature)
    if original.is_valid:
        return original
    # The source Rawalpindi polygon has one sub-metre self-intersection. Repair
    # only the derived division outline; keep the reviewed district untouched.
    repaired = original.buffer(0)
    if not repaired.is_valid or abs(repaired.area - original.area) > 1e-7:
        raise ValueError(f"Division union cannot safely repair {feature['properties']['name']}")
    return repaired


def area_km2(value):
    total = 0
    for polygon in ([value] if value.geom_type == 'Polygon' else value.geoms):
        for index, ring in enumerate([polygon.exterior, *polygon.interiors]):
            area = Geodesic.WGS84.Polygon()
            for longitude, latitude in ring.coords:
                area.AddPoint(latitude, longitude)
            total += (1 if index == 0 else -1) * abs(area.Compute()[2]) / 1e6
    return round(total, 2)


province_area = area_km2(geometry(punjab['province']['features'][0]))
if len(division_specs) != 11 or len(district_by_name) != len(districts):
    raise ValueError('Expected eleven requested divisions and uniquely named Punjab districts')
for spec in division_specs:
    division_name = spec['name']
    profile = division_profiles[division_name]
    if not division_name or not spec['headquarters'] or not spec['districts']:
        raise ValueError(f'Incomplete Punjab division: {division_name}')
    members = []
    for district_name in spec['districts']:
        if district_name not in district_by_name or district_name in district_to_division:
            raise ValueError(f'Missing or repeated Punjab division district: {district_name}')
        district_to_division[district_name] = spec
        members.append(district_by_name[district_name])
    division = {
        'type': 'Feature',
        'id': 'punjab-div-' + division_name.lower().replace(' ', '-'),
        'properties': {
            'id': 'punjab-div-' + division_name.lower().replace(' ', '-'),
            'name': division_name,
            'province': 'punjab',
            'capital': spec['headquarters'],
            'memberDistricts': spec['districts'],
        },
        'geometry': None,
    }
    set_geometry(division, unary_union([division_member_geometry(member) for member in members]))
    city = cities.get(profile['sourceCity'])
    headquarters_coordinates = profile.get('coordinates') or city['geometry']['coordinates']
    headquarters_source = profile.get('coordinateSource') or 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/'
    if not geometry(division).covers(Point(headquarters_coordinates)):
        raise ValueError(f'Headquarters is outside its division: {division_name}')
    if profile.get('photoId'):
        photo_source = shrine_photos[profile['photoId']]
        photo = {key: photo_source[key] for key in ('title', 'author', 'license', 'licenseUrl', 'sourceUrl')}
        photo.update(url=photo_source['file'], caption=profile['landmark'], changes='Responsive display crop.')
    elif profile.get('provincePhotoTitle'):
        photo = next(photo for photo in province_photos if photo['title'] == profile['provincePhotoTitle'])
    else:
        photo = division_photos[division_name]
    district_stats = [dict(
        name=member['properties']['name'],
        areaKm2=area_km2(division_member_geometry(member)),
        tehsilCount=sum(tehsil['properties']['district'] == member['properties']['name'] for tehsil in tehsils),
    ) for member in members]
    division_area = area_km2(geometry(division))
    division['properties'].update(
        areaKm2=division_area,
        provinceAreaShare=round(100 * division_area / province_area, 2),
        districtCount=len(members),
        tehsilCount=sum(row['tehsilCount'] for row in district_stats),
        districtStats=district_stats,
        headquartersCoordinates=headquarters_coordinates,
        headquartersSource=headquarters_source,
        headquartersSourceName=profile['sourceCity'],
        description=profile['description'],
        landmark=profile['landmark'],
        landmarkSource=profile['landmarkSource'],
        wikiUrl=profile['wikiUrl'],
        photo=photo,
        areaNote='WGS84 ellipsoidal polygon area, including source inland waters; calculated from the proposed district union.',
    )
    new_divisions.append(division)
if set(district_to_division) != set(district_by_name):
    raise ValueError('The requested division plan does not cover all Punjab districts')
punjab['division']['features'] = new_divisions
for district in districts:
    spec = district_to_division[district['properties']['name']]
    district['properties'].update(division=spec['name'], divisionCapital=spec['headquarters'])
for tehsil in tehsils:
    spec = district_to_division[tehsil['properties']['district']]
    tehsil['properties']['division'] = spec['name']
for row in payload['analysis']['changes']:
    if row.get('provinceId') == 'punjab':
        spec = district_to_division[row['proposedDistrict']]
        row.update(proposedDivision=spec['name'], divisionCapital=spec['headquarters'])

punjab_overview = payload['overview']['provinces'][next(
    i for i, province in enumerate(payload['overview']['provinces'])
    if province['id'] == 'punjab'
 )]
punjab_overview['detailCounts']['division'] = len(new_divisions)
punjab_overview['detailCounts']['district'] = len(districts)
punjab_overview['detailCounts']['tehsil'] = len(tehsils)

decisions = payload['analysis']['decisions']
for index, decision in enumerate(decisions):
    if 'Haripur and Havelian receive local administrative centres' in decision:
        decisions[index] = decision.replace(
            'Haripur and Havelian receive local administrative centres',
            'Haripur combines Ghazi, Haripur, Khanpur, Havelian and Lora source tehsils',
        )
        break
note = ('The proposed Punjab districts include full Attock as Panja Sahib, a Taxila tehsil split, '
        'Haripur with Havelian and Lora, Harappa from Sahiwal and Okara, and Sangrur with Malerkotla. '
        'Other requested district names are editorial labels; source names remain in the audit.')
if note not in decisions:
    decisions.append(note)
decisions[:] = [decision for decision in decisions if not decision.startswith((
    'All 180 Punjab source tehsils have proposed', 'Punjab tehsil labels use established source place names',
    'All 180 Punjab tehsil labels, meanings and short histories follow',
    'Names and short histories for 180 Punjab source tehsils follow',
    'Chiniot, Jhang and Toba Tek Singh remain in the Chenab',
    'The requested ten Punjab divisions group all 49 districts',
    'The requested eleven Punjab divisions group all 49 districts',
))]
decisions.append('The requested eleven Punjab divisions group all 49 districts exactly once. Boundaries are unions of member district outlines. Headquarters are Rawalpindi, Lahore, Sandalbar city (Faisalabad), Amritsar, Jalandhar, Mohali, Ludhiana, Patiala, Ranjitgarh (Gujranwala), Sargodha and Bathinda. City points use Natural Earth or linked Wikidata coordinates; areas use WGS84 ellipsoidal polygon measurement and counts use the mapped source tehsils.')
western_updates = sum(row.get('provenance') == 'User-provided Western Panjab rename list' for row in name_rows)
locality_updates = sum(row.get('provenance') == 'Project review of requested tehsil renames' for row in name_rows)
tehsil_note = (f'Names and short histories for 180 Punjab source tehsils follow the user-provided reviews, '
               f'including {western_updates} earlier Western Panjab entries and {locality_updates} later sourced locality and heritage updates. '
               'The omitted Guru Har Sahai tehsil is restored from uncovered Ferozepur district space. '
               'Lahore tehsil coverage gaps are joined to adjoining tehsils. These geometry repairs are approximate, not surveyed boundaries.')
if tehsil_note not in decisions:
    decisions.append(tehsil_note)

ids = [feature['properties']['id'] for feature in districts]
if len(ids) != len(set(ids)) or len(districts) != 49:
    raise ValueError(f'Unexpected Punjab district count: {len(districts)}')
available = {feature['properties']['name'] for feature in districts}
if any(feature['properties'].get('district') not in available for feature in tehsils):
    raise ValueError('A Punjab tehsil points to a missing district')

PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('Updated Punjab district geometry, names, tehsil assignments and audit: 49 districts.')
