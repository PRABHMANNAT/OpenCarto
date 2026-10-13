import fs from 'node:fs/promises';
import {
  allocatePunjabPopulation,
  easternDistricts as east,
  populationNote as note,
  religionTotals as totals,
} from './punjab-population-model.mjs';
const file = 'private/united-atlas/atlas.json';
const atlas = JSON.parse(await fs.readFile(file, 'utf8'));
const districts = atlas.details.punjab.district.features;
const allocations = allocatePunjabPopulation(
  districts.map((district) => district.properties),
);
districts.forEach(
  (district, index) =>
    (district.properties.hypotheticalDemographics = allocations[index]),
);
const ranked = [...districts].sort(
  (a, b) =>
    b.properties.hypotheticalDemographics.total -
    a.properties.hypotheticalDemographics.total,
);
const cachePath = 'scripts/punjab-district-references.json';
let cache = {};
try {
  cache = JSON.parse(await fs.readFile(cachePath, 'utf8'));
} catch {}
const clean = (s) =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
async function api(url, params) {
  const u = new URL(url);
  u.search = new URLSearchParams(params);
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 6500));
    const r = await fetch(u, {
      signal: AbortSignal.timeout(60000),
      headers: { 'User-Agent': 'OpenCarto/1.0 district profile research' },
    });
    if (r.status === 429 || r.status === 503) {
      console.log('Source rate limit; retrying after 45 seconds');
      await new Promise((r) => setTimeout(r, 45000));
      continue;
    }
    if (!r.ok) throw Error(r.status + ' ' + u);
    return r.json();
  }
  throw Error('Source rate limit persisted ' + u);
}
const overrides = {
  'Panja Sahib': 'Attock District',
  Taxila: 'Taxila',
  Katas: 'Katas Raj Temples',
  'Kartarpur Sahib': 'Kartarpur, Pakistan',
  'Sri Anandpur Sahib': 'Anandpur Sahib',
  Harappa: 'Sahiwal District',
  'S A S Nagar': 'Mohali district',
};
const articleFor = (p) =>
  overrides[p.name] ||
  p.sourceName + (east.has(p.name) ? ' district' : ' District');
