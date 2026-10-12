"""Apply the reviewed Punjab district changes to the private atlas payload.

Run after private/united-atlas/finalize.py and before compact.py and packing.
The plain payload is ignored by Git; this tracked step keeps edits reproducible.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'work/geometry-runtime'))
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

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
}
district_notes = {
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

name_rows = json.loads((ROOT / 'scripts/punjab-tehsil-heritage-names.json').read_text(encoding='utf-8'))['rows']
if len(name_rows) != 180 or len({row['sourceId'] for row in name_rows}) != 180:
    raise ValueError('Heritage review must contain exactly 180 unique Punjab tehsils')
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
    if row['decision'] not in {'Retained', 'Renamed'}:
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
        namingStatus='renamed' if row['decision'] == 'Renamed' else 'source',
        namingProvenance='User-provided United Panjab heritage review',
    )
    props.pop('namingSourceUrl', None)

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

payload['overview']['provinces'][next(
    i for i, province in enumerate(payload['overview']['provinces'])
    if province['id'] == 'punjab'
)]['detailCounts']['district'] = len(districts)

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
    'All 180 Punjab source tehsils have proposed', 'Punjab tehsil labels use established source place names'
))]
tehsil_note = ('All 180 Punjab tehsil labels, meanings and short histories follow the user-provided heritage review. '
               'Nineteen proposed tehsil names differ from their source labels; source boundaries and identifiers remain unchanged.')
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
