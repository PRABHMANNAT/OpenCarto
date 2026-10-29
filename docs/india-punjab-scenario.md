# Hypothetical India with United Punjab

This optional world-map edition includes the approved United Punjab footprint in India and assigns the existing Aksai Chin source polygon to Ladakh. It is explicitly fictional. No claim of present sovereignty or control is implied.

Open **India + Punjab** in the editor header, or choose **World map > Boundary edition > Hypothetical India + United Punjab**. The custom atlas also has an **India + United Punjab** button. Focus shortcuts cover Punjab and Ladakh; Punjab district, division and tehsil buttons open the existing canonical detailed atlas. The detailed atlas retains its PDF download control. World exports retain the active boundary edition and include its provenance in SVG metadata.

## Reference and canonical detail

The supplied `united-punjab-detailed-atlas.pdf` (15 pages; SHA-256 `b0af3f154bea9bdf9bcbc4ce6b343841c60750386a536d6342fececa41a21d64`) was checked visually and by extracted district labels. All 48 district names match the canonical registry. GIS is reused from that registry, rather than traced from the PDF.

- 48 districts, 12 divisions and 193 mapped tehsils remain unchanged.
- All detailed names, IDs, boundaries, populations and parent relationships remain unchanged.
- Amb remains separate and is not added to Punjab or automatically to India.
- No other disputed context territory is reassigned.

## Geometry

Original WGS84 world country and ADM1 GeoJSON files remain untouched. `public/data/india-punjab-world-overrides.geojson` stores 17 replacements keyed to the original world IDs. `app/india-punjab-scenario.json` stores aliases, bounds, source hashes, PDF provenance, transformation journal and checksums. The edition flag is validated, saved, restored and included in navigation history.

1. Dissolve the exact 48 canonical district polygons.
2. Preserve the pre-existing world Indian Punjab edge fragments outside that footprint. These total 0.0088207954 square degrees, approximately 0.0608% of the canonical footprint's angular area. This is a source-resolution residual, not an estimate of geodesic land area. The detailed Punjab atlas remains exact and unchanged.
3. Union that Punjab footprint and the existing Aksai Chin context polygon into the original India country polygon.
4. Union Aksai Chin into the original Ladakh ADM1 polygon, retire its separately selectable country-context outline in this edition, and retain it as a named geographic label and search alias for Ladakh.
5. Subtract only the transfer mask from intersecting other world country/state polygons. Existing differences between country and state source resolutions outside that mask remain unchanged. Do not union unrelated Ladakh source-edge fragments into India.

All generated polygons are valid without repair. Multipolygons, holes, islands, Islamabad's enclave and the complete Hazarawala northern valley extent are retained. There are no new country overlaps or land gaps. Existing canonical tehsil rounding slivers against district edges are retained: the largest outside sliver is Taxila, 4.34758e-7 square degrees (0.00151% of that tehsil's angular area). The geometry check uses a documented 1e-6 square-degree tolerance for these inherited detail edges.

The same override geometry supplies Equal Earth paths, hit testing, labels, selection and SVG/raster exports. Optional MapLibre imagery views use the same geographic replacements. The default source-world edition, colors and custom names continue to work.

## Reproduce and verify

Use the configured `.env.local` and atlas key; do not copy secrets into generated files. Python needs Shapely available under `work/world-python` (or installed normally). Optional PDF verification uses pypdf under `work/pdf-reader-126` or the normal Python environment.

```powershell
npm run data:india-punjab
# Optionally validate the source PDF while rebuilding:
python scripts/build-india-punjab-scenario.py '<path-to-supplied-pdf>'
npm run check:india-punjab
npx tsc --noEmit
npm run build:vercel
npm run preview:vercel -- --host 127.0.0.1 --port 4546 --strictPort
npm run check:india-punjab-browser
```

The geometry check verifies source hashes, exact unions, complete Aksai inclusion, parent IDs, valid polygons, land conservation, mask-limited changes and no new overlaps. Model checks cover aliases, source restoration, save/load and navigation. Browser checks cover rendered paths, existing colors, the three detailed atlas views, API counts, Amb independence, SVG metadata/download, reload, source restoration and mobile layout. Screenshots are written to ignored `outputs/india-punjab/`.

Credits: world context geoBoundaries CGAZ, Runfola et al. (2020), CC BY 4.0; detailed Punjab LGD/Bharatlas, Esri India, WFP/OCHA 2022, with existing source licenses and attribution retained in the custom atlas.
