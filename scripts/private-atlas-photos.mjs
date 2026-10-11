// Source metadata is private; photograph rights remain those of their authors.
import fs from 'node:fs/promises';
const root = new URL('../', import.meta.url),
  path = new URL('private/united-atlas/photos.json', root);
const profiles = JSON.parse(
  await fs.readFile(
    new URL('private/united-atlas/profiles.json', root),
    'utf8',
  ),
);
const queries = {
  punjab: 'Lahore Fort',
  multan: 'Shah Rukn e Alam tomb',
  bahawalpur: 'Noor Mahal Bahawalpur',
  kp: 'Takht i Bahi',
  'jammu-kashmir': 'Hazratbal shrine',
  ladakh: 'Thiksey monastery',
  islamabad: 'Faisal Mosque',
  sindh: 'Mohenjo daro',
  balochistan: 'Hingol National Park',
  'gilgit-baltistan': 'Baltit Fort',
  chandigarh: 'Chandigarh Capitol Complex',
  'in-haryana': 'Brahma Sarovar Kurukshetra',
  'in-himachal': 'Shimla Ridge',
  'in-andhra': 'Lepakshi temple',
  'in-rajasthan': 'Hawa Mahal Jaipur',
  'in-uttar-pradesh': 'Taj Mahal',
  'in-uttarakhand': 'Badrinath temple',
  'in-arunachal': 'Tawang Monastery',
  'in-assam': 'Kamakhya temple',
  'in-bihar': 'Mahabodhi Temple Bodh Gaya',
  'in-chhattisgarh': 'Sirpur Lakshmana temple',
  'in-goa': 'Basilica Bom Jesus Goa',
  'in-gujarat': 'Rani ki vav',
  'in-jharkhand': 'Baidyanath temple Deoghar',
  'in-karnataka': 'Hampi stone chariot',
  'in-kerala': 'Kerala backwaters',
  'in-madhya-pradesh': 'Sanchi stupa',
  'in-maharashtra': 'Ellora Kailasa temple',
  'in-manipur': 'Kangla Imphal',
  'in-meghalaya': 'Living root bridge Meghalaya',
  'in-mizoram': 'Aizawl panorama',
  'in-nagaland': 'Kohima cathedral',
  'in-odisha': 'Konark Sun Temple',
  'in-sikkim': 'Rumtek Monastery',
  'in-tamil-nadu': 'Brihadisvara temple Thanjavur',
  'in-telangana': 'Charminar Hyderabad',
  'in-tripura': 'Ujjayanta Palace',
  'in-west-bengal': 'Victoria Memorial Kolkata',
  'in-andaman-nicobar': 'Cellular Jail Port Blair',
  'in-dnh-dd': 'Diu Fort',
  'in-delhi': 'Humayun tomb Delhi',
  'in-lakshadweep': 'Kavaratti lagoon',
  'in-puducherry': 'Puducherry French quarter',
};
const clean = (s) =>
  String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, '')
    .trim();
let photos = {};
try {
  photos = JSON.parse(await fs.readFile(path, 'utf8'));
} catch {}
// Preserve the reviewed multi-image galleries when regenerating photo metadata.
try {
  Object.assign(
    photos,
    JSON.parse(
      await fs.readFile(
        new URL('private/united-atlas/curated-photos.json', root),
        'utf8',
      ),
    ),
  );
  await fs.writeFile(path, JSON.stringify(photos, null, 2));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
async function find(id) {
  if (photos[id]) return;
  const query = queries[id];
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: query + ' filetype:bitmap',
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '800',
  }).toString();
  const res = await fetch(url, {
    signal: AbortSignal.timeout(45000),
    headers: {
      'User-Agent':
        'OpenCarto private atlas research (local editorial project)',
    },
  });
  if (!res.ok) throw Error(res.status + ' ' + id);
  const data = await res.json();
  const candidates = Object.values(data.query?.pages || {}).sort(
    (a, b) => a.index - b.index,
  );
  for (const page of candidates) {
    const info = page.imageinfo?.[0],
      meta = info?.extmetadata || {};
    const license = clean(meta.LicenseShortName?.value);
    if (
      !info?.thumburl ||
      !/CC BY|Public domain|CC0/.test(license) ||
      /NC|ND/.test(license) ||
      !/\.(jpg|jpeg|png)$/i.test(page.title)
    )
      continue;
    photos[id] = [
      {
        url: info.thumburl,
        originalUrl: info.url,
        sourceUrl: info.descriptionurl,
        title: page.title.replace(/^File:/, ''),
        author: clean(meta.Artist?.value),
        license,
        licenseUrl: meta.LicenseUrl?.value || info.descriptionurl,
        description: clean(meta.ImageDescription?.value).slice(0, 500),
        query,
        changes: 'Thumbnail displayed with responsive cropping.',
        retrieved: '2026-10-11',
      },
    ];
    break;
  }
  if (!photos[id]) throw Error('No reusable photograph for ' + id);
  await fs.writeFile(path, JSON.stringify(photos, null, 2));
  console.log(id, photos[id][0].title, photos[id][0].license);
}
// Requests run in small batches. Inspect every failure; keep successful metadata.
for (const p of profiles) {
  if (photos[p.id]) continue;
  try {
    await find(p.id);
  } catch (error) {
    console.error(error.message);
    if (/429/.test(error.message)) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 6500));
}
console.log(
  'Profiles with licensed photo metadata:',
  Object.keys(photos).length,
);
