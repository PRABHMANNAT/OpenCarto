import fs from 'node:fs/promises';
const file = 'scripts/punjab-district-references.json';
const references = JSON.parse(await fs.readFile(file, 'utf8'));
const clean = (s) =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
async function photoQuery(params) {
  await new Promise((r) => setTimeout(r, 8000));
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  u.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|timestamp',
    iiurlwidth: '960',
    ...params,
  });
  const response = await fetch(u, {
    signal: AbortSignal.timeout(60000),
    headers: {
      'User-Agent': 'OpenCarto/1.0 reviewed district photo references',
    },
  });
  if (!response.ok) throw Error(response.status + ' photo source');
  const data = await response.json();
  return Object.values(data.query?.pages || {})
    .flatMap((page) => {
      const info = page.imageinfo?.[0],
        meta = info?.extmetadata || {},
        license = clean(meta.LicenseShortName?.value);
      if (
        !info?.thumburl ||
        !/\.(jpg|jpeg)$/i.test(page.title) ||
        !/CC BY|CC0|Public domain/.test(license) ||
        /NC|ND/.test(license)
      )
        return [];
      return [
        {
          url: info.thumburl,
          title: page.title.replace('File:', ''),
          caption: page.title.replace('File:', ''),
          author: clean(meta.Artist?.value),
          license,
          licenseUrl: meta.LicenseUrl?.value || info.descriptionurl,
          sourceUrl: info.descriptionurl,
          date: clean(meta.DateTimeOriginal?.value),
          uploaded: info.timestamp,
          retrieved: '2026-10-12',
        },
      ];
    })
    .sort((a, b) => b.uploaded.localeCompare(a.uploaded));
}
for (const [id, query] of Object.entries({
  'punjab-d-taxila':
    'intitle:Taxila Pakistan filetype:bitmap -portrait -coin -map',
  'punjab-d-sahiwal':
    'intitle:Harappa Pakistan filetype:bitmap -portrait -coin -map',
  'punjab-d-mansa': 'intitle:Mansa Punjab filetype:bitmap -portrait -map -Musa',
  'punjab-d-patiala':
    'intitle:Patiala filetype:bitmap -portrait -map -Workshop -Wikisource -ceremony -peafowl -Maharaja -bird',
  'punjab-d-shahid-bhagat-singh-nagar':
    'intitle:Nawanshahr filetype:bitmap -portrait -map',
})) {
  if (references[id].photoQuery === query) continue;
  references[id].candidates = await photoQuery({
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '30',
  });
  references[id].photoQuery = query;
}
const narowal = references['punjab-d-narowal'];
const sbs = references['punjab-d-shahid-bhagat-singh-nagar'];
if (sbs.photos.length < 3) {
  const extra = await photoQuery({
    titles:
      'File:Bus Terminal Nawashahr Punjab.jpg|File:Historical photograph of Gurdwara Charan Kanwal in Banga, Nawanshahr district, Punjab.jpg',
  });
  sbs.candidates = [...sbs.photos, ...extra];
}
if (narowal.photos.length < 3) {
  const additional = await photoQuery({
    titles:
      'File:Narrowal railway station.jpg|File:Narrowal railway station3.jpg|File:Narowal, Pakistan - panoramio.jpg',
  });
  narowal.candidates = [...narowal.photos, ...additional];
}
const chosen = {
  'punjab-d-lahore': [
    'Town Hall, Lahore 02.jpg',
    'Fabulous Sunset at Badshahi Mosque Lahore.jpg',
    'Restoration of pavilion at Lahore Fort.jpg',
    'Shalimar Gardens @ Lahore (15004581424).jpg',
  ],
  'punjab-d-jhelum': [
    'River Jhelum at Jhelum City from Old Railway bridge at Jhelum City.jpg',
    'Rohtas Fort (Jhelum, Pakistan) - World Heritage Site.jpeg',
    'Rani Mahal, Rohtas Fort, Jhelum.jpg',
    'Railway Road Jhelum.jpg',
  ],
  'punjab-d-khushab': [
    'Amb Temple in Soon Sakasar Valley Khushab - west side.jpg',
    'Kanhati waterfall, located in Khushab district of Punjab province of Pakistan.jpg',
    'Uchali Lake, Khushab District, Punjab.jpg',
    'Khabeki Lake, Soon Valley, Khushab, Punjab, Pakistan.jpg',
  ],
  'punjab-d-sargodha': [
    'Sargodha junction railway station.jpg',
    'Hockey Stadium Sargodha.jpg',
    'City of Sargodha, Pakistan.jpg',
    'University of Sargodha.jpg',
  ],
  'punjab-d-rupnagar': [
    'Gurudwara Bhatha Sahib, Kotla Nihang, Rupnagar, Punjab, India.jpg',
    'Fort of Kotla Nihang Khan, Rupnagar district,Punjab,India.jpg',
    'Archaeological Museum, Rupnagar, Punjab.jpg',
    'Rupnagar city, Punjab, India.jpg',
  ],
  'punjab-d-ferozepur': [
    'Aerial View Hollanwali, Ferozepur 2024.jpg',
    'Commemorative Plaque at Gurudwara Saragarhi Sahib, Ferozepur.jpg',
    'Statue of Lord Buddha at Serenity Park, Ferozepur Cantt.jpg',
    'View of Sutlej in Ferozepur.jpg',
  ],
  'punjab-d-pathankot': [
    'Dera Swami Jagat Giri Ashram (Satguru Ravidas Maharaj Ji World Peace Temple) Pathankot.jpg',
    'Dhar Kalan, Pathankot view.jpg',
    'View of landscape near Dunera ,Pathankot 03.jpg',
    'Ravi River at Pathankot.jpg',
  ],
};
const reject =
  /paper|conference|poet|ghazal|poster|costume|Le roi|cattle|cow|breed|kenya|lieutenant|cropped;|phone|htc-|Corolla|Chassis|Dr[ .]|Coracias|Bodhisattva|Siddharta|news|banner|logo|montage|collage|portrait|drawing|painting|calendar|collection|Minister|MLA|Dhaka|Bangladesh|Kishengarh|Jalna|stage set|Shed WAP|Dutt|Musharraf|Rizwanullah|Wreck|Gambia|Praia|Karnataka|Zambia|Bahía|Barra Mansa|Haridwar|Meerut|Gurpreet Mansa|girl of village|Tirmazi/i;
