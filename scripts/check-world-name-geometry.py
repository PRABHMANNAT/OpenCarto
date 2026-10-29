import hashlib,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
sources=json.loads((root/'app/world-sources.json').read_text(encoding='utf-8'))
for row in sources['nameCorrections']['geometryAudit']:
 geo=json.loads((root/('public/data/'+row['layer']+'.geojson')).read_text(encoding='utf-8'))
 digest=hashlib.sha256(json.dumps([(f['id'],f['geometry']) for f in geo['features']],separators=(',',':')).encode()).hexdigest()
 assert digest==row['geometrySha256'],row['layer']
print('Verified original world polygon coordinates and IDs are unchanged after label repair.')
