# World countries and first-level divisions

Use **World map** in the editor header or the custom atlas toolbar. The same editor now renders a world view with a country selector, countries-only / countries-plus-first-level-divisions selector, and a subdivision zoom picker. Existing color tools, inherited country colors, uploaded palettes, naming, visibility, undo, search, autosave, saved maps and PNG/JPG/SVG exports apply to these areas. Geometry is downloaded only when the world view is used. The original regional map and fictional Punjab data are retained.

The new `world` scope is opt-in. It shows only `world-region` (country/context outlines) and `world-province` (ADM1). There are **218 country/context outlines**: 198 ADM0 records and 20 source-designated disputed areas. There are **3,202 ADM1 records**. The 20 disputed outlines and two country-only fallback records repeated in the source ADM1 file are deliberately excluded from the subdivision layer. No ADM2 or lower layer is imported. Zero-subdivision countries retain their outline, with an explicit coverage message. These counts describe this source snapshot, not a count of recognized sovereign countries or a current legal register.

Source: [geoBoundaries CGAZ global downloads](https://www.geoboundaries.org/globalDownloads.html), retrieved 29 October 2026. Attribution: Runfola et al. (2020), *geoBoundaries: A global database of political administrative boundaries*, PLOS ONE 15(4): e0231866, [DOI](https://doi.org/10.1371/journal.pone.0231866), CC BY 4.0. CGAZ's disputed-area treatment follows US Department of State definitions. It is a separate real-world source view, not a revision of the fictional United Subcontinent.

Natural Earth's ADM1 data was evaluated but not used: for some countries its source units include departments, counties or districts. CGAZ provides the required hierarchy, for example England, Scotland, Wales and Northern Ireland rather than UK councils. The US source includes 50 states, DC and five territories. Names and identifiers are retained from CGAZ; source editions differ between countries.

Files: `app/world-areas.json` is the registry, `app/world-sources.json` records input ZIP hashes, output hashes, coverage and provenance, and `public/data/world-{region,province}{,-labels}.geojson` contains the two layers and their labels. IDs use `world-c-{shapeGroup}` for countries/context areas and `world-a1-{shapeID}` for ADM1. Parent links use the source `shapeGroup`. These namespaced IDs do not replace existing administrative IDs. Search includes world units and limits results to them while the world view is active.

Source geometry is WGS84. Display geometry uses a 0.005-degree topology-preserving simplification per feature and six-decimal coordinate precision, falling back to full precision if rounding would invalidate a feature. Multipart polygons and holes are retained. One invalid source feature (Turkmenistan) required `make_valid`; the manifest records it. Independent simplification is for cartographic display, not a survey or topologically certified global GIS partition. Labels use interior points in the largest polygon component. Country focus uses the largest component to avoid zooming out to include distant dependencies; whole-world fit retains all geometry within Web Mercator's display limits. SVG projection clamps latitude at the Mercator limit to prevent infinite coordinates at the South Pole.

To rebuild, download the two official ZIP URLs from `app/world-sources.json` to ignored `work/world-source/cgaz-adm{0,1}.zip`, extract each into `work/world-source/cgaz-adm{0,1}/`, install `shapely` and `pyshp` into `work/world-python`, then run:

```sh
python scripts/build-world-map.py
node scripts/check-world-map.mjs
node scripts/check-map-scopes.mjs
npm run build:vercel
node scripts/verify-world-map.mjs
```

The importer reads the CGAZ shapefile DBF text as Latin-1 (these ZIPs do not supply a UTF-8 CPG). Source ZIP checksums pin the downloaded inputs. Browser checks use `MAP_TEST_URL` (default `http://127.0.0.1:4546/`) and verify both layers, UK hierarchy, countries-only mode, painting, search, finite attributed SVG export, save/reload and mobile controls. Generated screenshots and exports go to ignored `outputs/world-map/`.
