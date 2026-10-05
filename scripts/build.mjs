// Validate original inputs before generating same-origin, content-addressed browser assets.
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { json2satrec, propagate, gstime, eciToEcf, eciToGeodetic } from '../source/vendor/satellite.js';

const root = new URL('../', import.meta.url),
  source = new URL('source/', root),
  output = new URL('docs/', root);
const read = (name) => readFile(new URL(name, source), 'utf8'),
  hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);
const [skyText, orbitText, globeText, factsText] = await Promise.all(
  ['data/sky.json', 'data/orbits.json', 'data/globe.json', 'data/facts.json'].map(read),
);
const sky = JSON.parse(skyText),
  orbits = JSON.parse(orbitText),
  globe = JSON.parse(globeText),
  facts = JSON.parse(factsText);
const catalog = JSON.parse(await read('data/catalog.json'));
assert.equal(catalog.recordedAt, sky.recordedAt, 'Global catalog must use the recorded instant');
assert.ok(catalog.records.length > 16000, 'Location views need the full active catalog');
const date = new Date(catalog.recordedAt), gmst = gstime(date), worldObjects = [], worldRecords = [];
const globalIds = new Set();
for (const row of catalog.records) {
  assert.equal(row.length, catalog.fields.length);
  const omm = Object.fromEntries(catalog.fields.map((field, i) => [field, row[i]]));
  assert.ok(Number.isSafeInteger(omm.NORAD_CAT_ID) && !globalIds.has(omm.NORAD_CAT_ID));
  globalIds.add(omm.NORAD_CAT_ID);
  const epoch = Date.parse(omm.EPOCH.endsWith('Z') ? omm.EPOCH : omm.EPOCH + 'Z');
  assert.ok(Number.isFinite(epoch));
  if (Math.abs(epoch - date.getTime()) > 72 * 3600000) continue;
  const record = json2satrec(omm), pv = propagate(record, date);
  if (!pv?.position || !pv.velocity || record.error) continue;
  const ecf = eciToEcf(pv.position, gmst), altitude = eciToGeodetic(pv.position, gmst).height,
    speed = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
  if (![ecf.x, ecf.y, ecf.z, altitude, speed].every(Number.isFinite)) continue;
  worldObjects.push([omm.NORAD_CAT_ID, omm.OBJECT_NAME, ecf.x, ecf.y, ecf.z, altitude, speed]);
  worldRecords.push(row);
}
assert.ok(worldObjects.length > 16000);
assert.ok(Number.isFinite(sky.observer.latitude) && Math.abs(sky.observer.latitude) <= 90);
assert.ok(Number.isFinite(sky.observer.longitude) && Math.abs(sky.observer.longitude) <= 180);
assert.ok(sky.objects.length > 0);
assert.deepEqual(globe.observer, sky.observer, 'Preprojected Earth must use the snapshot observer');
assert.ok(Number.isFinite(Date.parse(sky.recordedAt)));
assert.deepEqual(sky.fields, [
  'id',
  'name',
  'azimuth',
  'elevation',
  'x',
  'y',
  'altitude',
  'speed',
  'range',
]);
const ids = new Set();
for (const row of sky.objects) {
  assert.equal(row.length, sky.fields.length);
  assert.ok(
    Number.isSafeInteger(row[0]) && row[0] > 0 && typeof row[1] === 'string' && row[1].length > 0,
  );
  assert.ok(row.slice(2).every(Number.isFinite));
  assert.ok(row[3] >= 0 && row[3] <= 90);
  assert.ok(!ids.has(row[0]));
  ids.add(row[0]);
}
const idIndex = orbits.fields.indexOf('NORAD_CAT_ID');
assert.ok(idIndex >= 0);
assert.equal(orbits.records.length, ids.size);
const orbitIds = new Set();
for (const row of orbits.records) {
  assert.equal(row.length, orbits.fields.length);
  assert.ok(ids.has(Number(row[idIndex])));
  assert.ok(!orbitIds.has(Number(row[idIndex])), 'Duplicate orbit identity');
  const epoch = Date.parse(row[orbits.fields.indexOf('EPOCH')] + 'Z');
  assert.ok(Number.isFinite(epoch) && Math.abs(epoch - Date.parse(sky.recordedAt)) <= 72 * 3600000);
  assert.ok(
    row.every((value, i) =>
      orbits.fields[i] === 'EPOCH' ? typeof value === 'string' : Number.isFinite(value),
    ),
  );
  orbitIds.add(Number(row[idIndex]));
}
assert.equal(orbitIds.size, ids.size);
assert.equal(new Set(sky.discoveries.map((f) => f.id)).size, sky.discoveries.length);
for (const fact of sky.discoveries) {
  assert.ok(ids.has(fact.id));
  assert.ok(typeof fact.text === 'string' && fact.text.length > 20);
}
assert.equal(facts.status, 'verified');
assert.equal(facts.schemaVersion, 1);
assert.equal(facts.recordedAt, sky.recordedAt);
assert.deepEqual(facts.fields, [
  'key',
  'ids',
  'group',
  'tier',
  'score',
  'text',
  'sources',
  'story',
]);
const factIds = new Set(),
  factKeys = new Set();
