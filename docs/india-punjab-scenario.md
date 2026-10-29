# Password-protected alternate world map

The **Alternate world map** option opens the complete Equal Earth world map. It reuses the existing country and first-level-division data, colors, selection, zoom and export tools, replacing only the requested United Punjab and Kashmir border footprints. **World map** opens the original source edition.

The alternate edition includes United Punjab as an Indian state. Jammu & Kashmir and Ladakh use the existing combined claimed-extent GIS: Gilgit-Baltistan and Azad Kashmir are merged into the Jammu & Kashmir world state; Aksai Chin, Siachen-Saltoro and Demchok are included in Ladakh. These are explicitly fictional political assignments. Amb remains outside Punjab. The detailed Punjab atlas still has exactly 48 districts, 12 divisions and 193 tehsils, with its original geometries, names, capitals, statistics and PDF download.

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

The generator produces 19 replacements and retires five original records (three context outlines and two Pakistan first-level divisions). All resulting polygons validate without repair. The 193 canonical tehsil geometries have inherited rounding slivers against district edges; the largest is Taxila at 4.34758e-7 square degrees (0.00151% of that tehsil's angular area). Validation retains these with a documented 1e-6 square-degree tolerance.

Equal Earth rendering, hit testing, labels, selection and SVG/PNG/JPG exports use the same geographic replacements. Imagery views also receive them. Alternate exports use `alternate-world-map` filenames and include edition provenance.

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

Geometry checks cover exact unions, full Kashmir/Aksai inclusion, preserved IDs, valid polygons, land conservation, no new overlaps and mask-limited changes. Server tests also simulate a flattened function deployment and verify server-file discovery. They cover password failure/success, protected data, origin/payload checks, signed-cookie tampering/expiry, logout and throttling. Browser tests verify the full world opens without a country filter, unrelated continents and colors remain unchanged, password failure/reload cannot expose alternate boundaries, updated polygons receive clicks, downloads work, all three detailed Punjab views load and mobile layout fits. Screenshots are written to ignored `outputs/alternate-world/`.

Credits: world context geoBoundaries CGAZ, Runfola et al. (2020), CC BY 4.0; Punjab LGD/Bharatlas, Esri India, WFP/OCHA 2022; combined Kashmir LGD/Bharatlas 2024. Existing individual source licenses and detailed-atlas attribution remain applicable.
