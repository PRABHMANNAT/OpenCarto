# Detailed United Punjab PDF maps

The custom atlas now includes a **Detailed Punjab PDF** button. It automatically downloads a 15-page vector atlas: a complete division map, district map, tehsil map, and 12 enlarged tehsil maps grouped by division. **Download map** also offers division-only, district-only and tehsil PDF downloads; the existing PNG choices remain available.

The export loads all paginated Punjab district, division and tehsil features through the existing API, including geometry not currently visible. It requires exactly 48 districts, 12 divisions and 193 tehsils, and excludes independent Amb. Zoom, an isolated district, hidden screen labels, the active demographic metric and the current basemap do not limit the PDF. Current district display names and district/division fill edits are retained where applicable; editable district merges are deliberately not applied to this canonical 48-district publication. No geographic data or administrative assignment is changed.

Maps are vector paths and selectable text, rather than screenshots. All polygon vertices, holes and multipolygon parts are retained in a north-up cylindrical Mercator projection from WGS84 source coordinates. Division and district boundary overlays use heavier lines. Labels use the existing canonical map anchors when inside their polygon, with an interior-point fallback. Every name has a collision-checked label box at a fixed print font size. Displaced labels receive leader lines to their polygon; no label is omitted because of crowding. Division labels include headquarters names. Each page includes the layer count, approximate scale, north arrow, attribution and fictional-geography notice.

The division overview and enlarged division maps use A2 portrait pages. Province-wide district and tehsil sheets use A1 portrait pages. Open the PDF at a comfortable zoom or print at its original page size; reducing the entire 193-label overview to A4 will reduce its physical text size. The 12 enlarged sheets provide a more convenient way to read crowded tehsil groups. There are 12, 48 and 193 labels on the respective province-wide sheets, and all 193 tehsils appear again exactly once across the enlarged sheets.

The PDF library loads only when an export is requested. Progress and cancellation are available, and closing the atlas aborts pending data requests. The exporter runs in the browser, uses the existing API, and requires no new server key, rendering service or hosted PDF endpoint. Current English/Latin-script administrative labels are supported by the embedded standard PDF font.

If a tab was left open across a deployment and its PDF module has expired, the atlas saves the pending PDF scope and selected province/district and display toggles in session storage, refreshes once, reopens the atlas and resumes the download. Saved district edits, colours and detail levels continue to use their existing local storage. The recovery expires after five minutes and retains an attempt guard after resuming to prevent refresh loops. Offline browsers or browsers without session storage receive an actionable error instead. Persistent module failures also show an error after the single recovery. Vercel revalidates the HTML entry and returns 404 for absent assets rather than serving HTML as JavaScript.

## Generation and checks

```sh
npm run export:punjab-pdf
npm run build:vercel
npm run preview:vercel -- --host 127.0.0.1 --port 4545 --strictPort
npm run check:punjab-pdf-browser
```

The command-line generator uses the same TypeScript PDF engine as the browser and the current encrypted atlas. It writes four files to ignored `output/pdf/`: the full atlas and separate division, district and tehsil PDFs. It asserts unique labels, complete hierarchy counts, non-overlapping label boxes and page-safe placement, and records a label audit under `outputs/private-atlas/`.

Browser verification downloads all 15 pages with only Hazarawala selected and screen names disabled, confirms those UI settings remain unchanged, checks the three individual PDF options and verifies mobile controls. Independent PDF text extraction verifies every administrative name in the three overviews; all 15 pages are rendered for visual inspection. The generated output PDFs are delivery artifacts, not replacement GIS data.

Set `PDF_CHUNK_FAILURE=once` when running the browser check to simulate an expired module and verify the resumed 15-page download. Set `PDF_CHUNK_FAILURE=persistent` to verify the bounded retry and error path. These checks require the production build, whose PDF module is a separate hashed asset.
