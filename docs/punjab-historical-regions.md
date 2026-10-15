# United Punjab: six historical regions

**Current population edition:** [2026 demographic scenario](punjab-demographics-2026.md) replaces the historical population column below with exactly **6,75,36,450** residents aggregated from the same 48 districts and 193 tehsils. Pothohar is now displayed as **Pothohar–Gandhara**, retaining its original identifier, members, color and alias. All regional geometries and the 12 division memberships remain unchanged. The 70,000,000 population table below records the superseded allocation; current region counts, religion composition, urban/rural values and density are available in the linked scenario and generated CSV tables.

Revision `punjab-six-historical-regions-2026-10-15` adds **View → Historical Regions** immediately above **Divisions**. It groups the existing 48 Punjab districts into exactly six regions. Historical regions are a parallel editorial grouping: they do not replace or reorganize the 12 administrative divisions. No regional capitals or headquarters are invented.

| Region | Districts | WGS84 polygon area, km² | Existing fictional population |
|---|---:|---:|---:|
| Majha | 13 | 34,471.03 | 25,310,254 |
| Malwa | 10 | 29,188.15 | 11,832,524 |
| Doaba | 4 | 8,917.37 | 4,061,831 |
| Puadh | 4 | 3,619.11 | 1,525,114 |
| Bar | 9 | 43,733.96 | 16,962,437 |
| Pothohar | 8 | 32,395.50 | 10,307,840 |
| **Total** | **48** | Independently measured region unions | **70,000,000** |

The exact approved membership is pinned in `app/united-punjab-regions.json`:

- **Majha:** Lahore, Amritsar, Tarn Taran, Gurdaspur, Pathankot, Kartarpur Sahib, Bulleh Shah, Babe Di Ber, Ranjitgarh, Dinga, Sacha Sauda, Nankana Sahib, Rori Sahib.
- **Malwa:** Ludhiana, Moga, Faridkot, Ferozepur, Fazilka, Bathinda, Mansa, Sangrur, Patiala, Sri Muktsar Sahib.
- **Doaba:** Jalandhar, Kapurthala, Hoshiarpur, Shahid Bhagat Singh Nagar.
- **Puadh:** Rupnagar, S A S Nagar, Fatehgarh Sahib, Sri Anandpur Sahib.
- **Bar:** Sandalbar, Jhang, Toba Tek Singh, Chenab, Harappa, Nanaksar, Sargodha, Khushab, Kair Sahib.
- **Pothohar:** Rawalpindi, Taxila, Panja Sahib, Katas, Jhelum, Haripur, Hazarawala, Akali Phula Singh.

## Map and data behavior

The region layer unions the complete existing district polygons in WGS84 without clipping, simplifying or repairing district boundaries. Multipolygons and holes are preserved. Each canonical district has exactly one `historicalRegion` and `historicalRegionId`; its tehsils inherit the same region through their existing district ID. Divisions, district capitals, tehsil names and existing population allocations are unchanged. Amb and all other provinces remain outside the Punjab region layer.

The map shows six colored regions with their own labels and a legend. Colors reuse six existing atlas division palette values; existing district/division colors and saved custom names remain intact. Selecting a polygon, legend entry, search result or region picker opens the corresponding region profile, district list, area, tehsil count and fictional population. District links open the existing district profiles. Names on/off and region fill controls work with the new layer. Regions have no headquarters marker layer.

All six regions are searchable by short name or by “Historical Region”; exact name/alias matches precede substring matches, keeping short names such as Bar discoverable within the bounded search response. The selected province detail mode persists across reopening the atlas and can coexist with detail in Amb or other provinces.

The region panel exports a six-row CSV including district membership, area, tehsil count and fictional population. District statistics and research exports include historical region assignments. Saved custom district names appear in region lists and the region CSV. Existing current/full map PNG exports use the displayed region layer. Population totals aggregate the established **7-crore fictional scenario**; no new census or religious values are introduced.

Inherited cross-layer precision seams documented in [the division/statistics record](punjab-final-divisions-and-statistics.md) remain unchanged. Each region is checked against the exact union of its member district polygons; the combined region/district footprint has **zero measured symmetric-difference area**. Regrouped unions can retain different zero-area seam linework, so the aggregate footprint test measures area with a strict numeric tolerance rather than relying only on topological line equality. Region area measurements are independent unions and rounded display values need not sum to the state measurement.

## Regeneration and checks

The complete pre-region canonical atlas is preserved in ignored `private/united-atlas/before-historical-regions.json`. Apply the configuration and repack the encrypted runtime dataset with:

```text
npm run data:punjab-historical-regions
```

The full `npm run data:united-punjab` pipeline also reapplies historical regions after district/division finalization. Region generation is repeatable and does not duplicate search records or decision notes. It uses the existing Python/Shapely/GeographicLib runtime and server-only data key; source/private inputs and backups remain ignored.

```text
npm run check:punjab-historical-regions
npm run build:vercel
npx tsc --noEmit
npx oxlint app/private-atlas.tsx app/private-atlas-detail.ts server/private-atlas.mjs
npm run check:punjab-historical-regions-browser
npm run check:punjab-final-divisions-browser
```

The independent spatial checks compare the pre-change dataset with the new atlas: all 12 division records are identical, all existing district/tehsil/state geometries and statistics are preserved, all 48 districts and 193 tehsils have the approved region assignment, every region polygon is valid, and Amb/other provinces are unchanged. API checks exercise the encrypted dataset, response-size limits, short/full-name search, exact membership, totals and existing alias/palette regressions. Browser verification covers menu order, six region selections, an actual polygon click, labels, custom names/colors, district drill-down, CSV/PNG downloads, retained division headquarters, simultaneous Amb detail, persisted view mode, and desktop/mobile layout. Reports and screenshots are saved under ignored `outputs/private-atlas/`.

Serve with `npm run preview:vercel -- --port 4545 --strictPort --host 127.0.0.1`. Restart the server after repacking so its cached dataset refreshes.
