import {atlasStore} from './atlas-store.mjs';
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
    const store = await atlasStore(key);
    if (action === 'overview') return respond(res, 200, await store.section('overview'));
    if (action === 'demographics') {
      const demographics=await store.section('demographics');
      return demographics ? respond(res,200,demographics) : respond(res,404,{error:'The 2026 demographic scenario is not available.'});
    }
    if (action === 'search') {
      const query = (url.searchParams.get('q') || '').trim().toLowerCase();
      if (query.length < 2 || query.length > 100)
        return respond(res, 400, {error: 'Use between 2 and 100 characters to find an administrative area.'});
      const matches = ((await store.section('administrativeSearch')) || []).filter(item =>
        [item.name, ...item.aliases].join(' ').toLowerCase().includes(query));
      const exact = item => [item.name, ...item.aliases].some(name => name.toLowerCase() === query);
      matches.sort((a, b) => Number(exact(b)) - Number(exact(a)));
      return respond(res, 200, matches.slice(0, 30));
    }
    if (action === 'analysis') return respond(res, 200, await store.section('analysis'));
    if (action === 'territorial-review')
      return respond(res, 200, (await store.section('territorialReview')) || null);
    if (action === 'detail') {
      const id = url.searchParams.get('province'),
        level = url.searchParams.get('level');
      if (
        !id ||
        !store.hasProvince(id) ||
        !['province', 'region', 'division', 'district', 'tehsil'].includes(level)
      )
        return respond(res, 400, {
          error: 'Choose a valid province and detail level.',
        });
      const offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isInteger(offset) || offset < 0)
        return respond(res, 400, { error: 'Choose a valid detail page.' });
      return respond(res, 200, await store.detail(id,level,offset));
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
