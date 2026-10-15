# United Punjab: 48 districts and separate Amb Union Territory

Implemented revision: `united-punjab-48-amb-2026-10-15`. This is the approved fictional alternative-history map. The user confirmed **48 districts after Barnala merges into Sangrur**, and approved using the **complete dated 2022 Mansehra tehsil polygon**, including any later Tanawal land inside it.

## Result

| Administration | Districts | Mapped tehsils | WGS84 geodesic area |
|---|---:|---:|---:|
| United Punjab | **48** | **193** | **152,325.28 km²** |
| Remaining Khyber Pakhtunkhwa | 31 | 134 | 90,079.45 km² |
| Union Territory of Amb | 0; direct UT ownership | **2** | **520.52 km²** |

Punjab consists of 22 Indian Punjab-origin districts, 23 Pakistani Punjab-origin districts and three KP-origin districts. The existing Katas–Chakwal and Kartarpur Sahib–Narowal browser merges are now stored canonically, with the same displayed territory. Swabi, Abbottabad and Barnala are retired district records, with aliases and transformation records retained. Their original towns are not renamed.

| District | Capital | Tehsils |
|---|---|---|
| Akali Phula Singh · Zilla | Nowshera | Nowshera, Jehangira, **Hund** (Lahor), Razar, Swabi, **Mahabanpur** (Topi), **Ranigat** (Khado Khel / Khudu Khel) |
| Haripur | **Abbottabad** | Haripur, Ghazi, Khanpur, Abbottabad, Havelian, **Haro** (Lora), **Sherwan** (Lower Tanawal) |
| **Hazarawala** | Mansehra | Mansehra, **Pakhli** (Baffa-Pakhal), Balakot |
| **Amb · Union Territory** | Darband | Darband and Oghi; direct UT parents, no invented district |

Hazarawala is a new commemorative name inspired by Mahan Singh Hazarawala; it is not presented as an ancient territorial name. District profiles show all constituent tehsils and the approved heritage lists, including Sikh, Buddhist, Hindu, Pashtun, Hindko, Tanoli and Islamic history. Settlement names such as Topi, Lora, Baffa, Abbottabad, Panjtar and Totalai remain intact. Pabbi remains in KP. Sherwan stays in Haripur and is excluded from Amb. Shergarh is Amb’s historical royal centre.

## Geometry and source choices

The existing private WGS84 architecture and six-decimal source precision are retained. District consolidations use complete existing district polygons. Hazarawala uses all three complete WFP/OCHA source polygons: `PK52202`, `PK52204`, `PK52201`. Amb uses `PK52205` and `PK52203`. Source tehsil identifiers and original labels are retained; aliases do not create duplicate records. Full-resolution tehsils and districts retain multipolygons and holes. The existing 0.002-degree shared-edge overview derivative is generated only after precise ownership is valid.

The complete Balakot source polygon extends beyond the older reconciled KP outline. It includes source-edition portions previously assigned to United Jammu and Kashmir (**9.58 km²**) and Ladakh–Aksai Chin (**3.44 km²**). These identical polygons are subtracted from those prior fictional owners rather than clipping the approved Balakot polygon. A tiny Oghi/Darband–Punjab seam below 0.01 km² is also recorded. Shared linework is noded and polygonized using existing boundary segments; no invented border line is introduced. The national source footprint is preserved exactly, with zero measured symmetric difference.

Five pre-existing detail defects were repaired with `make_valid`, subject to absolute and relative area guards. The largest area difference was `1.4923e-9` square degrees in Rawalpindi. No district-scale territory was removed. The original atlas is preserved in ignored `private/united-atlas/before-united-punjab-48-amb.json`; retired records are in `administrative-history.json`. Public source datasets are unchanged.

Darband’s dated boundary also reconciles narrow pre-existing Haripur/Ghazi detail strips: `PK51102` changes by `9.335946471185247e-8` square degrees and `PK51101` by `1.899420834214201e-7` square degrees. Their maximum edge differences are about four metres; the combined affected detail area is below 0.003 km². These source-edition seams are explicit in the independent report. Every renamed northern tehsil, including Sherwan/Lower Tanawal, retains its existing polygon exactly; none of these small seams transfers Sherwan territory to Amb.