const wikiPages = new Map();
const missing = districts.filter((d) => !cache[d.properties.id]);
for (let offset = 0; offset < missing.length; offset += 20) {
  const titles = [
    ...new Set(
      missing.slice(offset, offset + 20).map((d) => articleFor(d.properties)),
    ),
  ];
  const data = await api('https://en.wikipedia.org/w/api.php', {
    action: 'query',
    format: 'json',
    redirects: '1',
    titles: titles.join('|'),
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exlimit: 'max',
  });
  for (const title of titles) {
    let resolved = title;
    for (let step = 0; step < 5; step++) {
      const redirect = [
        ...(data.query?.normalized || []),
        ...(data.query?.redirects || []),
      ].find((r) => r.from === resolved);
      if (!redirect) break;
      resolved = redirect.to;
    }
    wikiPages.set(
      title,
      Object.values(data.query?.pages || {}).find((p) => p.title === resolved),
    );
  }
}
for (const d of districts) {
  const p = d.properties;
  if (!cache[p.id]) {
    const article =
      overrides[p.name] ||
      p.sourceName + (east.has(p.name) ? ' district' : ' District');
    try {
      const page = wikiPages.get(article);
      if (!page || page.missing !== undefined)
        throw Error('Wikipedia article not found: ' + article);
      const images = await api('https://commons.wikimedia.org/w/api.php', {
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch:
          'intitle:"' +
          (p.name === 'Taxila'
            ? 'Taxila'
            : p.name === 'Harappa'
              ? 'Harappa'
              : p.name === 'Katas'
                ? 'Katas'
                : p.name === 'Kartarpur Sahib'
                  ? 'Kartarpur'
                  : p.name === 'Sri Anandpur Sahib'
                    ? 'Anandpur Sahib'
                    : p.name === 'S A S Nagar'
                      ? 'Mohali'
                      : p.sourceName) +
          '" ' +
          (['Dinga', 'Katas', 'Haripur'].includes(p.name) ? 'Pakistan' : '') +
          ' filetype:bitmap -map -portrait -coin -book -drawing -dress -karate',
        gsrnamespace: '6',
        gsrlimit: '30',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|timestamp',
        iiurlwidth: '960',
      });
      const candidates = Object.values(images.query?.pages || {})
        .flatMap((pg) => {
          const i = pg.imageinfo?.[0],
            m = i?.extmetadata || {},
            license = clean(m.LicenseShortName?.value);
          if (
            !i?.thumburl ||
            !/\.(jpg|jpeg)$/i.test(pg.title) ||
            !/CC BY|CC0|Public domain/.test(license) ||
            /NC|ND/.test(license) ||
            /deputy|commissioner|mayor|president|welcoming|coin|scythian|collage|calendar|kalender|collection|montage|banknote|stamp|bird|nest|drawing|painting|book|karate|traditional dress|Dr[ .]|Corolla|Chassis|Coracias|Bodhisattva|Siddharta|news|گھونسلہ/i.test(
              pg.title,
            )
          )
            return [];
          return [
            {
              url: i.thumburl,
              title: pg.title.replace('File:', ''),
              caption:
                clean(m.ObjectName?.value) || pg.title.replace('File:', ''),
              author: clean(m.Artist?.value),
              license,
              licenseUrl: m.LicenseUrl?.value || i.descriptionurl,
              sourceUrl: i.descriptionurl,
              date: clean(m.DateTimeOriginal?.value),
              uploaded: i.timestamp,
              retrieved: '2026-10-12',
            },
          ];
        })
        .sort((a, b) => b.uploaded.localeCompare(a.uploaded));
      const photos = candidates.slice(0, 4);
      cache[p.id] = {
        wikiUrl:
          'https://en.wikipedia.org/wiki/' +
          encodeURIComponent(page.title.replaceAll(' ', '_')),
        summary: clean(page.extract)
          .split(/(?<=[.!?])\s+/)
          .filter(
            (s) =>
              !/population|census|percent|%|majority|predominantly|religious composition/i.test(
                s,
              ),
          )
          .slice(0, 4)
          .join(' ')
          .slice(0, 1000),
        photos,
        candidates,
        retrieved: '2026-10-12',
      };
      await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
      console.log(p.name, photos.length + ' photographs');
    } catch (e) {
      console.error(p.name, e.message);
      throw e;
    }
  }
  const centres = atlas.details.punjab.tehsil.features
    // Source ids are kept in the research data; the profile lists proposed names.
    .filter(
      (t) =>
        t.properties.parentDistrictId === p.id ||
        t.properties.district === p.name,
    )
    .map((t) => t.properties.name);
  delete p.candidates;
  Object.assign(
    p,
    Object.fromEntries(
      Object.entries(cache[p.id]).filter(([key]) => key !== 'candidates'),
    ),
    {
      populationRank: ranked.indexOf(d) + 1,
      scenarioZone: east.has(p.name) ? 'Eastern Punjab' : 'Western Punjab',
      keyCities: [...new Set([p.capital, ...centres.slice(0, 4)])],
      density: Math.round(p.hypotheticalDemographics.total / p.areaKm2),
    },
  );
}
const province = atlas.overview.provinces.find((p) => p.id === 'punjab');
province.hypotheticalDemographics = {
  total: 79600000,
  religions: totals.map(([name, population]) => ({ name, population })),
  note,
};
for (const d of atlas.details.punjab.division.features) {
  const members = districts.filter(
    (f) => f.properties.division === d.properties.name,
  );
  d.properties.hypotheticalDemographics = {
    total: members.reduce(
      (n, f) => n + f.properties.hypotheticalDemographics.total,
      0,
    ),
    religions: totals.map(([name]) => ({
      name,
      population: members.reduce(
        (n, f) =>
          n +
          f.properties.hypotheticalDemographics.religions.find(
            (r) => r.name === name,
          ).population,
        0,
      ),
    })),
    note,
  };
}
await fs.writeFile(file, JSON.stringify(atlas));
console.log(
  '49 district scenarios total',
  districts.reduce(
    (n, d) => n + d.properties.hypotheticalDemographics.total,
    0,
  ),
);
