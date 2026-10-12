import { createDecipheriv } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
let payloadPromise;
function settings() {
  const key = process.env.PRIVATE_ATLAS_DATA_KEY;
  if (!key || !/^[0-9a-f]{64}$/i.test(key))
    throw Object.assign(Error('Custom atlas server is not configured'), {
      code: 'ATLAS_CONFIGURATION_MISSING',
    });
  return { key };
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return (
      new URL(origin).host === req.headers.host &&
      (!process.env.PRIVATE_ATLAS_ORIGIN ||
        origin === process.env.PRIVATE_ATLAS_ORIGIN)
    );
  } catch {
    return false;
  }
}
async function payload(key) {
  if (!payloadPromise)
    payloadPromise = readDataset()
      .then((encoded) => {
        if (encoded.subarray(0, 4).toString() !== 'UAT1')
          throw Error('Invalid custom atlas dataset');
        const decipher = createDecipheriv(
          'aes-256-gcm',
          Buffer.from(key, 'hex'),
          encoded.subarray(4, 16),
        );
        decipher.setAuthTag(encoded.subarray(16, 32));
        return JSON.parse(
          gunzipSync(
            Buffer.concat([
              decipher.update(encoded.subarray(32)),
              decipher.final(),
            ]),
          ).toString('utf8'),
        );
      })
      .catch((error) => {
        payloadPromise = null;
        throw error;
      });
  return payloadPromise;
}
async function readDataset() {
  // Vercel bundles the handler into api/, but includeFiles retains server/.
  // The adjacent path remains useful for an unbundled local server.
  try {
    return await readFile(resolve(process.cwd(), 'server/private-atlas.enc'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return readFile(fileURLToPath(new URL('./private-atlas.enc', import.meta.url)));
  }
}
function respond(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}
export async function privateAtlasHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const { key } = settings(),
      url = new URL(req.url, 'http://localhost'),
      action = url.searchParams.get('action') || 'overview';
    if (!sameOrigin(req))
      return respond(res, 403, {
        error: 'This request must come from the map application.',
      });
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return respond(res, 405, { error: 'Method not allowed.' });
    }
    const data = await payload(key);
    if (action === 'overview') return respond(res, 200, data.overview);
    if (action === 'analysis') return respond(res, 200, data.analysis);
    if (action === 'detail') {
      const id = url.searchParams.get('province'),
        level = url.searchParams.get('level');
      if (
        !id ||
        !Object.hasOwn(data.details, id) ||
        !['province', 'division', 'district', 'tehsil'].includes(level)
      )
        return respond(res, 400, {
          error: 'Choose a valid province and detail level.',
        });
      const collection = data.details[id][level] || {
          type: 'FeatureCollection',
          features: [],
        },
        offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isInteger(offset) || offset < 0)
        return respond(res, 400, { error: 'Choose a valid detail page.' });
      return respond(res, 200, {
        ...collection,
        features: collection.features.slice(offset, offset + 20),
        next: offset + 20 < collection.features.length ? offset + 20 : null,
        total: collection.features.length,
      });
    }
    return respond(res, 404, { error: 'Custom map resource not found.' });
  } catch (error) {
    console.error(
      'Custom atlas request failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return respond(res, 503, {
      error: 'The custom atlas is unavailable. Please try again later.',
      code:
        error?.code === 'ATLAS_CONFIGURATION_MISSING'
          ? 'ATLAS_CONFIGURATION_MISSING'
          : error?.code === 'ENOENT'
            ? 'ATLAS_DATASET_MISSING'
            : 'ATLAS_DATASET_UNREADABLE',
    });
  }
}
