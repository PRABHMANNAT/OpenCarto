# Password-protected alternate world map

The **Alternate world map** option opens the complete Equal Earth world map. It reuses the existing country and first-level-division data, colors, selection, zoom and export tools, applying the approved fictional South Asian border changes. **World map** opens the original source edition.

The alternate edition includes United Punjab as an Indian state. Balochistan is an independent country; Sindh, Multan and Bahawalpur are separate first-level Indian provinces. Jammu & Kashmir and Ladakh use the existing combined claimed-extent GIS: Gilgit-Baltistan and Azad Kashmir are merged into the Jammu & Kashmir world state; Aksai Chin, Siachen-Saltoro and Demchok are included in Ladakh. These are explicitly fictional political assignments. Amb remains outside Punjab. The detailed Punjab atlas still has exactly 48 districts, 12 divisions and 193 tehsils, with its original geometries, names, capitals, statistics and PDF download.

## Access

Opening **Alternate world map**, including from the custom atlas or the world edition picker, shows a password dialog. The requested code is checked by `server/alternate-world.mjs`, never compared in browser code. Incorrect entries leave the source world visible. Reloading or restoring a saved alternate map prompts again before displaying its boundary data. No unlock state or password is stored in saved maps or localStorage.

The server issues a short-lived HMAC-signed, HttpOnly, SameSite=Strict cookie (Secure on HTTPS). Boundary GET requests require a valid, unexpired signature. Responses use `private, no-store`; cross-origin writes, oversized bodies, malformed sessions and repeated failed attempts are rejected. Returning to the source edition clears server access. The handler uses `ALTERNATE_WORLD_SESSION_KEY` when configured, otherwise the existing server-only `PRIVATE_ATLAS_DATA_KEY`. No new environment setup is needed on the current atlas deployment. Failed-attempt throttling is per running function instance; it is not a distributed account system.

`server/alternate-world-overrides.geojson` is included only in the server function bundle and served through `/api/alternate-world`. The former public override asset is removed and its URL returns 404. The original public source-world GIS remains public. Authorized users can export the map using the existing download controls.

## GIS and provenance

The supplied `united-punjab-detailed-atlas.pdf` (15 pages; SHA-256 `b0af3f154bea9bdf9bcbc4ce6b343841c60750386a536d6342fececa41a21d64`) was checked visually and by its district labels. All 48 district names match the existing registry. Punjab GIS is reused from that registry, not traced from the PDF.

`app/india-punjab-scenario.json` records source hashes, original IDs, aliases, focus bounds, the exact transformation journal and output checksum. It contains metadata, not protected polygons or a password verifier. For compatibility, the existing `indiaPunjabScenario` saved-map flag identifies this alternate world edition.

