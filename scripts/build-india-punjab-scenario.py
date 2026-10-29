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
india='world-c-ind';punjab='world-a1-1811400B91946361694107';ladakh='world-a1-1811400B23769854471902';aksai='world-c-112';kashmir='world-a1-1811400B42025667129192'
balo_state='world-a1-70912109B90439427603182';sindh='world-a1-70912109B8393927546319';pak_punjab='world-a1-70912109B12169979015230'
balo='world-c-balochistan';multan='world-a1-alternate-multan';bahawalpur='world-a1-alternate-bahawalpur'
western=read('work/india-punjab/western-provinces-source.json');western_geo={f['properties']['id']:shape(f['geometry']) for f in western['features']}
gilgit='world-a1-70912109B54485417915534';azad='world-a1-70912109B7720427584286'
up=unary_union([shape(f['geometry']) for f in source['district']['features']]);assert up.is_valid
old_punjab=shape(all_features[punjab]['geometry']);ac=shape(all_features[aksai]['geometry'])
# Different source resolutions leave a small set of pre-existing Indian Punjab
# edge fragments. Retain their old ownership in the world context; the detailed
# 48-district atlas remains the exact approved geometry used by the PDF.
fringe=old_punjab.difference(up)
new_punjab=unary_union([up,old_punjab])
source_jk=shape(read('public/data/in-jammu-kashmir-region.geojson')['features'][0]['geometry'])
source_ladakh=shape(read('public/data/in-ladakh-region.geojson')['features'][0]['geometry'])
new_ladakh=unary_union([shape(all_features[ladakh]['geometry']),source_ladakh,ac,*[shape(all_features[i]['geometry']) for i in ['world-c-114','world-c-121']]])
new_kashmir=unary_union([shape(all_features[kashmir]['geometry']),source_jk,shape(all_features[gilgit]['geometry']),shape(all_features[azad]['geometry'])]).difference(unary_union([new_ladakh,new_punjab]))
prior_transfer=unary_union([new_punjab,new_ladakh,new_kashmir])
# Approved atlas provinces supply the internal split. Keep coarser world-source
# edge fragments where they do not conflict with those approved territories.
approved_india=unary_union([prior_transfer,western_geo['sindh'],western_geo['multan'],western_geo['bahawalpur']])
new_balo=unary_union([western_geo['balochistan'],shape(all_features[balo_state]['geometry']).difference(approved_india)])
new_sindh=unary_union([western_geo['sindh'],shape(all_features[sindh]['geometry']).difference(unary_union([prior_transfer,western_geo['balochistan'],western_geo['multan'],western_geo['bahawalpur']]))]).difference(new_balo)
new_multan=western_geo['multan'].difference(unary_union([prior_transfer,new_balo,new_sindh]))
new_bahawalpur=western_geo['bahawalpur'].difference(unary_union([prior_transfer,new_balo,new_sindh,new_multan]))
india_transfer=unary_union([prior_transfer,new_sindh,new_multan,new_bahawalpur,shape(all_features[pak_punjab]['geometry'])]).difference(new_balo)
transfer=unary_union([india_transfer,new_balo]);new_india=unary_union([shape(all_features[india]['geometry']),india_transfer]).difference(new_balo)
national_edge_context=india_transfer.difference(unary_union([prior_transfer,new_sindh,new_multan,new_bahawalpur]))

overrides=[];areas={};removed=[];repairs=[];journal=[]
for f in country+states:
    p=f['properties'];ident=str(f['id']);before=shape(f['geometry']);after=before
    if ident in [balo_state,pak_punjab]:removed.append(ident);journal.append({'id':ident,'name':p['name'],'operation':'Replaced by independent Balochistan' if ident==balo_state else 'Replaced by United Punjab, Multan and Bahawalpur; source-edge context retained with India'});continue
    if ident==india:after=new_india
    elif ident==punjab:after=new_punjab
    elif ident==ladakh:after=new_ladakh
    elif ident==kashmir:after=new_kashmir
    elif ident==sindh:after=new_sindh
    elif ident==aksai:removed.append(ident);journal.append({'id':ident,'name':p['name'],'operation':'Assigned to Ladakh, India'});continue
    elif before.intersection(transfer).area>1e-12:after=before.difference(transfer)
    changed=not before.equals(after)
    if not changed and ident!=sindh:continue
    if after.is_empty or after.area<1e-12:removed.append(ident);journal.append({'id':ident,'name':p['name'],'operation':'Transferred entire geometry'});continue
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
    if ident==kashmir:properties.update(name='Jammu & Kashmir',aliases=['Kashmir','Jammu and Kashmir','Gilgit-Baltistan','Azad Kashmir'])
    if ident==ladakh:properties.update(name='Ladakh',aliases=[p['name'],'Ladakh','Aksai Chin','Siachen-Saltoro','Demchok','Shaksgam Valley'])
    if ident==sindh:properties.update(parent=india,country='India',originalParent=p['parent'],capital='Karachi',aliases=['Sindh','Sind'])
    features={'type':'Feature','id':ident,'properties':properties,'bbox':list(after.bounds),'geometry':mapping(after)}
    overrides.append(features);areas[ident]=properties
    journal.append({'id':ident,'name':properties['name'],'operation':'Union / parent update' if ident in [india,punjab,ladakh,kashmir] else 'Subtract transferred territory'})