for (const [key, applicable, group, tier, score, text, references, story] of facts.facts) {
  assert.ok(!factKeys.has(key));
  factKeys.add(key);
  assert.ok(applicable.length > 0);
  for (const id of applicable) {
    assert.ok(ids.has(id));
    factIds.add(id);
  }
  assert.ok(Number.isInteger(group) && group >= 0 && group < facts.groups.length);
  assert.ok([0, 1, 2].includes(tier));
  assert.ok(Number.isFinite(score) && score >= 0 && score <= 6);
  assert.ok(typeof text === 'string' && text.length > 20);
  assert.ok(references.length > 0);
  for (const i of references) {
    assert.ok(facts.sources[i]);
    assert.equal(new URL(facts.sources[i].url).protocol, 'https:');
  }
  assert.ok(Number.isInteger(story) && story >= 0 && story < facts.storyCount);
}
assert.ok(factIds.size >= 500);
assert.equal(factIds.size, facts.counts.distinctSatellites);
assert.equal(facts.facts.length, facts.counts.facts);
await mkdir(new URL('assets/', output), { recursive: true });
const assets = [];
async function asset(name, extension, value) {
  const file = `${name}.${hash(value)}.${extension}`;
  await writeFile(new URL(`assets/${file}`, output), value);
  assets.push({
    file,
    bytes: Buffer.byteLength(value),
    gzipBytes: gzipSync(value).length,
    brotliBytes: brotliCompressSync(value).length,
  });
  return `./assets/${file}`;
}
// Preserve the full scientific source, but do not send the unused range column to browsers.
const runtimeSky = {
  ...sky,
  fields: sky.fields.slice(0, -1),
  objects: sky.objects.map((row) => row.slice(0, -1)),
};
const skyUrl = await asset('sky', 'json', JSON.stringify(runtimeSky)),
  orbitUrl = await asset('orbits', 'json', JSON.stringify(orbits));
const worldUrl = await asset('world', 'json', JSON.stringify({ recordedAt: catalog.recordedAt,
  source: catalog.source, fields: ['id', 'name', 'ecfX', 'ecfY', 'ecfZ', 'altitude', 'speed'], objects: worldObjects }));
const globalOrbitUrl = await asset('catalog', 'json', JSON.stringify({ fields: catalog.fields, records: worldRecords }));
const landUrl = await asset('land', 'json', await read('data/land.json'));
const factsUrl = await asset('facts', 'json', JSON.stringify(facts)),
  factsModule = await asset('facts', 'mjs', await read('facts.mjs'));
const satelliteUrl = await asset('satellite', 'mjs', await read('vendor/satellite.js'));
const geoUrl = await asset('geo', 'mjs', await read('vendor/geo.mjs'));
const locationUrl = await asset('location', 'mjs', (await read('location.mjs'))
  .replaceAll('./vendor/geo.mjs', './' + geoUrl.split('/').pop())
  .replaceAll('./vendor/satellite.js', './' + satelliteUrl.split('/').pop()));
const solarUrl = await asset('solar', 'mjs', await read('solar.mjs'));
const starsUrl = await asset('stars', 'webp', await readFile(new URL('assets/stars.webp', source)));
const styleUrl = await asset(
  'style',
  'css',
  (await read('style.css'))
    .replaceAll('__STARS__', './' + starsUrl.split('/').pop())
    .replace(/\s+/g, ' ')
    .trim(),
);
const app = (await read('app.mjs'))
  .replaceAll('__SKY__', skyUrl)
  .replaceAll('__ORBITS__', orbitUrl)
  .replaceAll('__CATALOG__', globalOrbitUrl)
  .replaceAll('__WORLD__', worldUrl)
  .replaceAll('__LAND__', landUrl)
  .replaceAll('__LOCATION_MODULE__', './' + locationUrl.split('/').pop())
  .replaceAll('__SATELLITE__', './' + satelliteUrl.split('/').pop())
  .replaceAll('__SOLAR__', './' + solarUrl.split('/').pop())
  .replaceAll('__FACTS__', factsUrl)
  .replaceAll('__FACTS_MODULE__', './' + factsModule.split('/').pop())
  .replaceAll('__FACTS_REVISION__', hash(factsText));
// JSON URLs resolve against the document; module imports resolve against the app module.
const appUrl = await asset('app', 'mjs', app);
const earth = `<defs><path id="am-land-shape" d="${globe.land}"/><mask id="am-light-mask-0" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><image data-land-mask x="0" y="0" width="256" height="256"/></mask></defs><path class="am-earth-edge" d="${globe.sphere}"/><path class="am-graticule" d="${globe.graticule}"/><use href="#am-land-shape" class="am-land"/><use href="#am-land-shape" class="am-lit-land" mask="url(#am-light-mask-0)"/><circle class="am-observer" cx="128" cy="128" r="1.8"/>`;
const html = (await read('index.html'))
  .replace('__EARTH__', earth)
  .replace('__STYLE__', styleUrl)
  .replace('__APP__', appUrl)
  .replace(/>\s+</g, '><')
  .trim();
assert.ok(!/__\w+__/.test(html + app));
await writeFile(new URL('index.html', output), html);
// Keep static hosts from treating the generated files as a Jekyll site.
await writeFile(new URL('.nojekyll', output), '');
await writeFile(
  new URL('third-party-notices.txt', output),
  await readFile(new URL('THIRD_PARTY_NOTICES.md', root)),
);
// Prune only generated, content-hashed assets from previous builds.
const keep = new Set(assets.map((a) => a.file));
for (const file of await readdir(new URL('assets/', output)))
  if (/^[a-z]+\.[0-9a-f]{12}\.(json|mjs|css|webp)$/.test(file) && !keep.has(file))
    await unlink(new URL(`assets/${file}`, output));
console.log(
  JSON.stringify(
    {
      objects: ids.size,
      fallbackDiscoveries: sky.discoveries.length,
      verifiedFacts: facts.counts.facts,
      verifiedSatellites: factIds.size,
      discoveryStories: facts.counts.discoveryStories,
      htmlBytes: Buffer.byteLength(html),
      assets,
      totalAssetBytes: assets.reduce((s, a) => s + a.bytes, 0) + Buffer.byteLength(html),
    },
    null,
    2,
  ),
);
