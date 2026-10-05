import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { skyForLocation, earthForLocation, validLocation } from '../source/location.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const files = await readdir(new URL('../docs/assets/', import.meta.url));
const world = await read('../docs/assets/' + files.find((file) => /^world\./.test(file)));
const reference = await read('../evidence/location-reference.json');
const sky = await read('../source/data/sky.json');
const land = await read('../source/data/land.json');
assert.equal(world.recordedAt, reference.recordedAt);
assert.equal(world.objects.length, 16534);
const report = [];
for (const place of reference.places) {
  const objects = skyForLocation(world, place);
  assert.equal(objects.length, place.aboveHorizon, place.name);
  assert.equal(objects.filter((o) => o.elevation >= 10).length, place.above10Degrees, place.name);
  assert.ok(objects.every((o) => o.elevation >= 0 && o.elevation <= 90 &&
    [o.azimuth, o.x, o.y, o.altitude, o.speed].every(Number.isFinite)));
  if (place.name === 'Seoul') {
    const byId = new Map(objects.map((o) => [o.id, o]));
    for (const row of sky.objects) {
      const expected = Object.fromEntries(sky.fields.map((field, i) => [field, row[i]]));
      const actual = byId.get(expected.id);
      assert.ok(actual);
      assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 0.00001);
    }
  }
  const earth = earthForLocation(land, place);
  assert.ok(earth.land.length > 1000 && !/NaN|Infinity/.test(earth.land + earth.graticule));
  report.push({ name: place.name, satellites: objects.length });
}
for (const latitude of [-90, 0, 90]) {
  const east = skyForLocation(world, { name: 'Boundary', latitude, longitude: 180 });
  const west = skyForLocation(world, { name: 'Boundary', latitude, longitude: -180 });
  assert.deepEqual(east.map((o) => o.id), west.map((o) => o.id));
  for (let i = 0; i < east.length; i++)
    assert.ok(Math.hypot(east[i].x - west[i].x, east[i].y - west[i].y) < 1e-8);
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(earthForLocation(land,
    { name: 'Boundary', latitude, longitude: 180 }))));
}
for (const bad of [null, {}, { name: 'Bad', latitude: 91, longitude: 0 },
  { name: 'Bad', latitude: 0, longitude: NaN }, { name: '', latitude: 0, longitude: 0 }])
  assert.equal(validLocation(bad), false);
console.log(JSON.stringify({ verified: true, globalObjects: world.objects.length, report,
  referencePositions: true, polesAndDateLine: true }));
