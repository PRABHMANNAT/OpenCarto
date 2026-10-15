# United Punjab: final 12 divisions and statistics

**Current population edition:** [2026 demographic scenario](punjab-demographics-2026.md) supersedes this record's population allocations with exactly **6,75,36,450** residents. All 12 division assignments, headquarters, colors and boundaries remain unchanged. Updated division populations, religious composition, urban/rural values and density derive from the same 48 districts and 193 tehsils and are exported in `reports/punjab-demographics-2026/division.csv`. The population table below is the archived earlier edition.

**Subsequent view:** [Six historical regions](punjab-historical-regions.md) adds a parallel grouping of the 48 districts without altering division membership.

Revision `punjab-final-12-divisions-2026-10-15` finalizes the existing fictional map as **48 districts, 12 divisions and 193 mapped tehsils**. It does not alter district, tehsil or state boundaries. Amb remains an independent Union Territory with Darband as its capital and is excluded from all Punjab division and population totals.

## Division assignments

Rawalpindi contains exactly **Rawalpindi, Taxila, Panja Sahib, Katas and Jhelum**, with headquarters at **Rawalpindi**. Hazara contains exactly **Haripur, Hazarawala and Akali Phula Singh**, with headquarters at **Abbottabad**. The two division polygons are unions of their complete existing member district polygons. Akali Phula Singh previously had no division assignment, producing a thirteenth dashboard group; it now belongs to Hazara.

The other ten divisions retain their original district assignments, exact polygons, colors, labels, headquarters coordinates, photographs and descriptions. All district capitals, original-name aliases, tehsil names and saved custom names are preserved. In particular, Haripur's district capital remains Abbottabad and Akali Phula Singh's remains Nowshera. The existing division palette and headquarters marker controls continue to apply.

| Division | Headquarters | Districts | Area, km² | Fictional population |
|---|---|---:|---:|---:|
| Rawalpindi | Rawalpindi | 5 | 22,152.33 | 7,838,161 |
| Hazara | Abbottabad | 3 | 10,243.18 | 2,469,679 |
| Lahore | Lahore | 4 | 11,436.54 | 13,315,678 |
| Sandalbar | Sandalbar city | 5 | 25,944.81 | 11,880,886 |
| Kartarpur | Amritsar | 5 | 10,977.52 | 4,344,725 |
| Jalandhar | Jalandhar | 4 | 8,917.37 | 4,061,831 |
| Anandpur Sahib | Mohali | 4 | 3,619.11 | 1,525,114 |
| Ludhiana | Ludhiana | 2 | 5,940.87 | 3,685,907 |
| Patiala | Patiala | 3 | 10,519.82 | 4,235,227 |
| Ranjitgarh | Ranjitgarh | 5 | 14,798.65 | 8,324,729 |
| Sargodha | Sargodha | 3 | 15,047.48 | 4,406,673 |
| Bathinda | Bathinda | 5 | 12,727.46 | 3,911,390 |

The canonical membership specification is `app/united-punjab-divisions.json`. Both updated areas use WGS84 ellipsoidal measurement; the other ten retain their existing measurements. State area remains **152,325.28 km²**. Displayed areas are polygon measurements, including retained source inland waters.

## Population and sidebar updates

The user's **7 crore / 70,000,000** total is an explicitly fictional scenario, separate from real census fields. `app/united-punjab-population.json` pins the weights and provenance for all 48 districts. The 45 compatible earlier fictional district allocations provide their existing weights; the three KP-origin districts use the application's existing settlement/area model for missing weights. Largest-remainder apportionment produces whole-resident district allocations that sum to exactly 70,000,000. Division populations sum their member districts, and all 12 division totals also reconcile exactly. District population ranks include all 48 districts; density uses these allocations divided by polygon area. Punjab's scenario density is **459.5 people/km²**.

This is a population-only revision. Earlier religious allocations are archived as `previousPopulationScenario` rather than rescaled into an unsupported new religious breakdown. Real population/census fields and source records remain unchanged. KP and Amb receive no fabricated population estimates.

The province sidebar restores the missing Punjab silhouette from the unchanged polygon, changes its area label to **State area**, shows **7 crore**, and replaces the density card with the requested highest-point estimate. Density remains available in the scenario note. District and division profiles, rankings, search results and the district directory use the same hierarchy. The district dashboard also exports a UTF-8 CSV with all 48 district names, divisions, capitals, tehsil counts, areas, fictional populations and densities; saved custom names appear in that export. Map PNG downloads continue to work.