for (const [id, p] of Object.entries(references)) {
  const candidates = (p.candidates || p.photos).filter(
    (p) =>
      !(id === 'punjab-d-patiala' && /Bathinda/i.test(p.title)) &&
      !/exam|wild-dog|parrots|Nihal Singh Wala Moga|Prof[ .]|WH McLeod|Subedar|Chambre/i.test(
        p.title,
      ),
  );
  if (chosen[id]) {
    p.photos = chosen[id].map((title) => {
      const photo = candidates.find((p) => p.title === title);
      if (!photo) throw Error('Missing reviewed photo ' + title);
      return photo;
    });
  } else {
    const relevant = candidates.filter(
      (p) =>
        !reject.test(p.title) &&
        !/pigeon|peafowl|pariah dog|Daivaradane|Nairobi|Maharaja|Maharadja|Chambre|Députés|jubilé|Tentes|movies|A593|Sikh man within/i.test(
          p.title,
        ),
    );
    const places = relevant.filter((p) =>
      /temple|gurdwara|gurudwara|mandir|fort|mahal|palace|mosque|lake|dam|river|valley|town|city|college|school|station|road|bazaar|chowk|field|farm|campus|museum|garden|stadium|market|bridge|gate|park|landscape|canal|university|hospital|complex|shrine|church|banyan/i.test(
        p.title,
      ),
    );
    p.photos = (places.length >= 3 ? places : relevant).slice(0, 4);
  }
  p.editorialReview =
    'Photograph titles reviewed for district location and subject relevance; capture dates retained independently of upload dates.';
}
const local = JSON.parse(
  await fs.readFile('app/gurdwara-photo-sources.json', 'utf8'),
).photos;
const known = {
  'punjab-d-kartarpur-ravi': 'gs-kartarpur-sahib',
  'punjab-d-panja-sahib': 'gs-panja-sahib',
  'punjab-d-sialkot': 'gs-beri-sialkot',
  'punjab-d-patiala': 'gs-dukh-nivaran-patiala',
  'punjab-d-amritsar': 'gs-harmandir-sahib',
  'punjab-d-tarn-taran': 'gs-tarn-taran-sahib',
};
for (const [id, site] of Object.entries(known)) {
  if (!references[id]) continue;
  const p = local.find((p) => p.id === site);
  const photo = {
    url: p.file,
    title: p.title,
    caption: p.description,
    author: p.author,
    license: p.license,
    licenseUrl: p.licenseUrl,
    sourceUrl: p.sourceUrl,
    date: p.captureDate,
    retrieved: p.checkedOn,
  };
  references[id].photos = [
    photo,
    ...references[id].photos.filter((i) => i.sourceUrl !== photo.sourceUrl),
  ].slice(0, 4);
}
await fs.writeFile(file, JSON.stringify(references, null, 2));
console.log('Galleries reviewed:', Object.keys(references).length);
console.log(
  'Galleries requiring additional photographs:',
  Object.entries(references)
    .filter(([, p]) => p.photos.length < 3)
    .map(([id, p]) => [id, p.photos.length]),
);
