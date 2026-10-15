// Keep the atlas encryption key on the server; map access does not require a password.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createCipheriv, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const envPath = new URL('../.env.local', import.meta.url);
let env = '';
try {
  env = await fs.readFile(envPath, 'utf8');
} catch {}
process.env.PRIVATE_ATLAS_DATA_KEY ||= randomBytes(32).toString('hex');
for (const key of ['PRIVATE_ATLAS_DATA_KEY']) {
  const line = key + '=' + process.env[key];
  const re = new RegExp('^' + key + '=.*$', 'm');
  env = re.test(env)
    ? env.replace(re, line)
    : env.trimEnd() + '\n' + line + '\n';
}
await fs.writeFile(envPath, env);
if (process.argv.includes('--configure-only')) {
  console.log(
    'Private atlas server data key configured in ignored .env.local.',
  );
  process.exit(0);
}
const file = new URL('../private/united-atlas/atlas.json', import.meta.url),
  payload = JSON.parse(await fs.readFile(file, 'utf8'));
const photos = JSON.parse(
  await fs.readFile(
    new URL('../private/united-atlas/photos.json', import.meta.url),
    'utf8',
  ),
);
for (const p of payload.overview.provinces) p.photos = photos[p.id] || [];
const areas = JSON.parse(
  await fs.readFile(
    new URL('../private/united-atlas/areas.json', import.meta.url),
    'utf8',
  ),
);
for (const p of payload.overview.provinces) {
  p.areaKm2 = areas[p.id];
  if (p.hypotheticalPopulation) {
    if (!Number.isSafeInteger(p.hypotheticalPopulation.total) || p.hypotheticalPopulation.total <= 0)
      throw Error('Invalid fictional population for ' + p.id);
    p.density = Math.round((p.hypotheticalPopulation.total / p.areaKm2) * 10) / 10;
  } else if (p.population !== null)
    p.density = Math.round((p.population / p.areaKm2) * 10) / 10;
  if (p.hypotheticalDemographics) {
    const religions = p.hypotheticalDemographics.religions;
    if (
      !religions.length ||
      religions.some(
        (r) => !Number.isSafeInteger(r.population) || r.population < 0,
      )
    )
      throw Error('Invalid hypothetical population values for ' + p.id);
    const total = religions.reduce((sum, r) => sum + r.population, 0);
    if (!Number.isSafeInteger(total) || total <= 0)
      throw Error('Invalid hypothetical population total for ' + p.id);
    p.hypotheticalDemographics.total = total;
  }
}
const activePopulationTotal = payload.demographics?.province.hypotheticalDemographics.total || 70000000;
if (payload.divisionFinalization) {
  const districts = payload.details.punjab.district.features;
  const divisions = payload.details.punjab.division.features;
  for (const collection of [districts, divisions]) {
    if (collection.some(f => !Number.isSafeInteger(f.properties.hypotheticalPopulation?.total) || f.properties.hypotheticalPopulation.total <= 0) ||
        collection.reduce((total, f) => total + f.properties.hypotheticalPopulation.total, 0) !== activePopulationTotal)
      throw Error('Punjab district/division population does not reconcile to the current scenario.');
  }
}
if (payload.historicalRegions) {
  const regions = payload.details.punjab.region.features;
  const members = regions.flatMap(f => f.properties.memberDistrictIds);
  if (regions.length !== 6 || members.length !== 48 || new Set(members).size !== 48 ||
      regions.reduce((sum, f) => sum + f.properties.hypotheticalPopulation.total, 0) !== activePopulationTotal ||
      payload.details.punjab.district.features.some(f => !members.includes(f.properties.id)))
    throw Error('Historical regions must cover exactly 48 districts with the current scenario aggregate.');
}
if (payload.demographics) {
  const locked=JSON.parse(await fs.readFile('app/punjab-demographic-scenario.json','utf8'));
  for(const level of ['district','tehsil','division','region']) {
    const features=payload.details.punjab[level].features;
    if(features.reduce((sum,f)=>sum+f.properties.hypotheticalDemographics.total,0)!==locked.total)throw Error('Invalid 2026 '+level+' total');
    for(const religion of locked.religions)if(features.reduce((sum,f)=>sum+f.properties.hypotheticalDemographics.religions.find(r=>r.key===religion.key).population,0)!==religion.population)throw Error('Invalid 2026 '+level+' '+religion.key+' margin');
  }
}
// Keep full independent source geometry in private/; serve its precise display
// derivative. Avoid decrypting unused, duplicated source geometry into memory.
delete payload.exactGeometry;
payload.analysis.audit.overviewToleranceDegrees = 0.002;
payload.analysis.audit.renderingMethod =
  payload.analysis.audit.renderingMethod.replace(
    'Overview simplification at 0.001 degrees',
    'Overview simplification at 0.002 degrees',
  );
const iv = randomBytes(12),
  cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.PRIVATE_ATLAS_DATA_KEY, 'hex'),
    iv,
  );
const encrypted = Buffer.concat([
  cipher.update(gzipSync(Buffer.from(JSON.stringify(payload)))),
  cipher.final(),
]);
await fs.mkdir(new URL('../server/', import.meta.url), { recursive: true });
await fs.writeFile(
  new URL('../server/private-atlas.enc', import.meta.url),
  Buffer.concat([Buffer.from('UAT1'), iv, cipher.getAuthTag(), encrypted]),
);
console.log(
  'Private atlas encrypted. Server credentials stored only in ignored .env.local.',
);