- Dissolve the 48 canonical Punjab district polygons and retain the old world Indian Punjab edge fragments (0.0088207954 square degrees, approximately 0.0608% of the canonical footprint's angular area). Detailed Punjab boundaries remain exact and unchanged.
- Reuse the original Indian Jammu & Kashmir/Ladakh outlines, their LGD/Bharatlas claimed-extent source outlines, and the existing world Gilgit-Baltistan, Azad Kashmir, Aksai Chin, Siachen-Saltoro and Demchok geometries. Union Ladakh components; union Jammu & Kashmir components while excluding Ladakh and Punjab to prevent double assignment.
- Union the requested footprints into the original India country polygon. Subtract the same mask from all intersecting other country/state polygons; retire completely transferred context or subdivision records in this edition. Preserve unaffected source features byte-for-byte.
- Retain multipolygons, holes, islands, Islamabad's enclave and Hazarawala's complete northern valley. No hand-drawn border or invented district/tehsil polygon is introduced. Existing source-resolution differences outside the transfer mask remain unchanged.

The generator produces 30 replacements/additions and retires seven original records (three context outlines and four Pakistan first-level divisions). All resulting polygons validate without repair. The 193 canonical tehsil geometries have inherited rounding slivers against district edges; the largest is Taxila at 4.34758e-7 square degrees (0.00151% of that tehsil's angular area). Validation retains these with a documented 1e-6 square-degree tolerance.

Equal Earth rendering, hit testing, labels, selection and SVG/PNG/JPG exports use the same geographic replacements. Imagery views also receive them. Alternate exports use `alternate-world-map` filenames and include edition provenance.

## Western province update — 29 October 2026

The four province polygons come from the existing approved **United Subcontinent — Alternative Political Geography** atlas (WFP/OCHA 2022 provenance retained). They match the supplied reference screenshot; no boundaries are traced from its pixels. `scripts/prepare-alternate-world-provinces.mjs` reads the existing encrypted province shards and writes the reproducible intermediate to ignored `work/india-punjab/`. It does not modify the archive, registry or detailed atlas.

| Alternate unit | Level | Parent | Capital | Stable world ID |
|---|---|---|---|---|
| Balochistan | Independent country | None | Quetta | `world-c-balochistan` |
| Sindh | Province | India | Karachi | `world-a1-70912109B8393927546319` (preserved) |
| Multan | Province | India | Multan | `world-a1-alternate-multan` |
| Bahawalpur | Province | India | Bahawalpur | `world-a1-alternate-bahawalpur` |

The original Pakistan Balochistan ADM1 is retired in this edition in favor of its country record. Original Pakistani Punjab ADM1 is replaced by the already-approved United Punjab and the separate Multan/Bahawalpur provinces. Pakistan retains the remaining KP and Islamabad geometries. India has 39 mapped first-level divisions. The alternate edition contains 216 country/context outlines and 3,200 first-level polygons; the source edition remains exactly 218 and 3,202. Counts describe this source snapshot, not real-world recognition.

Canonical Sindh and Balochistan footprints are retained in full. Non-conflicting CGAZ coastal/source-edge fragments are retained with the appropriate parent. Existing approved United Punjab geometry takes priority over the source-resolution intersections with Multan (0.0000083366 square degrees) and Bahawalpur (0.0001306955 square degrees, including the earlier Indian-Punjab world-context fringe). Each is below 0.01% of the corresponding province's angular area. These are numerical/source-edition reconciliation amounts, not geographic land-area statistics.

The coarser original Pakistani-Punjab polygon contains 0.1357586 square degrees outside the union of the approved province footprints. Those unmatched source edges are retained as **India country context**, explicitly recorded in `westernSourceEdges`; they are not silently deleted or assigned invented province borders. The earlier Punjab/Ladakh source-resolution intersections are unchanged. New western provinces and the new country introduce no overlapping ownership. Country-level land coverage is conserved against the complete transfer mask.

Protected polygon delivery, password checking and the Equal Earth projection are unchanged. Search, first-level lists, focus controls, hiding, shape selection, inherited paint, labels, saved-map validation and exports use the active edition's ownership. Balochistan is appended to coordinated country palettes without changing any existing source-country color. Returning to the source edition restores the original administrative relationships and excludes all three synthetic records. No population or demographic values are invented or changed.

## Reproduce and verify

Use the configured `.env.local` and atlas key without copying secrets into generated files. Python needs Shapely under `work/world-python` or installed normally. Optional PDF validation uses pypdf under `work/pdf-reader-126` or the normal Python environment.

```powershell
npm run data:india-punjab
python scripts/build-india-punjab-scenario.py '<optional-source-pdf-path>'
npm run check:india-punjab
npx tsc --noEmit
npm run build:vercel
npm run preview:vercel -- --host 127.0.0.1 --port 4546 --strictPort
npm run check:india-punjab-browser
```

Geometry checks cover exact unions, full Kashmir/Aksai inclusion, preserved IDs, valid polygons, land conservation, no new overlaps and mask-limited changes. Server tests also simulate a flattened function deployment and verify server-file discovery. They cover password failure/success, protected data, origin/payload checks, signed-cookie tampering/expiry, logout and throttling. Browser tests verify the full world opens without a country filter, unrelated continents and colors remain unchanged, password failure/reload cannot expose alternate boundaries, updated polygons receive clicks, India lists Sindh/Multan/Bahawalpur, Pakistan lists only its two remaining subdivisions, Balochistan can be selected independently, downloads work, all three detailed Punjab views load and mobile layout fits. Screenshots are written to ignored `outputs/alternate-world/`.

Credits: world context geoBoundaries CGAZ, Runfola et al. (2020), CC BY 4.0; Punjab LGD/Bharatlas, Esri India, WFP/OCHA 2022; combined Kashmir LGD/Bharatlas 2024. Existing individual source licenses and detailed-atlas attribution remain applicable.
