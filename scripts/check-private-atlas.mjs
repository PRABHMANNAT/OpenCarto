import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import { privateAtlasHandler } from '../server/private-atlas.mjs';
process.loadEnvFile('.env.local');
let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.trim();
assert.ok(password, 'Supply test password through stdin.');
const server = createServer(privateAtlasHandler);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port + '/api/private-atlas';
async function call(action, options = {}) {
  const r = await fetch(base + '?action=' + action, options);
  assert.match(r.headers.get('cache-control'), /private, no-store/);
  return r;
}
function ringContains(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function contains(geometry, point) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    ([outer, ...holes]) =>
      ringContains(outer, point) &&
      !holes.some((ring) => ringContains(ring, point)),
  );
}
try {
  for (const action of [
    'overview',
    'analysis',
    'detail&province=punjab&level=district',
    'session',
  ])
    assert.equal((await call(action)).status, 401);
  assert.equal(
    (
      await call('overview', {
        headers: { Cookie: 'opencarto_private_atlas=forged' },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call('unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://unrelated.example',
        },
        body: JSON.stringify({ password }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call('unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: password,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'incorrect-test-password' }),
      })
    ).status,
    401,
  );
  const unlock = await call('unlock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: new URL(base).origin,
    },
    body: JSON.stringify({ password }),
  });
  assert.equal(unlock.status, 200);
  const cookie = unlock.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/private-atlas/);
  assert.match(cookie, /Max-Age=7200/);
  const headers = { Cookie: cookie.split(';')[0] };
  assert.equal((await call('session', { headers })).status, 200);
  const response = await call('overview', { headers });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(
    Buffer.byteLength(text) < 4_500_000,
    'Overview fits function response limit',
  );
  const data = JSON.parse(text);
  assert.equal(data.provinces.length, 42);
  assert.equal(data.geometry.features.length, 42);
  assert.equal(new Set(data.provinces.map((p) => p.id)).size, 42);
  assert.equal(data.auditSummary.provinceCount, 42);
  assert.equal(data.auditSummary.exactOverlapKm2, 0);
  assert.equal(data.auditSummary.unassignedSourceFootprintKm2, 0);
  for (const p of data.provinces) {
    assert.ok(p.areaKm2 > 0);
    assert.ok(p.overview.split(/\s+/).length >= 150, p.name + ' overview');
    assert.ok(p.photos.length >= 1, p.name + ' licensed photo');
    for (const photo of p.photos) {
      assert.ok(photo.author);
      assert.match(photo.license, /CC BY|Public domain|CC0/);
      assert.ok(photo.sourceUrl.startsWith('https://commons.wikimedia.org/'));
    }
    assert.equal(p.forestArea, null);
    assert.equal(p.forestPercent, null);
    if (p.population !== null) assert.equal(p.census.year, 2011);
  }
  assert.equal(data.provinces.find((p) => p.id === 'punjab').population, null);
  assert.equal(data.provinces.find((p) => p.id === 'punjab').color, '#4A86BD');
  const punjab = data.provinces.find((p) => p.id === 'punjab');
  assert.deepEqual(punjab.officialLanguages, [
    'Punjabi (Gurmukhi)',
    'Hindi',
    'Urdu',
  ]);
  assert.equal(punjab.photos.length, 5);
  assert.match(punjab.overview, /hypothetical heart of Sikhs in India/);
  for (const [i, subject] of [
    'Golden Temple at night',
    'Nankana Sahib',
    'Lahore Fort',
    'Murree',
    'Kartarpur',
  ].entries())
    assert.ok(punjab.photos[i].caption.includes(subject));
  assert.ok(!data.provinces.some((p) => p.id === 'gilgit-baltistan'));
  const kashmir = data.provinces.find((p) => p.id === 'jammu-kashmir');
  assert.ok(kashmir.aliases.includes('Gilgit-Baltistan'));
  assert.ok(kashmir.aliases.includes('Siachen'));
  assert.equal(kashmir.detailCounts.district, 44);
  assert.equal(
    data.provinces.find((p) => p.id === 'ladakh').name,
    'Ladakh–Aksai Chin',
  );
  assert.equal(
    data.context.features.find((f) => f.properties.id === 'aksai-chin')
      .properties.outside,
    false,
  );
  assert.ok(data.provinces.some((p) => p.id === 'in-tamil-nadu'));
  assert.ok(data.provinces.some((p) => p.id === 'in-lakshadweep'));
  assert.ok(data.provinces.some((p) => p.id === 'islamabad'));
  const analysis = await (await call('analysis', { headers })).json();
  assert.equal(
    analysis.audit.northernGrouping.secondProvince,
    'Ladakh–Aksai Chin',
  );
  assert.equal(analysis.kpReview.length, 72);
  assert.equal(
    analysis.kpReview.filter((r) => r.decision === 'Transfer proposed').length,
    5,
  );
  assert.ok(
    analysis.kpReview
      .filter((r) => ['Swabi', 'Nowshera'].includes(r.district))
      .every((r) => r.proposedProvince === 'Khyber Pakhtunkhwa'),
  );
  assert.ok(
    analysis.changes
      .filter((r) => r.currentDistrict === 'Rahim Yar Khan')
      .every((r) => r.proposedProvince === 'Bahawalpur'),
  );
  const expected = [
    'Panja Sahib',
    'Kartarpur–Ravi',
    'Katas Raj–Salt Range',
    'Sri Anandpur Sahib',
    'Yazman–Cholistan',
  ];
  for (const name of expected)
    assert.ok(
      analysis.changes.some((r) => r.proposedDistrict === name),
      name + ' assignment documented',
    );
  for (const id of [
    'punjab',
    'bahawalpur',
    'multan',
    'in-rajasthan',
    'in-tamil-nadu',
    'jammu-kashmir',
    'ladakh',
  ])
    for (const level of ['province', 'division', 'district', 'tehsil']) {
      let offset = 0,
        total = 0;
      do {
        const r = await call(
          'detail&province=' + id + '&level=' + level + '&offset=' + offset,
          { headers },
        );
        assert.equal(r.status, 200);
        const text = await r.text();
        assert.ok(
          Buffer.byteLength(text) < 4_500_000,
          id + ' ' + level + ' page fits response limit',
        );
        const d = JSON.parse(text);
        if (level === 'province' && id === 'jammu-kashmir') {
          const glacier = data.contextLabels.features.find(
            (f) => f.properties.id === 'siachen-glacier',
          ).geometry.coordinates;
          for (const point of [[74.3088, 35.9208], [74.7973, 34.0837], glacier])
            assert.ok(
              contains(d.features[0].geometry, point),
              'Gilgit, Srinagar and Siachen share one rendered province',
            );
        }
        if (level === 'province' && id === 'ladakh') {
          const plateau = data.contextLabels.features.find(
            (f) => f.properties.id === 'aksai-chin',
          ).geometry.coordinates;
          for (const point of [[77.5771, 34.1526], plateau])
            assert.ok(
              contains(d.features[0].geometry, point),
              'Leh and Aksai Chin share one rendered province',
            );
        }
        assert.ok(d.features.length <= 20);
        total += d.features.length;
        offset = d.next;
        if (offset === null) assert.equal(total, d.total);
      } while (offset !== null);
    }
  assert.equal(
    (await call('detail&province=__proto__&level=district', { headers }))
      .status,
    400,
  );
  assert.equal(
    (await call('detail&province=punjab&level=district&offset=-1', { headers }))
      .status,
    400,
  );
  const logout = await call('session', { method: 'DELETE', headers });
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await call('overview')).status, 401);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call('unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'wrong' }),
        })
      ).status,
      401,
    );
  const limited = await call('unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  const encrypted = await fs.readFile('server/private-atlas.enc');
  assert.equal(encrypted.subarray(0, 4).toString(), 'UAT1');
  assert.ok(!encrypted.includes(Buffer.from('Havelian–Lora')));
  const assets = await fs.readdir('dist-vercel/assets');
  for (const file of assets.filter((p) => p.endsWith('.js'))) {
    const text = await fs.readFile('dist-vercel/assets/' + file, 'utf8');
    for (const value of [
      password,
      process.env.PRIVATE_ATLAS_PASSWORD_HASH,
      process.env.PRIVATE_ATLAS_DATA_KEY,
      process.env.PRIVATE_ATLAS_SESSION_SECRET,
    ])
      assert.ok(!text.includes(value), 'No credential in client assets');
    assert.ok(
      !text.includes('Transfer all three contiguous source tehsils'),
      'No private profile in client assets',
    );
  }
  console.log(
    'Verified private authentication, origin checks, signed cookies, rate limiting, 42 profiles, northern regrouping, five attributed Punjab photos, proposed official languages, coverage audit, paged detail and absence of credentials/private data in client assets.',
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
