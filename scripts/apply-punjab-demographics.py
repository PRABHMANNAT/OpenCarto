"""Materialize the deterministic scenario into the existing canonical atlas."""
import csv
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
base = ROOT / 'private/united-atlas'
path = base / 'atlas.json'
data = json.loads(path.read_text(encoding='utf-8'))
result = json.loads((ROOT / 'work/punjab-demographic-result.json').read_text(encoding='utf-8'))
config = json.loads((ROOT / 'app/punjab-demographic-scenario.json').read_text(encoding='utf-8'))
levels = data['details']['punjab']
def apply(p, row):
    if p.get('hypotheticalDemographics', {}).get('version') != config['version'] and p.get('hypotheticalPopulation'):
        p.setdefault('populationScenarioHistory', []).append({'label': 'Superseded population scenario',
            'population': p['hypotheticalPopulation'], 'demographics': p.get('hypotheticalDemographics'), 'basis': p.get('populationBasis')})
    for key in ('hypotheticalDemographics', 'hypotheticalPopulation', 'density'):
        p[key] = row[key]
    p['statisticsNote'] = config['note']
    p.pop('populationBasis', None)
    if row.get('historicalRegionId') == 'punjab-region-pothohar': p['historicalRegion'] = 'Pothohar–Gandhara'
    if row['level'] == 'tehsil':
        p.update(areaKm2=row['areaKm2'], areaNote='WGS84 geodesic measurement of the unchanged mapped tehsil polygon.', settlementAssumptions=row['settlementAssumptions'])
    if row['level'] == 'region' and p['id'] == 'punjab-region-pothohar':
        p['name'] = 'Pothohar–Gandhara'
        p['aliases'] = ['Pothohar', 'Pothohar-Gandhara', 'Pothohar Gandhara']
        p['description'] = p['description'].replace('Pothohar groups', 'Pothohar–Gandhara groups')

for level, key in [('district','districts'),('tehsil','tehsils'),('division','divisions'),('region','regions')]:
    by_id = {r['id']: r for r in result[key]}
    assert len(by_id) == len(levels[level]['features'])
    for feature in levels[level]['features']: apply(feature['properties'], by_id[feature['properties']['id']])
    ordered = sorted(levels[level]['features'], key=lambda f: (-f['properties']['hypotheticalDemographics']['total'], f['properties']['id']))
    for rank, feature in enumerate(ordered, 1):
        feature['properties'].update(populationRank=rank, populationRankCount=len(ordered))
province = next(p for p in data['overview']['provinces'] if p['id'] == 'punjab')
apply(province, result['province'])
apply(levels['province']['features'][0]['properties'], result['province'])
province['statisticsNote'] = config['note']
province['detailNote'] = '48 districts, 193 mapped tehsils, 12 divisions and 6 historical regions; revised fictional 2026 demographics. Amb is administered separately and excluded.'
by_district = {f['properties']['id']: f['properties'] for f in levels['district']['features']}
for level in ('division','region'):
    for feature in levels[level]['features']:
        p = feature['properties']
        members = [d for d in by_district.values() if (d['division'] == p['name'] if level == 'division' else d['id'] in p['memberDistrictIds'])]
        p['districtStats'] = [{key:d.get(key) for key in ('id','name','capital','areaKm2','tehsilCount','hypotheticalPopulation','hypotheticalDemographics','density','historicalRegion')} for d in members]
        if level == 'region':
            order = {identifier:i for i,identifier in enumerate(p['memberDistrictIds'])}
            p['districtStats'].sort(key=lambda d: order[d['id']])
for item in data['administrativeSearch']:
    if item['province'] != 'punjab': continue
    if item.get('historicalRegionId') == 'punjab-region-pothohar': item['historicalRegion'] = 'Pothohar–Gandhara'
    if item['id'] == 'punjab-region-pothohar':
        item['name'] = 'Pothohar–Gandhara Historical Region'
        item['aliases'] = ['Pothohar','Pothohar region','Pothohar Historical Region','Pothohar–Gandhara','Pothohar-Gandhara','Pothohar Gandhara']