## Calculated environmental estimates

These values are calculated for the existing Punjab polygon, excluding Amb. `app/united-punjab-environment.json` pins the boundary hash, source tile URLs, coverage and methods. They are estimates rather than legal forest statistics or a surveyed mountain summit.

- **Tree cover: approximately 15,460 km² / 10.2%.** Numeric [ESA WorldCover 2021 v200](https://esa-worldcover.org/en/data-access) class-10 rasters are sampled by nearest-neighbor onto an approximately 100 m classified grid using available categorical overviews. Cell centers must lie inside Punjab; ellipsoidal cell areas weight the class counts. The resulting share is applied to the exact state area and rounded to 10 km². Seven source tiles provide complete classified coverage. The class includes plantations and differs from official recorded forest area. Attribution: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium; CC BY 4.0.
- **Highest mapped elevation: approximately 5,200 m**, at **34.8222° N, 73.7244° E**. Complete native-resolution [Copernicus GLO-90](https://registry.opendata.aws/copernicus-dem/) coverage uses 31 tiles. Tiles within 300 m of the coarse maximum are refined with available native GLO-30 data. The winning 30 m cell is 5,202.28 m, rounded to 10 m. The [Copernicus COG documentation](https://copernicus-dem-30m.s3.amazonaws.com/readme.html) describes a digital surface model, including vegetation/buildings. No summit name is inferred from the raster. The approved boundary itself is unchanged.

The forest estimate uses numeric class data, never RGB map imagery. Boundary cell sampling, categorical overviews, finite elevation resolution and the candidate-refinement method limit precision. All coarse and refined elevation tile metadata remain available in the pinned estimate record.

## Regeneration and validation

The complete pre-change atlas is preserved locally as `private/united-atlas/before-final-12-divisions.json`; the earlier territorial reorganization backup is also retained. Source/private inputs and raster caches remain ignored; the configuration, derived estimate record, scripts, tests and encrypted runtime dataset are tracked.

```text
npm run data:united-punjab
npm run build:vercel
npx tsc --noEmit
npx oxlint app/private-atlas.tsx app/private-atlas-districts.ts
npm run check:united-punjab
npm run check:punjab-final-divisions
npm run check:united-punjab-browser
npm run check:punjab-final-divisions-browser
```

`data:united-punjab` applies the existing territorial specification, preserves/pins population weights, finalizes divisions and statistics, then repacks using the existing server-only data key. Repeated finalization preserves previous statistics and does not duplicate decision records or geometric transfers. To recalculate the environmental record first, run `npm run data:punjab-environment`, then finalize/repack. The environmental calculation additionally requires NumPy and Rasterio in the project Python runtime and network access to the public numeric COGs. The current boundary hash must match before estimates are applied.

The independent spatial check verifies exactly one division per district, the two required membership sets and their polygon unions, unchanged other-ten division polygons and metadata, every district/tehsil polygon and capital, independent Amb, valid polygons, source aliases and unchanged national geography. Population checks verify integer allocations, exact totals and preservation of the previous scenario. Browser checks cover division selection/search, headquarters markers, district profiles, restored silhouette, state facts, simultaneous Punjab/KP/Amb detail, the uploaded hex palette, custom names, CSV/PNG downloads, collapse/expand and mobile layout. Production build, TypeScript, targeted lint, both geometry suites, API checks and both browser suites pass. Reports and screenshots are in ignored `outputs/private-atlas/`.

The district and state source editions have small **inherited cross-layer seams**: approximately **0.678 km²** of the state lacks district coverage, and **0.524 km²** of district coverage lies outside the state polygon. Rawalpindi and Hazara inherit about **0.0089 km²** of district-source overlap; other division pairs have much smaller precision slivers. Consequently, strict shared-edge coverage validation of the division layer reports false even though each polygon is valid. The independent check compares every division intersection with the preserved source district/division geometry and confirms **zero additional overlap**. These features are reported, not repaired, because this request expressly preserves district polygons and the other ten divisions. Independent polygon measurements and rounded display values therefore need not sum exactly to the state measurement; the unchanged district union is also checked against the backup.

The earlier source-edition detail mismatches and historical Tanawal/Phulra limitations remain documented in [the 48-district and Amb implementation record](united-punjab-48-and-amb.md). No related territory is modified by this division finalization.

Serve locally with `npm run preview:vercel -- --port 4545 --strictPort --host 127.0.0.1`. Restart after repacking because the API caches its decrypted data. Older scaffold/population builders describe historical snapshots and must not overwrite this final edition.