Two inherited district/tehsil source-edition mismatches remain unchanged: `PK63301` outside-parent area `0.00016519399343720346` square degrees, and `IN-T-251` `0.000037935782659738026` square degrees. They are reported by the preservation check, not silently clipped or attributed to this reorganization.

Additional Tanawal and historical Phulra administrative boundaries are **unresolved**. No extra polygon is assigned to Amb. A sourced Phulra village point is retained as a historical reference within the approved Mansehra/Hazarawala polygon; the historic princely state is not reconstructed from that point. Shergarh Fort is separately shown as a heritage point. Panjtar has no unambiguous point in the bounded source searches; the entire existing Khado Khel/Ranigat polygon is preserved and no Panjtar tehsil is invented. The complete Balakot polygon is retained through its northern mountain extent, rather than relying on city points to define its boundary.

The mapped [Babusar Pass point](https://www.openstreetmap.org/node/2433473451) is **outside the dated Balakot polygon** and therefore remains in United Jammu and Kashmir in this fictional atlas. The source polygon is not expanded to force the point into Punjab. Kaghan, Shogran, Saif-ul-Maluk Lake and Lulusar Lake source points are verified inside Balakot. The preserved full polygon and the Naran entry in the district’s original-place directory do not depend on an invented Naran town marker.

Sources and provenance:

- [WFP/OCHA Pakistan Common Operational Dataset](https://data.humdata.org/dataset/cod-ab-pak): source valid 2022-09-09, CC BY-IGO; local source SHA-256 `af7e96f2376be9bf25d74f542916bc3cc3b7c9eb05b2dc81f8d1dd4d1448b45f`.
- [Published tehsil layer](https://services1.arcgis.com/RTK5Unh1Z71JKIiR/arcgis/rest/services/Tehsil_My/FeatureServer/0): independently checked for the five Mansehra source codes and the dated edition. Its later publication date does not supply a newer Tanawal split.
- [OCHA Mansehra administrative map, February 2023](https://www.unocha.org/publications/map/pakistan/pakistan-khyber-pakhtunkhwa-mansehra-administrative-boundaries-february-2023): administrative reference, not a fabricated modern Tanawal polygon.
- [PBS 2023 division membership](https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf): the existing source-code crosswalk updates remaining KP division counts.
- [OpenStreetMap](https://www.openstreetmap.org/copyright): separately attributed landmark/reference coordinates, retrieved 2026-10-15; point IDs, licenses and provenance are pinned in `app/united-punjab-reference-places.json`. Points do not alter boundaries.

## UI, colors and statistics

The national map supports independent detail views for multiple provinces and Amb simultaneously. District profiles, tehsil labels, hover/selection, directory, area rankings, division summaries and PNG downloads use the new hierarchy. Amb follows the existing `Union territory` classification and has a distinct color from the existing palette. Dark province borders and the collapsible information panel remain available. The removed “Punjab & KP decisions” button remains absent.

Search is available at `/api/private-atlas?action=search&q=...`, with a bounded response. Original-name searches find the canonical renamed tehsil. Province overview remains below the hosting response-size limit. Saved retired district IDs and old browser-only merges are migrated, preventing accidental duplicate merges or resurrection of Swabi/Abbottabad/Barnala.

The atlas receives the existing editor draft’s imported `paintPalette`. It assigns district colors from those exact hex codes in alphabetical order, and district-colored tehsils inherit their parent’s color. The existing 45-color default is retained if no imported palette is present; shorter palettes cycle without inventing additional hex codes. Old color overrides are reset once for this revision; subsequent manual changes persist.

Areas use GeographicLib ellipsoidal measurement. Existing compatible fictional allocations are summed for Sangrur–Barnala, Katas and Kartarpur Sahib. Original allocations and notes are archived. Population, density and religion totals for the changed KP-origin districts, Punjab, KP and Amb are **unavailable** where no compatible complete aggregate exists. Missing values are not zero and receive no population rank. Rankings identify the number of comparable districts/divisions. No census years are combined and no population, religion, economic or forest values are fabricated.

## Final district directory

| # | District | Capital | Mapped tehsils |
|---:|---|---|---:|
| 1 | Akali Phula Singh | Nowshera | 7 |
| 2 | Amritsar | Amritsar | 4 |
| 3 | Babe Di Ber | Sialkot | 4 |
| 4 | Bathinda | Bathinda | 3 |
| 5 | Bulleh Shah | Kasur | 4 |
| 6 | Chenab | Chiniot | 3 |
| 7 | Dinga | Gujrat | 3 |
| 8 | Faridkot | Faridkot | 2 |
| 9 | Fatehgarh Sahib | Fatehgarh Sahib | 4 |
| 10 | Fazilka | Fazilka | 3 |
| 11 | Ferozepur | Ferozepur | 3 |
| 12 | Gurdaspur | Gurdaspur | 3 |
| 13 | Harappa | Sahiwal | 5 |
| 14 | Haripur | Abbottabad | 7 |
| 15 | Hazarawala | Mansehra | 3 |
| 16 | Hoshiarpur | Hoshiarpur | 4 |
| 17 | Jalandhar | Jalandhar | 5 |
| 18 | Jhang | Jhang | 4 |
| 19 | Jhelum | Jhelum | 4 |
| 20 | Kair Sahib | Mandi Bahauddin | 3 |
| 21 | Kapurthala | Kapurthala | 4 |
| 22 | Kartarpur Sahib | Shakargarh | 3 |
| 23 | Katas | Choa Saidan Shah | 4 |
| 24 | Khushab | Khushab | 4 |
| 25 | Lahore | Lahore | 10 |
| 26 | Ludhiana | Ludhiana | 7 |
| 27 | Mansa | Mansa | 3 |
| 28 | Moga | Moga | 4 |
| 29 | Nanaksar | Pakpattan | 2 |
| 30 | Nankana Sahib | Nankana Sahib | 3 |
| 31 | Panja Sahib | Hasan Abdal | 6 |
| 32 | Pathankot | Pathankot | 2 |
| 33 | Patiala | Patiala | 5 |
| 34 | Ranjitgarh | Gujranwala | 4 |
| 35 | Rawalpindi | Rawalpindi | 6 |
| 36 | Rori Sahib | Hafizabad | 2 |
| 37 | Rupnagar | Rupnagar | 2 |
| 38 | S A S Nagar | S A S Nagar | 3 |
| 39 | Sacha Sauda | Sheikhupura | 5 |
| 40 | Sandalbar | Faisalabad | 6 |
| 41 | Sangrur · includes Barnala and retained Malerkotla | Sangrur | 8 |
| 42 | Sargodha | Sargodha | 7 |
| 43 | Shahid Bhagat Singh Nagar | Shahid Bhagat Singh Nagar | 2 |
| 44 | Sri Anandpur Sahib | Anandpur Sahib | 2 |
| 45 | Sri Muktsar Sahib | Sri Muktsar Sahib | 3 |
| 46 | Tarn Taran | Tarn Taran | 3 |
| 47 | Taxila | Taxila | 1 |
| 48 | Toba Tek Singh | Toba Tek Singh | 4 |

## Regeneration and validation

Use `npm run data:united-punjab` on the existing canonical atlas. It preserves the backup, applies the shared specification, synchronizes editorial metadata and repacks with the existing server key. Repeated execution does not repeat geometric transfers. Do not rerun older scaffold/population builders over this final atlas without restoring their compatible input snapshot first.

Python requires Shapely 2.1+ and GeographicLib. `ATLAS_PYTHON` can select a compatible interpreter; on this Windows workspace the runner discovers the bundled Python 3.12 runtime and project-local `work/geometry-runtime-win` packages. These dependencies and private backups are ignored, while the specification, builder, tests and encrypted runtime dataset are tracked.

Validation commands:

```text
npm run build:vercel
npx tsc --noEmit
npx oxlint app/private-atlas.tsx app/private-atlas-districts.ts
npm run check:united-punjab
npm run check:united-punjab-browser
```

The independent spatial check validates 329 single-owner tehsils in Punjab/KP/Amb, all 8,091 detail polygons, full Balakot source equality, retained district statistics and territory, exact and overview shared coverage, original aliases and unchanged national footprint. Browser checks exercise the 48-district directory, 7/7/3 profiles/capitals, seven original-name searches, simultaneous Punjab/KP/Amb detail, imported hex palette, PNG download, collapse/expand and mobile layout. Reports/screenshots are in ignored `outputs/private-atlas/`.

Serve locally with `npm run preview:vercel -- --port 4545 --strictPort --host 127.0.0.1`. Restart after repacking because the API caches its decrypted dataset. The required existing `PRIVATE_ATLAS_DATA_KEY` stays server-only; no new password or credentials are introduced.