for row in data['analysis']['changes']:
    if row.get('proposedHistoricalRegion') == 'Pothohar': row['proposedHistoricalRegion'] = 'Pothohar–Gandhara'
for row in data['historicalRegions']['regions']:
    if row['id'] == 'punjab-region-pothohar': row['name'] = 'Pothohar–Gandhara'
data['divisionFinalization'].update(populationTotal=config['total'], populationMethod=config['religionMethod'])
data['analysis']['audit']['divisionFinalization'] = data['divisionFinalization']
data['analysis']['decisions'] = [
    ('Superseded population scenario: ' + row if ('7 crore' in row or '7.96 crore' in row) and not row.startswith('Superseded') else row)
    for row in data['analysis']['decisions']]
decision = 'Current fictional 2026 scenario: 67,536,450 residents, exactly 14,858,019 Hindus (22%), six locked religious totals, 40% urbanization, and tehsil-based demographic aggregation. Amb excluded. Pothohar–Gandhara retains the existing Pothohar region ID and membership.'
if decision not in data['analysis']['decisions']: data['analysis']['decisions'].append(decision)
rows = []
for level in ('district','tehsil','division','region'):
    for f in levels[level]['features']:
        p = f['properties']
        row = {key:p.get(key) for key in ('id','name','capital','parentDistrictId','district','division','historicalRegion','historicalRegionId','areaKm2','bbox','center','sourceId','populationRank','districtCount','tehsilCount')}
        row.update(level=level, hypotheticalDemographics=p['hypotheticalDemographics'])
        rows.append(row)
data['demographics'] = {'version':config['version'], 'title':config['title'], 'year':2026,
    'province': {'id':'punjab','name':'Punjab','level':'province','areaKm2':province['areaKm2'],'bbox':province['bbox'],'hypotheticalDemographics':province['hypotheticalDemographics']},
    'rows':rows, 'cities':result['cities'], 'model':result['model'],
    'counts':{'district':48,'tehsil':193,'division':12,'region':6}, 'note':config['note']}
data['analysis']['audit']['currentDemographicScenario'] = {'version':config['version'], 'year':2026, 'total':config['total'], 'urbanPopulation':config['urbanPopulation'], 'religions':config['religions'], 'method':config['religionMethod'], 'ambExcluded':True}

out = ROOT / 'reports/punjab-demographics-2026'
out.mkdir(parents=True, exist_ok=True)
for level in ('district','tehsil','division','region','city'):
    records = result['cities'] if level == 'city' else [row for row in rows if row['level'] == level]
    columns = ['id','name','district','division','historicalRegion','total','urbanPopulation','ruralPopulation','urbanPercent','density']
    for religion in config['religions']: columns.extend([religion['key']+'Count',religion['key']+'Percent'])
    with (out / (level+'.csv')).open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for record in sorted(records, key=lambda r:(-r['hypotheticalDemographics']['total'],r['id'])):
            stats = record['hypotheticalDemographics']
            row = {key:record.get(key,'') for key in columns[:5]}
            row.update({key:stats.get(key,'') for key in columns[5:10]})
            for religion in stats['religions']:
                row[religion['key']+'Count'] = religion['population']
                row[religion['key']+'Percent'] = round(religion['percentage'], 7)
            writer.writerow(row)
for name, value in [('province.json',province['hypotheticalDemographics']),('model-assumptions.json',result['model'])]:
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
for target, value in [(path,data),(base/'profiles.json',data['overview']['provinces'])]:
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    temporary.replace(target)
print(json.dumps({'version':config['version'],'total':province['hypotheticalDemographics']['total'],'urbanPercent':province['hypotheticalDemographics']['urbanPercent'],'counts':data['demographics']['counts'],'tables':str(out)}), flush=True)
