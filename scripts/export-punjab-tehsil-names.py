"""Export the reviewed old/district/new tehsil names as a readable text table."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
registry = json.loads((ROOT / 'scripts/punjab-tehsil-heritage-names.json').read_text(encoding='utf-8'))
rows = registry['rows']
columns = ('Old or official tehsil name', 'Proposed district', 'Map tehsil name')
values = [(row['oldName'], row['proposedDistrict'], row['newName']) for row in rows]
widths = [max(len(header), *(len(value[index]) for value in values)) for index, header in enumerate(columns)]


def line(parts):
    return ' | '.join(part.ljust(width) for part, width in zip(parts, widths))


latest = sum(row.get('provenance') == 'Project review of requested tehsil renames' for row in rows)
contents = [
    'Punjab tehsil names — United Subcontinent alternative map',
    'Total: 181 tehsils (180 reviewed source tehsils; Guru Har Sahai restored from missing Ferozepur coverage).',
    f'{latest} later locality and heritage choices are documented with source links in the atlas.',
    'The Guru Har Sahai outline is approximate.',
    '',
    line(columns),
    '-+-'.join('-' * width for width in widths),
    *(line(value) for value in values),
    '',
]
output = ROOT / 'outputs/private-atlas/punjab-tehsil-old-district-new-names.txt'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text('\n'.join(contents), encoding='utf-8')
print(output)
