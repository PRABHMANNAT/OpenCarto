// Pass the initial password on stdin. It is never included in source or output.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { gzipSync } from 'node:zlib';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const envPath = new URL('../.env.local', import.meta.url);
let env = '';
try {
  env = await fs.readFile(envPath, 'utf8');
} catch {}
if (!process.env.PRIVATE_ATLAS_PASSWORD_HASH) {
  let password = '';
  for await (const chunk of process.stdin) password += chunk;
  password = password.trim();
  if (!password || password.length > 128)
    throw Error('Provide an initial password through stdin.');
  const salt = randomBytes(32),
    hash = scryptSync(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
  process.env.PRIVATE_ATLAS_PASSWORD_HASH = [
    'scrypt',
    32768,
    8,
    1,
    salt.toString('hex'),
    hash.toString('hex'),
  ].join('$');
}
for (const key of ['PRIVATE_ATLAS_SESSION_SECRET', 'PRIVATE_ATLAS_DATA_KEY'])
  process.env[key] ||= randomBytes(32).toString('hex');
for (const key of [
  'PRIVATE_ATLAS_PASSWORD_HASH',
  'PRIVATE_ATLAS_SESSION_SECRET',
  'PRIVATE_ATLAS_DATA_KEY',
]) {
  const line = key + '=' + process.env[key];
  const re = new RegExp('^' + key + '=.*$', 'm');
  env = re.test(env)
    ? env.replace(re, line)
    : env.trimEnd() + '\n' + line + '\n';
}
await fs.writeFile(envPath, env);
if (process.argv.includes('--configure-only')) {
  console.log(
    'Private atlas server credentials configured in ignored .env.local.',
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
  if (p.population !== null)
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
