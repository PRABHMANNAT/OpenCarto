"""Build the opt-in ADM0/ADM1 world view. See docs/world-map.md for source setup."""
import collections
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'work/world-python'))
import shapefile
from shapely.geometry import shape, mapping, MultiPolygon
from shapely import make_valid

SOURCE = ROOT / 'work/world-source'
OUTPUT = ROOT / 'public/data'
TOLERANCE = 0.005  # Angular degrees; display-only, with topology preserved per feature.
catalog = []
layers = {}
repairs = []
parents = {}
counts = collections.Counter()
name_corrections = json.loads((ROOT/'app/world-name-corrections.json').read_text(encoding='utf-8'))['records']

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def polygonal(geom):
    if geom.geom_type in ('Polygon', 'MultiPolygon'):
        return geom
    parts = [part for part in geom.geoms if part.geom_type == 'Polygon']
    for part in geom.geoms:
        if part.geom_type == 'MultiPolygon':
            parts.extend(part.geoms)
    return MultiPolygon(parts)

def display_geometry(geometry):
    original = mapping(geometry)
    def rounded(values):
        return [rounded(v) if isinstance(v, (list, tuple)) else round(v, 6) for v in values]
    result = dict(type=original['type'], coordinates=rounded(original['coordinates']))
    # Never trade validity for a smaller download.
    return result if shape(result).is_valid else original

for level, kind in [(0, 'region'), (1, 'province')]:
    path = next((SOURCE / f'cgaz-adm{level}').rglob('*.shp'))
    reader = shapefile.Reader(str(path), encoding='latin1')
    features = []
    seen = set()
    for row in reader.iterShapeRecords():
        props = row.record.as_dict()
        # CGAZ repeats country-only and disputed outlines in its ADM1 file.
        # Those are context, not first-level subdivisions.
        if level == 1 and props['shapeType'] != 'ADM1':
            continue
        assert props['shapeType'] in ('ADM0', 'DISP') if level == 0 else props['shapeType'] == 'ADM1'
        code = props['shapeGroup']
        source_id = code if level == 0 else props['shapeID']
        ident = f'world-c-{code.lower()}' if level == 0 else f'world-a1-{source_id}'
        assert ident not in seen, f'Duplicate source ID {ident}'
        seen.add(ident)
        geometry = shape(row.shape.__geo_interface__)
        if not geometry.is_valid:
            repairs.append(ident)
            geometry = polygonal(make_valid(geometry))
        geometry = geometry.simplify(TOLERANCE, preserve_topology=True)
        if not geometry.is_valid:
            if ident not in repairs:
                repairs.append(ident)
            geometry = polygonal(make_valid(geometry))
        assert not geometry.is_empty and geometry.is_valid, ident
        main = max(geometry.geoms, key=lambda g: g.area) if geometry.geom_type == 'MultiPolygon' else geometry
        point = main.representative_point()
        extent = [round(x, 7) for x in geometry.bounds]
        name = str(props.get('shapeName') or f'Unnamed ADM1 ({source_id})')
        source_name=name
        if ident in name_corrections:name=name_corrections[ident]['name']
        if level == 0:
            parents[code] = name
        else:
            assert code in parents, f'Unlinked ADM1 {ident}: {code}'
            counts[code] += 1
        properties = dict(id=ident, name=name, region='world', level=kind,
                          parent='' if level == 0 else f'world-c-{code.lower()}',
                          center=[round(point.x, 7), round(point.y, 7)], bbox=extent, focusBounds=[round(x, 7) for x in main.bounds],
                          country=name if level == 0 else parents[code], sourceCode=source_id,
                          sourceParentCode=code, sourceLevel=props['shapeType'],
                          source='geoBoundaries CGAZ · ADM0 / ADM1 · CC BY 4.0')
        if name!=source_name:properties['originalName']=source_name
        catalog.append(properties)
        features.append(dict(type='Feature', id=ident, properties=properties, bbox=extent, geometry=display_geometry(geometry)))
    features.sort(key=lambda f: f['id'])
    key = f'world-{kind}'
    write(OUTPUT / f'{key}.geojson', dict(type='FeatureCollection', features=features))
    labels = [dict(type='Feature', id=f['id'], properties=f['properties'],
                   geometry=dict(type='Point', coordinates=f['properties']['center'])) for f in features]
    write(OUTPUT / f'{key}-labels.geojson', dict(type='FeatureCollection', features=labels))
    layers[key] = dict(count=len(features), sha256=hashlib.sha256((OUTPUT / f'{key}.geojson').read_bytes()).hexdigest())
    print(key, len(features), (OUTPUT / f'{key}.geojson').stat().st_size, flush=True)

catalog.sort(key=lambda area: (area['level'] != 'region', area['id']))
write(ROOT / 'app/world-areas.json', catalog)
write(ROOT / 'app/world-sources.json', dict(
    title='geoBoundaries Comprehensive Global Administrative Zones',
    url='https://www.geoboundaries.org/globalDownloads.html',
    license='CC BY 4.0', licenseUrl='https://www.geoboundaries.org/index.html#usage',
    attribution='Runfola et al. (2020), geoBoundaries: A global database of political administrative boundaries. PLOS ONE 15(4): e0231866. https://doi.org/10.1371/journal.pone.0231866',
    retrieved='2026-10-29', crs='EPSG:4326', layers=layers,
    simplificationDegrees=TOLERANCE, repairedFeatures=repairs,
    countries=[dict(id=f'world-c-{code.lower()}', name=name, code=code, divisions=counts[code]) for code, name in sorted(parents.items(), key=lambda entry: entry[1])],
    inputs=[dict(url=f'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM{level}.zip', sha256=hashlib.sha256((SOURCE / f'cgaz-adm{level}.zip').read_bytes()).hexdigest()) for level in [0, 1]],
    notes='Global source snapshot, not a current legal register. CGAZ follows US Department of State definitions for disputed areas. Display geometry is simplified; no ADM2 or lower units are imported. Countries without supplied ADM1 geometry retain their country outline only.'
))
print('Validated', len(catalog), 'unique areas;', len(repairs), 'source geometries repaired.')

# Keep the label audit and file checksums in sync after rebuilding from source.
import runpy
runpy.run_path(str(ROOT/'scripts/repair-world-names.py'), run_name='__main__')
