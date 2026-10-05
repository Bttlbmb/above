// Check the built module graph, content hashes, exact snapshot geometry, and compressed evidence.
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  json2satrec,
  propagate,
  gstime,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
} from '../source/vendor/satellite.js';
const root = fileURLToPath(new URL('../', import.meta.url)),
  output = path.join(root, 'docs');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const json = async (name) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
assert.equal(await readFile(path.join(output, '.nojekyll'), 'utf8'), '');
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else files.push(file);
  }
}
await walk(output);
for (const file of files) {
  const body = await readFile(file),
    match = path.basename(file).match(/^[a-z]+\.([0-9a-f]{12})\.(?:mjs|css|json|webp)$/);
  if (match) assert.equal(digest(body).slice(0, 12), match[1], `Content hash: ${file}`);
  if (!/\.(?:mjs|html|css)$/.test(file)) continue;
  const text = body.toString('utf8');
  assert.ok(
    !/__(?:EARTH|STYLE|APP|SKY|ORBITS|SATELLITE|SOLAR|FACTS|FACTS_MODULE|FACTS_REVISION|STARS|WORLD|CATALOG|LAND|LOCATION_MODULE)__/.test(
      text,
    ),
    `Unresolved build placeholder: ${file}`,
  );
  if (file.endsWith('.mjs')) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr);
  }
  const references = [
    ...text.matchAll(/(?:from\s*|import\s*|(?:src|href)=)["'](\.[^"'?#]+)["']/g),
    ...text.matchAll(/url\(["']?(\.[^"')?#]+)["']?\)/g),
  ];
  for (const reference of references) {
    const target = path.resolve(path.dirname(file), reference[1]);
    assert.ok(target.startsWith(output + path.sep));
    await stat(target);
  }
}
const sky = await json('source/data/sky.json'),
  orbits = await json('source/data/orbits.json');
const observer = {
    latitude: (sky.observer.latitude * Math.PI) / 180,
    longitude: (sky.observer.longitude * Math.PI) / 180,
    height: 0,
  },
  date = new Date(sky.recordedAt),
  gmst = gstime(date);
const rows = new Map(
  orbits.records.map((row) => [row[orbits.fields.indexOf('NORAD_CAT_ID')], row]),
);
// The original snapshot stores altitude/speed to three decimals and sky coordinates to five.
// These tolerances check that saved precision; they are not claims of physical prediction accuracy.
let maximumPositionError = 0;
for (const row of sky.objects) {
  const object = Object.fromEntries(sky.fields.map((key, i) => [key, row[i]])),
    omm = Object.fromEntries(orbits.fields.map((key, i) => [key, rows.get(object.id)[i]])),
    record = json2satrec(omm),
    pv = propagate(record, date);
  assert.equal(record.error, 0);
  assert.ok(pv?.position && pv.velocity);
  const look = ecfToLookAngles(observer, eciToEcf(pv.position, gmst)),
    elevation = (look.elevation * 180) / Math.PI,
    r = ((90 - elevation) / 95) * 43;
  const x = 50 + Math.sin(look.azimuth) * r,
    y = 50 - Math.cos(look.azimuth) * r;
  maximumPositionError = Math.max(maximumPositionError, Math.hypot(x - object.x, y - object.y));
  assert.ok(Math.abs(eciToGeodetic(pv.position, gmst).height - object.altitude) < 0.00051);
  assert.ok(Math.abs(Math.hypot(...Object.values(pv.velocity)) - object.speed) < 0.00051);
}
assert.ok(maximumPositionError < 0.00001);
const skyFile = files.find((file) => /sky\.[0-9a-f]{12}\.json$/.test(file)),
  builtSky = JSON.parse(await readFile(skyFile, 'utf8'));
assert.deepEqual(builtSky, {
  ...sky,
  fields: sky.fields.slice(0, -1),
  objects: sky.objects.map((row) => row.slice(0, -1)),
});
const handoff = gunzipSync(await readFile(path.join(root, 'evidence/reviewed-facts.json.gz'))),
  review = JSON.parse(gunzipSync(await readFile(path.join(root, 'evidence/fact-review.json.gz'))));
assert.equal(digest(handoff), review.inputSha256);
assert.equal(
  (await json('evidence/orbital-identities.json')).sourceSha256,
  review.orbitalIdentitySourceSha256,
);
assert.equal((await json('evidence/report.json')).factsSha256, digest(handoff));
assert.equal(
  await readFile(path.join(output, 'third-party-notices.txt'), 'utf8'),
  await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'),
);
const bytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce(
  (sum, size) => sum + size,
  0,
);
console.log(
  JSON.stringify({
    verified: true,
    staticFiles: files.length,
    totalBytes: bytes,
    objects: sky.objects.length,
    maximumPositionError,
    compressedEvidenceHashes: true,
  }),
);
