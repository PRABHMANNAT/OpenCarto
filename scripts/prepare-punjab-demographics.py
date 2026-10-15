"""Export canonical identifiers, source metadata and measured tehsil areas."""
import json
import shutil
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ('work/geometry-runtime-win' if sys.platform == 'win32' else 'work/geometry-runtime')))
from geographiclib.geodesic import Geodesic
from shapely.geometry import shape
base = ROOT / 'private/united-atlas'
path = base / 'atlas.json'
backup = base / 'before-demographics-2026.json'
if not backup.exists(): shutil.copy2(path, backup)
data = json.loads(path.read_text(encoding='utf-8'))
levels = data['details']['punjab']
def area(geometry):
    total = 0
    for polygon in ([geometry] if geometry.geom_type == 'Polygon' else geometry.geoms):
        for i, ring in enumerate([polygon.exterior, *polygon.interiors]):
            p = Geodesic.WGS84.Polygon()
            for lon, lat in ring.coords: p.AddPoint(lat, lon)
            total += (1 if i == 0 else -1) * abs(p.Compute()[2]) / 1e6
    return round(total, 4)
districts = [f['properties'] for f in levels['district']['features']]
tehsils = [{**f['properties'], 'areaKm2': area(shape(f['geometry']))} for f in levels['tehsil']['features']]
assert len(districts) == 48 and len(tehsils) == 193
result = {'districts': districts, 'tehsils': tehsils,
    'divisions': [f['properties'] for f in levels['division']['features']],
    'regions': [f['properties'] for f in levels['region']['features']],
    'province': next(p for p in data['overview']['provinces'] if p['id'] == 'punjab'),
    'places': [f for f in data['overview']['places']['features'] if f['properties'].get('province') == 'punjab']}
(ROOT / 'work/punjab-demographic-input.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
print('Prepared the existing 48 districts and 193 measured tehsil areas; pre-scenario atlas preserved.', flush=True)