for ident,name,geometry,parent,source_id,capital in [(balo,'Balochistan',new_balo,'',balo_state,'Quetta'),(multan,'Multan',new_multan,india,'multan','Multan'),(bahawalpur,'Bahawalpur',new_bahawalpur,india,'bahawalpur','Bahawalpur')]:
    assert geometry.is_valid and not geometry.is_empty,ident
    main=max(geometry.geoms,key=lambda g:g.area) if geometry.geom_type=='MultiPolygon' else geometry
    point=main.representative_point();properties={'id':ident,'name':name,'region':'world','level':'region' if not parent else 'province','parent':parent,'country':'Balochistan' if not parent else 'India','center':[point.x,point.y],'bbox':list(geometry.bounds),'focusBounds':list(main.bounds),'capital':capital,'sourceCode':source_id,'sourceParentCode':'PAK','sourceLevel':'FICTIONAL-ADM0' if not parent else 'FICTIONAL-ADM1','source':'Approved fictional atlas province; WFP/OCHA 2022, with documented CGAZ world-context edges','aliases':[name]}
    overrides.append({'type':'Feature','id':ident,'properties':properties,'bbox':list(geometry.bounds),'geometry':mapping(geometry)});areas[ident]=properties;journal.append({'id':ident,'name':name,'operation':'Independent country' if not parent else 'Indian province'})
assert all(i in removed for i in [aksai,gilgit,azad,'world-c-114','world-c-121']),removed
write('server/alternate-world-overrides.geojson',{'type':'FeatureCollection','features':overrides})
write('work/india-punjab/reference-punjab-footprint.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'Exact canonical PDF Punjab'},'geometry':mapping(up)}]})
manifest={'revision':'alternate-world-western-provinces-2026-10-29','label':'Alternate world map','referencePdf':pdf_info,'districtCount':48,'divisionCount':12,'tehsilCount':193,'indiaId':india,'punjabId':punjab,'ladakhId':ladakh,'aksaiId':aksai,'kashmirId':kashmir,'balochistanId':balo,'sindhId':sindh,'multanId':multan,'bahawalpurId':bahawalpur,'addedIds':[balo,multan,bahawalpur],'replacedWesternIds':[balo_state,pak_punjab],'kashmirSourceIds':[gilgit,azad,'world-c-114','world-c-121'],'removedIds':removed,'areas':areas,'journal':journal,'repairs':repairs,'aksaiLabel':{'name':'Aksai Chin','center':all_features[aksai]['properties']['center']},'referenceEdgeResidual':{'angularAreaDegrees2':fringe.area,'fractionOfReferenceAngularArea':fringe.area/up.area,'method':'Retain existing Indian Punjab source-edge fragments in the world-context parent state; exact PDF district/division/tehsil geometries are unchanged.'},'credits':['geoBoundaries CGAZ · CC BY 4.0','Punjab: LGD/Bharatlas, Esri India, WFP/OCHA 2022 · source licenses retained in custom atlas'],'westernSourceEdges':{'countryOnlyIndiaAngularAreaDegrees2':national_edge_context.area,'method':'Original world Pakistani-Punjab source-edge differences belong to India as country context; no invented province polygon is assigned to unmatched edges.'},'notes':'Balochistan is an independent country. Sindh, Multan and Bahawalpur are Indian provinces, using the approved atlas split. Fictional complete-world edition. United Punjab and the combined Kashmir extent are assigned to India; Aksai Chin, Siachen-Saltoro and Demchok are included in Ladakh. Gilgit-Baltistan and Azad Kashmir are merged into the Jammu & Kashmir world state, using the existing combined claimed-extent GIS. Amb remains outside Punjab. Source-world and detailed Punjab data are unchanged.','inputs':[{'file':p,'sha256':digest(p)} for p in ['public/data/world-region.geojson','public/data/world-province.geojson','public/data/in-jammu-kashmir-region.geojson','public/data/in-ladakh-region.geojson','work/india-punjab/punjab-source.json','work/india-punjab/western-provinces-source.json']],'outputSha256':digest('server/alternate-world-overrides.geojson'),'districtNames':sorted(f['properties']['name'] for f in source['district']['features'])}
write('app/india-punjab-scenario.json',manifest)
print('Built',len(overrides),'world replacements;',len(removed),'retired context outline; exact PDF names verified:',pdf_info.get('matchedDistrictNames'))
print('Preserved source-edge residual:',fringe.area,'square degrees; fraction',fringe.area/up.area)
