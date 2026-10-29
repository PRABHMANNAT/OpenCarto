"""Build an explicitly hypothetical world-boundary variant, preserving source files."""
import hashlib
import json
import pathlib
import sys
sys.path.insert(0,str(pathlib.Path('work/world-python').resolve()))
from shapely.geometry import shape,mapping,MultiPolygon
from shapely.ops import unary_union
from shapely import make_valid

ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
def write(path,value):(ROOT/path).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def digest(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
source=read('work/india-punjab/punjab-source.json')
assert [len(source[k]['features']) for k in ['district','division','tehsil']]==[48,12,193]
pdf_info={'name':'united-punjab-detailed-atlas.pdf','sha256':'b0af3f154bea9bdf9bcbc4ce6b343841c60750386a536d6342fececa41a21d64'}
# Reuse the checked reference metadata only for the same canonical district list.
previous_path=ROOT/'app/india-punjab-scenario.json'
if previous_path.exists():
    previous=read('app/india-punjab-scenario.json')
    if previous.get('districtNames')==sorted(f['properties']['name'] for f in source['district']['features']):pdf_info=previous['referencePdf']
if len(sys.argv)>1:
    sys.path.insert(0,str(ROOT/'work/pdf-reader-126'))
    from pypdf import PdfReader
    pdf=pathlib.Path(sys.argv[1]);reader=PdfReader(pdf)
    assert len(reader.pages)==15
    normalize=lambda s:''.join(s.lower().split())
    text=normalize(reader.pages[1].extract_text())
    assert all(normalize(f['properties']['name']) in text for f in source['district']['features'])
    pdf_info={'name':pdf.name,'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'pages':15,'matchedDistrictNames':48}

country=read('public/data/world-region.geojson')['features'];states=read('public/data/world-province.geojson')['features']
all_features={str(f['id']):f for f in country+states}
india='world-c-ind';punjab='world-a1-1811400B91946361694107';ladakh='world-a1-1811400B23769854471902';aksai='world-c-112'
up=unary_union([shape(f['geometry']) for f in source['district']['features']]);assert up.is_valid
old_punjab=shape(all_features[punjab]['geometry']);ac=shape(all_features[aksai]['geometry'])
# Different source resolutions leave a small set of pre-existing Indian Punjab
# edge fragments. Retain their old ownership in the world context; the detailed
# 48-district atlas remains the exact approved geometry used by the PDF.
fringe=old_punjab.difference(up)
new_punjab=unary_union([up,old_punjab]);new_ladakh=unary_union([shape(all_features[ladakh]['geometry']),ac])
transfer=unary_union([new_punjab,ac]);new_india=unary_union([shape(all_features[india]['geometry']),new_punjab,ac])
overrides=[];areas={};removed=[];repairs=[];journal=[]
for f in country+states:
    p=f['properties'];ident=str(f['id']);before=shape(f['geometry']);after=before
    if ident==india:after=new_india
    elif ident==punjab:after=new_punjab
    elif ident==ladakh:after=new_ladakh
    elif ident==aksai:removed.append(ident);journal.append({'id':ident,'name':p['name'],'operation':'Assigned to Ladakh, India'});continue
    elif before.intersection(transfer).area>1e-12:after=before.difference(transfer)
    changed=not before.equals(after)
    if not changed:continue
    if after.is_empty:removed.append(ident);journal.append({'id':ident,'name':p['name'],'operation':'Transferred entire geometry'});continue
    if not after.is_valid:
        after=make_valid(after);repairs.append(ident)
    if after.geom_type=='GeometryCollection':
        parts=[g for g in after.geoms if g.geom_type=='Polygon']
        for g in after.geoms:
            if g.geom_type=='MultiPolygon':parts.extend(g.geoms)
        after=MultiPolygon(parts)
    assert after.is_valid and after.geom_type in ('Polygon','MultiPolygon'),ident
    main=max(after.geoms,key=lambda g:g.area) if after.geom_type=='MultiPolygon' else after
    point=main.representative_point()
    properties={**p,'bbox':list(after.bounds),'focusBounds':list(main.bounds),'center':[point.x,point.y],'sourceName':p['name'],'source':p['source']+'; hypothetical India + United Punjab scenario'}
    if ident==punjab:properties.update(name='United Punjab',aliases=['Punjab','United Punjab','Hypothetical Punjab'])
    if ident==ladakh:properties.update(name='Ladakh',aliases=[p['name'],'Ladakh','Aksai Chin'])
    features={'type':'Feature','id':ident,'properties':properties,'bbox':list(after.bounds),'geometry':mapping(after)}
    overrides.append(features);areas[ident]=properties
    journal.append({'id':ident,'name':properties['name'],'operation':'Union / parent update' if ident in [india,punjab,ladakh] else 'Subtract transferred territory'})
assert removed==[aksai],removed
write('public/data/india-punjab-world-overrides.geojson',{'type':'FeatureCollection','features':overrides})
write('work/india-punjab/reference-punjab-footprint.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'Exact canonical PDF Punjab'},'geometry':mapping(up)}]})
manifest={'revision':'india-united-punjab-aksai-2026-10-29','label':'Hypothetical India — United Punjab and Ladakh','referencePdf':pdf_info,'districtCount':48,'divisionCount':12,'tehsilCount':193,'indiaId':india,'punjabId':punjab,'ladakhId':ladakh,'aksaiId':aksai,'removedIds':removed,'areas':areas,'journal':journal,'repairs':repairs,'aksaiLabel':{'name':'Aksai Chin','center':all_features[aksai]['properties']['center']},'referenceEdgeResidual':{'angularAreaDegrees2':fringe.area,'fractionOfReferenceAngularArea':fringe.area/up.area,'method':'Retain existing Indian Punjab source-edge fragments in the world-context parent state; exact PDF district/division/tehsil geometries are unchanged.'},'credits':['geoBoundaries CGAZ · CC BY 4.0','Punjab: LGD/Bharatlas, Esri India, WFP/OCHA 2022 · source licenses retained in custom atlas'],'notes':'Fictional India configuration. United Punjab is included as an Indian state and Aksai Chin is assigned to Ladakh. Amb is not absorbed into Punjab. No additional disputed territories are reassigned. Original world source files and canonical detailed Punjab remain unchanged.','inputs':[{'file':p,'sha256':digest(p)} for p in ['public/data/world-region.geojson','public/data/world-province.geojson','work/india-punjab/punjab-source.json']],'outputSha256':digest('public/data/india-punjab-world-overrides.geojson'),'districtNames':sorted(f['properties']['name'] for f in source['district']['features'])}
write('app/india-punjab-scenario.json',manifest)
print('Built',len(overrides),'world replacements;',len(removed),'retired context outline; exact PDF names verified:',pdf_info.get('matchedDistrictNames'))
print('Preserved source-edge residual:',fringe.area,'square degrees; fraction',fringe.area/up.area)
