import {
  createDecipheriv,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scrypt = promisify(scryptCallback),
  cookieName = 'opencarto_private_atlas',
  lifetime = 2 * 60 * 60,
  attempts = new Map();
let payloadPromise;
function settings() {
  const hash = process.env.PRIVATE_ATLAS_PASSWORD_HASH,
    secret = process.env.PRIVATE_ATLAS_SESSION_SECRET,
    key = process.env.PRIVATE_ATLAS_DATA_KEY;
  if (
    !hash ||
    !secret ||
    secret.length < 64 ||
    !key ||
    !/^[0-9a-f]{64}$/i.test(key)
  )
    throw Error('Private atlas server is not configured');
  return { hash, secret, key };
}
const sign = (value, secret) =>
  createHmac('sha256', secret).update(value).digest('base64url');
function equal(a, b) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function authenticated(req, secret) {
  const cookie = String(req.headers.cookie || '')
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + '='))
    ?.slice(cookieName.length + 1);
  if (!cookie || cookie.length > 250) return false;
  const [nonce, expires, signature, ...extra] = cookie.split('.');
  return !extra.length &&
    /^[\w-]{32}$/.test(nonce || '') &&
    Number(expires) > Date.now() / 1000 &&
    Number(expires) <= Date.now() / 1000 + lifetime + 5 &&
    equal(signature || '', sign(nonce + '.' + expires, secret))
    ? Number(expires)
    : 0;
}
function sessionCookie(req, secret, clear = false) {
  const secure =
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const value = clear
    ? ''
    : (() => {
        const value =
          randomBytes(24).toString('base64url') +
          '.' +
          Math.floor(Date.now() / 1000 + lifetime);
        return value + '.' + sign(value, secret);
      })();
  return (
    cookieName +
    '=' +
    value +
    '; Path=/api/private-atlas; HttpOnly; SameSite=Strict; Max-Age=' +
    (clear ? 0 : lifetime) +
    (secure ? '; Secure' : '')
  );
}
async function verifyPassword(password, encoded) {
  const [type, n, r, p, salt, hash] = encoded.split('$');
  if (
    type !== 'scrypt' ||
    n !== '32768' ||
    r !== '8' ||
    p !== '1' ||
    !/^[0-9a-f]{64}$/i.test(salt || '') ||
    !/^[0-9a-f]{128}$/i.test(hash || '')
  )
    throw Error('Invalid private atlas password configuration');
  const derived = await scrypt(password, Buffer.from(salt, 'hex'), 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(derived, Buffer.from(hash, 'hex'));
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
async function body(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json'))
    throw Error('JSON required');
  if (req.body) {
    const value =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(value) > 1024) throw Error('Request too large');
    return JSON.parse(value);
  }
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (Buffer.byteLength(value) > 1024) throw Error('Request too large');
  }
  return JSON.parse(value);
}
async function payload(key) {
  if (!payloadPromise)
    payloadPromise = readFile(
      fileURLToPath(new URL('./private-atlas.enc', import.meta.url)),
    )
      .then((encoded) => {
        if (encoded.subarray(0, 4).toString() !== 'UAT1')
          throw Error('Invalid private atlas dataset');
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
function respond(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}
export async function privateAtlasHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const { hash, secret, key } = settings(),
      url = new URL(req.url, 'http://localhost'),
      action = url.searchParams.get('action') || 'overview';
    if (!sameOrigin(req))
      return respond(res, 403, {
        error: 'This request must come from the map application.',
      });
    if (req.method === 'POST' && action === 'unlock') {
      const ip =
          process.env.VERCEL === '1'
            ? String(req.headers['x-forwarded-for'] || '').split(',')[0]
            : req.socket?.remoteAddress || 'local',
        now = Date.now();
      for (const [id, entry] of attempts)
        if (entry.until < now) attempts.delete(id);
      const entry = attempts.get(ip) || {
        count: 0,
        until: now + 15 * 60 * 1000,
      };
      if (entry.count >= 5) {
        res.setHeader(
          'Retry-After',
          Math.max(1, Math.ceil((entry.until - now) / 1000)),
        );
        return respond(res, 429, {
          error: 'Too many attempts. Try again in 15 minutes.',
        });
      }
      let value;
      try {
        value = await body(req);
      } catch {
        return respond(res, 400, { error: 'Enter a valid password.' });
      }
      if (
        typeof value.password !== 'string' ||
        !value.password ||
        value.password.length > 128
      )
        return respond(res, 400, { error: 'Enter a valid password.' });
      entry.count++;
      attempts.set(ip, entry);
      if (!(await verifyPassword(value.password, hash)))
        return respond(res, 401, { error: 'The password is incorrect.' });
      attempts.delete(ip);
      res.setHeader('Set-Cookie', sessionCookie(req, secret));
      return respond(res, 200, { authenticated: true });
    }
    if (req.method === 'DELETE' && action === 'session') {
      res.setHeader('Set-Cookie', sessionCookie(req, secret, true));
      return respond(res, 200, { authenticated: false });
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return respond(res, 405, { error: 'Method not allowed.' });
    }
    const expires = authenticated(req, secret);
    if (!expires)
      return respond(res, 401, {
        error: 'Unlock this private map to continue.',
      });
    if (action === 'session')
      return respond(res, 200, {
        authenticated: true,
        expiresAt: expires * 1000,
      });
    const data = await payload(key);
    if (action === 'overview')
      return respond(res, 200, {
        ...data.overview,
        sessionExpiresAt: expires * 1000,
      });
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
    return respond(res, 404, { error: 'Private map resource not found.' });
  } catch (error) {
    console.error(
      'Private atlas request failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return respond(res, 503, {
      error: 'The private atlas is unavailable. Please try again later.',
    });
  }
}
