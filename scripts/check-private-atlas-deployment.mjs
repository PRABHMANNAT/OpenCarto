import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = await fs.mkdtemp(join(tmpdir(), 'atlas-deployment-'));
const originalCwd = process.cwd();
const originalKey = process.env.PRIVATE_ATLAS_DATA_KEY;
try {
  await fs.mkdir(join(root, 'api'));
  await fs.mkdir(join(root, 'server'));
  await fs.copyFile(
    new URL('../server/private-atlas.mjs', import.meta.url),
    join(root, 'api/private-atlas.mjs'),
  );
  await fs.copyFile(new URL('../server/atlas-store.mjs',import.meta.url),join(root,'api/atlas-store.mjs'));
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const overview = { provinces: [{ id: 'punjab', name: 'Punjab' }] };
  const encrypted = Buffer.concat([
    cipher.update(gzipSync(Buffer.from(JSON.stringify({ overview })))),
    cipher.final(),
  ]);
  await fs.writeFile(
    join(root, 'server/private-atlas.enc'),
    Buffer.concat([Buffer.from('UAT1'), iv, cipher.getAuthTag(), encrypted]),
  );
  process.chdir(root);
  process.env.PRIVATE_ATLAS_DATA_KEY = key.toString('hex');
  const { privateAtlasHandler } = await import(
    pathToFileURL(join(root, 'api/private-atlas.mjs'))
  );
  const invoke = async () => {
    const res = {
      setHeader() {},
      end(body) { this.body = JSON.parse(body); },
    };
    await privateAtlasHandler(
      { method: 'GET', url: '/api/private-atlas?action=overview', headers: {} },
      res,
    );
    return res;
  };
  const response = await invoke();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, overview);
  delete process.env.PRIVATE_ATLAS_DATA_KEY;
  const unavailable = await invoke();
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.code, 'ATLAS_CONFIGURATION_MISSING');
  console.log('Verified bundled API reads server dataset and reports missing configuration safely.');
} finally {
  process.chdir(originalCwd);
  if (originalKey === undefined) delete process.env.PRIVATE_ATLAS_DATA_KEY;
  else process.env.PRIVATE_ATLAS_DATA_KEY = originalKey;
  await fs.rm(root, { recursive: true, force: true });
}
