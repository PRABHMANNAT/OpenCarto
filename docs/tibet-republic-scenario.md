# Republic of Tibet — alternate-world GIS edition

This is a **hypothetical peaceful, negotiated independence scenario, protecting all existing communities**. It adds the independent Republic of Tibet to the existing password-protected alternate world, with **Lhasa** as capital. It does not change the source world, the detailed United Punjab atlas, or the previous alternate-world Indian/Pakistani/Balochistan edits.

## Footprint and area

The final country is the union of the requested administrative polygons, intersected with the previous alternate-world China polygon and excluding existing India, Nepal and Bhutan polygons. No international border of those three countries is moved. China loses exactly the resulting Tibet footprint. The separate excluded-source reference is never counted as Tibet ownership or area.

**Measured GIS area: 2,110,606.85 km²** (`2,110,606,853,901.3215 m²` before display rounding). GeographicLib 2.1 integrates geodesic polygon rings on the WGS84 ellipsoid, subtracting holes and retaining all polygon components. Water inside the source polygons is included. This is reproducible for the pinned source geometry, not a claim of exact ground-survey accuracy. Independent geodesic integrations of the three regional rings differ from the country by about 0.0072 km² because planar clipping inserts shared-edge vertices; the validation tolerance is below 1e-8 of the country area. No manually scaled area or screen-coordinate measurement is used.

Sources are the existing **cn-atlas / CTAmap 2023** province and prefecture GIS (ISC/MIT) and **geoBoundaries China county-level 2017** GIS (PDDL 1.0). Their administrative source IDs, native names, original names, dates and hashes are retained. Neither entire Sichuan nor entire Qinghai/Gansu/Yunnan is substituted for the selected units. The county input is the two actual autonomous-county polygons, not their parent prefectures.

## Internal units and cultural grouping

The country has **19 selectable first-level source units**. The historical-cultural regions are additional aggregations of those same units. They are explicitly fictional administrative groupings inspired by cultural geography, not surveyed boundaries of language, ethnicity or historical sovereignty.

| Cultural region | Constituent units |
|---|---|
| Ü-Tsang | Lhasa, Shigatse, Shannan, Nyingchi, Nagqu, Ngari |
| Kham | Chamdo, Yushu, Garzê, Muli Tibetan Autonomous County, Diqing |
| Amdo | Golog, Hainan, Huangnan, Haibei, Haixi, Ngawa, Gannan, Tianzhu Tibetan Autonomous County |

This preserves all seven Tibet Autonomous Region prefecture/city units and all twelve specified units outside it. Nyingchi is grouped with Ü-Tsang for this modern-unit scenario; Chamdo is grouped with Kham. Cultural divisions within Nyingchi, Nagqu, Ngawa and other modern units are not fabricated as new polygons. Each active administrative polygon belongs once to the country; each cultural group is a disjoint exact union of its active units plus explicitly recorded TAR source-edge context.

## Mixed-source edge reconciliation

The 2017 county and 2023 prefecture GIS are not perfectly aligned. Their original geometries overlap by approximately **390.85 km²**:

- Garzê / county-source overlap: **171.37 km²**.
- Diqing / county-source overlap: **1.97 km²**.
- Haibei / county-source overlap: **217.50 km²**.

The two county polygons take priority at those shared edges. Overlapping portions are removed from the corresponding prefecture display records, with no change to the country union and no invented straight boundary. Full input geometry is preserved in the pinned sources; the manifest records per-unit duplicate areas. The publisher's matching-edition county download was checked but is distributed through a Baidu download rather than the existing public GeoJSON. The implemented mixed-edition method and source dates are disclosed in the app's GIS details, rather than silently claiming a uniform current register.

The source TAR province/prefecture outlines leave **4.93 km²** of country context without a defensible prefecture assignment. It remains country context and is included in the Ü-Tsang aggregation, not assigned an invented administrative unit. A further **5,382.14 km²** of coarser CGAZ TAR source-edge differences remain with China as country context after the obsolete world TAR record is retired. The country boundary follows the requested canonical administrative GIS, not an expanded coarse-world approximation.

The **79,562.79 km²** excluded-source reference combines claims and source-resolution differences outside the allowed China footprint. It is not described as a single surveyed disputed territory. It can be displayed with dashed outlines and is excluded from country, cultural-region and internal-unit area/ownership. Existing disputed context records remain separate. India, Nepal and Bhutan preserve their prior coordinates exactly; no unrelated country's geometry is modified by the Tibet operation.

## UI, places and exports

In **Alternate world map**, select **Explore Republic of Tibet**. The panel displays capital, WGS84 GIS area, internal-unit count, cultural groups and provenance. The existing international/internal border controls apply to Tibet. The internal-view selector switches between the 19 administrative units and Ü-Tsang/Kham/Amdo colors. Individually saved province paint is preserved. Search accepts the new names and original source aliases.

Twelve existing Natural Earth city points are reused, with Lhasa marked as the fictional national capital. Three named peaks—Shishapangma, Namcha Barwa and Mount Gongga—use verified GeoNames coordinates (CC BY 4.0), with no unsourced height figures. Five existing Natural Earth physical ranges are clipped for the mountain overview. The range polygons are explicitly schematic physical geography, not precise surveyed summit extents; no unsourced peak heights or modern populations are invented. Place/range labels appear at appropriate zoom and share the same Equal Earth projection and camera as all other geometry.

Live SVG and downloadable SVG/PNG/JPG maps share the same overlay descriptors and ownership geometry. Export metadata includes the scenario, model area, source dates, original administrative codes and boundary notes. The protected GIS is delivered in two authenticated responses below the platform response-size limit. `/api/alternate-world?part=tibet` has the same password/session checks as the existing world payload; no public polygon file or new client-side password is introduced.

## Reproduce and validate

```powershell
python -m pip install --target work/world-python geographiclib==2.1
node scripts/prepare-tibet-gis.mjs
npm run data:india-punjab
npm run check:india-punjab
npx tsc --noEmit
npm run build:vercel
npm run preview:vercel -- --host 127.0.0.1 --port 4546 --strictPort
node scripts/verify-tibet-republic.mjs
```

The preparer verifies pinned input hashes and only downloads missing source files. The base generator runs first, then the Tibet generator; regenerating the existing western provinces therefore preserves the Tibet stage. Tests check the exact selected union, WGS84 area, valid geometry, complete three-group coverage, zero new ownership overlaps, unchanged neighbouring borders, China/Tibet land conservation, protected API sections, search/selection, palettes, saved presentation settings, toggles, exports and mobile layout. Source-world counts remain 218 country/context outlines and 3,202 provinces. This alternate snapshot has 217 country/context outlines and 3,218 first-level units.

Primary references:

- [Pinned cn-atlas / CTAmap GIS](https://github.com/BarbarossaWang/cn-atlas/tree/6e83a19923e39f2c0e58a0a7ad29b349b2a71b9f).
- [geoBoundaries China county-level metadata and source license](https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM2/).
- [The Cultural Regions in Tibet, Tibetan and Himalayan Library / University of Virginia](https://texts.mandala.library.virginia.edu/text/cultural-regions-tibet).
- [World Bank source discussing whole modern prefecture groupings](https://documents1.worldbank.org/curated/en/627191468015282740/pdf/multi0page.pdf).
- [Natural Earth public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/).
