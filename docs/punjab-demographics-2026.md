# Fictional Alternate-History Demographic Scenario — 2026

Model version: `punjab-fictional-demographics-2026-v1`. This replaces the earlier active fictional population models. It is worldbuilding, not a census or a projection of actual religious populations. Heritage informs editorial settlement assumptions, never the observed religion of present-day residents.

The existing 48 districts, 193 mapped tehsils, 12 divisions and six historical regions retain their identifiers, boundaries, membership, capitals and original-name search aliases. Amb remains an independent Union Territory and is excluded from every Punjab total. Pothohar is displayed as **Pothohar–Gandhara**, with its original region identifier, members, color and search alias preserved.

## Locked provincial totals

| Community | Residents, Indian notation | Calculated share |
|---|---:|---:|
| Sikh | 4,98,05,065 | 73.7454589% |
| Hindu | 1,48,58,019 | 22.0000000% |
| Muslim | 27,00,000 | 3.9978412% |
| Buddhist | 45,000 | 0.0666307% |
| Christian | 52,000 | 0.0769955% |
| Others / Jain / not stated | 76,366 | 0.1130738% |
| **Total** | **6,75,36,450** | **100%** |

The integer counts in `app/punjab-demographic-scenario.json` are the inputs. Displayed percentages are derived, never inputs. The Hindu equality is checked as `Hindu × 100 = total × 22`, avoiding percentage-rounding ambiguity. Urban population is exactly **2,70,14,580 (40%)** and rural population **4,05,21,870 (60%)**.

## Reproducible allocation

`scripts/punjab-2026-model.mjs` defines all 48 district settlement bases and eight development archetypes: metropolis, industrial, agricultural, riverine, corridor, foothill, dryland and mountain. Each tehsil receives the following capacity score:

`district settlement base / mapped tehsil count × town centrality × mean(agriculture, industry, corridor connectivity, water) × terrain accessibility`

Scores become positive integer millionths. These comparative development ratings are explicit fictional assumptions, not measured infrastructure, agricultural yields, road lengths or economic indicators. Existing canonical names identify urban cores and heritage priorities. Area is used for density only; it does not allocate residents. The published model-assumptions JSON records every tehsil's inputs and religious priors.

Mountain constraints reduce Balakot and Murree capacity substantially, with lower settlement intensity in Haro and Sherwan. Abbottabad and Haripur retain urban-hub assumptions. Metropolitan, industrial, irrigated agricultural and riverine settings use distinct attraction and urbanization assumptions. This is an auditable scenario rather than a claimed empirical forecast.

1. Sum tehsil capacities into district and division capacities. Allocate the locked provincial total through province → division → district → tehsil using integer largest remainders. Products and remainders use `BigInt`; canonical identifiers break ties deterministically.
2. Form a 193-by-six religious-prior matrix. Sikh pilgrimage centres, Hindu urban/commercial traditions, Muslim Sufi and urban heritage, Buddhist centres and smaller Christian/other communities receive the requested fictional priors.
3. Fit that matrix to both the integer tehsil totals and locked six provincial religious totals using iterative proportional fitting. Deterministic minimum-cost integer rounding preserves both margins exactly. The existing numerical solver is reused; previous population totals and allocations are not model inputs.
4. Fit a separate bounded urban/rural matrix to each tehsil's settlement-type odds and exactly 40% provincial urbanization. Apportion each tehsil's urban residents within its religious inventory; rural counts are complements. No community can exceed its local inventory.
5. Aggregate the same integer tehsil records into districts, divisions, historical regions and province. Historical regions receive no independent allocation. Percentages and WGS84-area densities are derived after aggregation.

Every unit has positive total population and six nonnegative integer religious counts, each partitioned into urban/rural counts. These margins reconcile independently across all four administrative aggregation levels. Every regenerated run with the same registry and model version produces identical output.

## Heritage outcomes and city estimates

The five highest district Sikh shares are Tarn Taran, Kartarpur Sahib, Sri Anandpur Sahib, Panja Sahib and Amritsar. Tarn Taran (95.4974%) and Kartarpur Sahib (95.1742%) slightly exceed the suggested approximate 95% range after balancing. Those suggestions were soft targets; the exact provincial margins take precedence. Anandpur Sahib (96.7855%) and Talwandi Sabo (96.7699%) are the two highest Sikh-percentage tehsils.

Hindu communities include fictional majority tehsils as well as mixed districts. Muslim communities remain distributed across regions, with specific Malerkotla, Kasur and Ajodhan priors. Taxila, Ranigat, Mansehra and Pakhli receive elevated Buddhist priors. No shrine is treated as evidence of actual residents' religion.

