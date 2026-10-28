# World countries and first-level divisions

Use **World map** in the editor header or the custom atlas toolbar. The same editor now renders a world view with a country selector, countries-only / countries-plus-first-level-divisions selector, and a subdivision zoom picker. Existing color tools, inherited country colors, uploaded palettes, naming, visibility, undo, search, autosave, saved maps and PNG/JPG/SVG exports apply to these areas. Geometry is downloaded only when the world view is used. The original regional map and fictional Punjab data are retained.

The new `world` scope is opt-in. It shows only `world-region` (country/context outlines) and `world-province` (ADM1). There are **218 country/context outlines**: 198 ADM0 records and 20 source-designated disputed areas. There are **3,202 ADM1 records**. The 20 disputed outlines and two country-only fallback records repeated in the source ADM1 file are deliberately excluded from the subdivision layer. No ADM2 or lower layer is imported. Zero-subdivision countries retain their outline, with an explicit coverage message. These counts describe this source snapshot, not a count of recognized sovereign countries or a current legal register.

Source: [geoBoundaries CGAZ global downloads](https://www.geoboundaries.org/globalDownloads.html), retrieved 29 October 2026. Attribution: Runfola et al. (2020), *geoBoundaries: A global database of political administrative boundaries*, PLOS ONE 15(4): e0231866, [DOI](https://doi.org/10.1371/journal.pone.0231866), CC BY 4.0. CGAZ's disputed-area treatment follows US Department of State definitions. It is a separate real-world source view, not a revision of the fictional United Subcontinent.

Natural Earth's ADM1 data was evaluated but not used: for some countries its source units include departments, counties or districts. CGAZ provides the required hierarchy, for example England, Scotland, Wales and Northern Ireland rather than UK councils. The US source includes 50 states, DC and five territories. Names and identifiers are retained from CGAZ; source editions differ between countries.

Files: `app/world-areas.json` is the registry, `app/world-sources.json` records input ZIP hashes, output hashes, coverage and provenance, and `public/data/world-{region,province}{,-labels}.geojson` contains the two layers and their labels. IDs use `world-c-{shapeGroup}` for countries/context areas and `world-a1-{shapeID}` for ADM1. Parent links use the source `shapeGroup`. These namespaced IDs do not replace existing administrative IDs. Search includes world units and limits results to them while the world view is active.

Source geometry is WGS84. Display geometry uses a 0.005-degree topology-preserving simplification per feature and six-decimal coordinate precision, falling back to full precision if rounding would invalidate a feature. Multipart polygons and holes are retained. One invalid source feature (Turkmenistan) required `make_valid`; the manifest records it. Independent simplification is for cartographic display, not a survey or topologically certified global GIS partition. Labels use interior points in the largest polygon component. Country focus uses the largest component to avoid zooming out to include distant dependencies.

## Equal Earth projection

The default political world view uses D3 `geoEqualEarth()` and `geoPath(projection)`. Installed MapLibre GL 6.7 supplies the existing regional renderer but does not implement Equal Earth directly. `map-view.tsx` routes the political world scope and world-only selections to a compatible SVG renderer implementing the same `MapAPI`. Existing regional/Punjab rendering remains on MapLibre. Existing imagery/street basemaps also retain their original Mercator renderer; the world controls explicitly identify that projection and offer **Return to Equal Earth**. Those optional imagery modes are not equal-area comparisons. No administrative geometry, ID, parent relationship, color record or territorial edit is replaced.

The existing WGS84 GeoJSON is streamed directly through Equal Earth. Screen coordinates from the old Mercator renderer are never used as input. A copied ring-order normalization handles D3's spherical winding convention; source coordinates remain unchanged. D3's spherical clipping handles the antimeridian. `fitExtent` on the sphere includes the entire latitude range through the South Pole and Antarctica, with no Mercator latitude cutoff.

The responsive SVG has a fixed `viewBox="0 0 1200 660"` and `preserveAspectRatio="xMidYMid meet"`. A single uniform D3 zoom/pan transform encloses country polygons, subdivisions, boundaries, labels and selection outlines. Native SVG hit testing uses the rendered paths; rectangle/polygon selection transforms projected geographic interior points using the same camera. Measurement inverts this same projection and reports geodesic distances. Browser resize changes the containing viewport and unused space, with no independent X/Y scaling. Mobile framing reserves room for the title, controls and inspector.

Country borders are thin (0.65 px at default width). Internal borders are lighter (0.28 px, 22% opacity), hidden until zoom scale 3, and subdivision labels require scale 8 plus sufficient projected screen area. Country labels are also filtered for screen area and collisions. Country/subdivision fills preserve existing explicit paints, inheritance, uploaded palette and patterns. Zoom, pan, search, inspection, selection, hiding, naming, undo and saved maps continue through the existing editor. The SVG is keyboard focusable with arrow-key panning and +/- zoom; the Areas controls expose selection/edit actions to keyboard users.

World SVG, PNG and JPG exports use this same renderer, projection and uniform transform, including current-view exports. SVG exports retain the responsive viewBox and aspect-ratio attribute, source attribution, projection metadata, and existing edits. Raster exports rasterize that SVG at its native aspect ratio. They do not pass through the regional exporter's Mercator path generator.

`check-equal-earth.mjs` measures spherical geographic polygon areas (`geoArea`) from the same source geometry, and compares them to Equal Earth projected polygon areas for Greenland versus Africa (including Western Sahara), Australia and Antarctica. It checks four viewport aspect ratios and antimeridian segments for Russia, Alaska/USA, Fiji and Kiribati. The maximum observed area-ratio error is below 0.01%; this is a spherical source-geometry check, not a new certified ellipsoidal area dataset. The audit is written to `outputs/world-map/equal-earth-area-audit.json`.

`verify-equal-earth.mjs` independently computes areas from the actual browser SVG paths, checks equal X/Y screen-transform scales and unchanged path coordinates after resizing, confirms visible Antarctica above mobile controls, and exercises projected hover/click/rectangle hit testing, saved colors/names/hiding, internal detail on zoom, and unstretched PNG output. Screenshots are saved for desktop, mobile and enlarged UK views.

To rebuild, download the two official ZIP URLs from `app/world-sources.json` to ignored `work/world-source/cgaz-adm{0,1}.zip`, extract each into `work/world-source/cgaz-adm{0,1}/`, install `shapely` and `pyshp` into `work/world-python`, then run:

```sh
python scripts/build-world-map.py
node scripts/check-world-map.mjs
node scripts/check-map-scopes.mjs
node scripts/check-equal-earth.mjs
npm run build:vercel
node scripts/verify-world-map.mjs
node scripts/verify-equal-earth.mjs
```

The importer reads the CGAZ shapefile DBF text as Latin-1 (these ZIPs do not supply a UTF-8 CPG). Source ZIP checksums pin the downloaded inputs. Browser checks use `MAP_TEST_URL` (default `http://127.0.0.1:4546/`) and verify both layers, UK hierarchy, countries-only mode, painting, search, finite attributed SVG export, save/reload and mobile controls. Generated screenshots and exports go to ignored `outputs/world-map/`.
