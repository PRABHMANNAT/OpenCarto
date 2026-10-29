import pathlib,json,sys
sys.path.insert(0,'work/world-python')
from shapely.geometry import shape
from shapely.strtree import STRtree
p=pathlib.Path('public/data/world-region.geojson');rows=json.loads(p.read_text(encoding='utf-8'))['features'];geoms=[shape(f['geometry']).simplify(.02,preserve_topology=True) for f in rows];tree=STRtree(geoms);neighbors={f['id']:set() for f in rows}
for i,g in enumerate(geoms):
 for raw in tree.query(g.buffer(.12)):
  j=int(raw)
  if i!=j and g.distance(geoms[j])<.12:neighbors[rows[i]['id']].add(rows[j]['id'])
neighbors['world-c-ind'].add('world-c-afg');neighbors['world-c-afg'].add('world-c-ind')
pathlib.Path('app/world-country-neighbors.json').write_text(json.dumps({k:sorted(v) for k,v in neighbors.items()},separators=(',',':')),encoding='utf-8')
print('Prepared coherent-palette neighbor constraints for',len(neighbors),'country/context records.')