Lahore **District** contains **91,77,108** residents, including **65,88,394 Sikhs (71.7916%)**. A separately identified illustrative Lahore **city** has **45,00,000** residents, including **32,30,624 Sikhs**, as a subset of its named core tehsils' urban inventories. It is the largest city estimate and has the highest absolute Sikh population among the eight explicitly defined city estimates. The city estimates do not create administrative units or add to any population aggregate.

City estimates use bounded urban inventories from disjoint core tehsil groups, with separate parent district IDs and existing source point coordinates where available. A city marker or parent-district zoom is not a city boundary. The model caps other illustrative estimates to their available core urban inventory. Lahore's universities, technology, healthcare, infrastructure, commerce, tourism and Islamic/Sikh/Hindu architectural heritage are fictional development assumptions, not measured indicators. City ranking claims apply to this explicit illustrative set, not to a complete real-world city census.

## Current historical-region totals

| Region | Districts | Residents | Urban share |
|---|---:|---:|---:|
| Majha | 13 | 2,61,01,832 | 49.12% |
| Malwa | 10 | 1,18,94,038 | 33.14% |
| Doaba | 4 | 37,10,489 | 31.19% |
| Puadh | 4 | 24,40,248 | 53.34% |
| Bar | 9 | 1,58,61,420 | 31.32% |
| Pothohar–Gandhara | 8 | 75,28,423 | 37.52% |

## Application and data integration

The existing encrypted atlas payload remains the serving database. Canonical feature properties store `hypotheticalDemographics`, `hypotheticalPopulation` and compatible density fields; real census fields remain distinct. Original source statistics and older scenario records are preserved in history. Existing district, tehsil, division and region API responses, profiles, rankings, hover panels and exports read these updated properties. `GET /api/private-atlas?action=demographics` exposes a derived index of those same canonical records, model metadata and city estimates. It is not a second independently allocated database.

**Demographics 2026** opens the composition dashboard. Select a community to inspect its exact count/share. Rank all districts, tehsils, divisions or regions by population, density, community count/share or urbanization, with search and ascending/descending sorting. The separate city scope distinguishes illustrative city residents from district totals. Selecting a unit shows its full composition and offers the existing map zoom/selection flow. CSV downloads preserve raw integer counts and derived percentages.

The **Population layer** control supplies 13 choropleths: total population; density; Sikh count/share; Hindu count/share; Muslim count/share; Buddhist share; Christian share; other share; urbanization; and largest community. Numeric layers use five quantile classes of the currently visible compatible Punjab units, with legend cuts and units; categorical colors identify the leading community. Rounded legend labels are marked as such. Hover cards show exact counts, shares and urban/rural values. Amb and other provinces retain their existing rendering and data. **Administrative colors** restores the established palette and saved fill overrides. Dashboard controls, legends, tables and chart remain accessible on mobile.

## Tables, regeneration and verification

Committed tables are in [reports/punjab-demographics-2026](../reports/punjab-demographics-2026): `district.csv` (48), `tehsil.csv` (193), `division.csv` (12), `region.csv` (6), and the separate `city.csv` (8). `province.json` stores exact provincial values and `model-assumptions.json` stores the version, locked inputs, district/archetype parameters and every tehsil's assumptions. CSV religion columns include both counts and percentages; urban/rural totals and density are included.

Run from the repository root:

```sh
npm run data:punjab-demographics
npm run build:vercel
npm run preview:vercel -- --port 4545 --strictPort --host 127.0.0.1
npm run check:punjab-demographics
npm run check:punjab-demographics-browser
npm run check:punjab-final-divisions-browser
npm run check:punjab-historical-regions-browser
```

The data command measures existing tehsil polygons with GeographicLib, generates and applies the model, writes tables and repacks the existing encrypted payload. Restart the server after repacking because it caches the decrypted atlas. The project-local Python geometry runtime and existing server key are required; no secrets enter client code or exports. The full United Punjab and historical-region regeneration commands finish with this scenario step. The archived district-profile/population builder rejects current demographic payloads to avoid restoring obsolete totals.

Independent validation compares every geometry and administrative relationship with the preserved pre-scenario snapshot, including unchanged Amb and unrelated geography; checks polygon validity, row/column margins, exact Hindu equality, all four aggregation levels, density and measured area, urban/rural inventories, city bounds, top heritage priorities and exported tables. API checks reproduce the model twice, prove old population values do not affect it, inspect all 13 classifications and test canonical aliases. Browser checks exercise composition, ranking scopes, map layers, hover statistics, region/division/tehsil selection, downloads and responsive layouts. Prior boundary-source limitations remain documented in the geographic edition; this demographic update introduces no polygon repair or boundary claim.
