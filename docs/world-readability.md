# World readability and label repair

This update fixes crowded black coastline speckles, damaged source names, and the overly saturated generated country palette in the source and alternate world editions.

## Outlines

`worldBorderPath` in `app/world-equal-earth.ts` streams original WGS84 geometry through the same Equal Earth projection used by fills and hit targets. It generalizes the projected outline to about half a display pixel and omits secondary ring outlines smaller than 16 display pixels squared. Every country retains its largest outline. Finer island and coastline outlines return automatically as their projected size increases with zoom.

This changes the display stroke only. Complete land fills, holes, islands, geographic coordinates, administrative ownership, area calculations and selection targets remain unchanged. Outline caches use bounded half-octave scale buckets. SVG export regenerates its outlines at the output scale, retaining more detail when exporting larger maps. Default international borders remain black, with a lighter weight; province borders remain gray.

## Names

177 world records were repaired: 152 contained literal question marks from the source DBF's lost characters, 24 contained UTF-8 text decoded as Latin-1, and one had trailing control whitespace. No blind question-mark-to-letter replacement is used.

`app/world-name-corrections.json` records every original name, repaired name, method and reference. Unicode name variants in the already downloaded [Natural Earth ADM1 dataset](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/) were matched within the same country. Ambiguous spellings were reviewed individually; supplemental references include [Augšdaugavas municipality](https://www.augsdaugavasnovads.lv/lv/novads) and [Côn Đảo tourism](https://www.condao.com.vn/vi/about.html). This is a spelling repair to the existing source edition, not an update to current administrative boundaries.

The original labels remain in `originalName` for provenance and search compatibility. Corrected labels are synchronized across the area registry, polygon properties, label-point layers and alternate-world metadata. The label repair script records and verifies identical geometry/ID hashes before and after the edit. Source-file checksums are updated to match corrected properties.

## Palettes

Default political, Muted, Pastel, Marine, Royal, Modern and Earth tones now use curated, coordinated colors. A country-neighbor graph selects contrasting base colors for adjacent countries; restrained tonal variants give countries distinct hex colors within a common visual palette. White, gray and white-and-gray modes remain available.

[MapChart's world-map themes and color controls](https://www.mapchart.net/world.html) were used as a workflow reference. These are original coordinated palettes; map assets and proprietary theme code were not copied. Saved version-1 generated rainbow Default/Pastel fills migrate to version 2. Manual edits and the original saved-color backup are retained.

## Validation and reproduction

```powershell
npm run data:world-names
npm run check:world-readability
npm run check:world-style
npm run check:world-map
node scripts/check-equal-earth.mjs
npx tsc --noEmit
npm run build:vercel
npm run preview:vercel -- --host 127.0.0.1 --port 4546 --strictPort
npm run check:world-readability-browser
```

The original CGAZ importer also applies the correction manifest. `scripts/build-world-country-neighbors.py` regenerates neighbor constraints from existing country geometries using a small source-resolution tolerance; these constraints influence colors only.

Checks cover coordinate preservation, all repaired names, search, synchronized labels, outline decluttering and detail return, unique coordinated colors, migration without losing manual edits, unchanged Equal Earth area ratios, exported labels/outlines, alternate-world access and mobile layout. Screenshots are written to ignored `outputs/world-readability/`.
