import assert from 'node:assert/strict';
import * as solar from '../source/solar.mjs';
const rad = Math.PI / 180;

// Independent Meeus / NOAA apparent-Sun calculation. Reference:
// https://gml.noaa.gov/grad/solcalc/calcdetails.html
// https://gml.noaa.gov/grad/solcalc/main.js
function referenceSun(time) {
  const t = (time / 86400000 + 2440587.5 - 2451545) / 36525;
  const longitude = 280.46646 + t * (36000.76983 + 0.0003032 * t);
  const anomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t),
    m = anomaly * rad;
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center =
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289;
  const omega = (125.04 - 1934.136 * t) * rad;
  const apparent = (longitude + center - 0.00569 - 0.00478 * Math.sin(omega)) * rad;
  const obliquity =
    (23 +
      (26 + (21.448 - t * (46.815 + t * (0.00059 - 0.001813 * t))) / 60) / 60 +
      0.00256 * Math.cos(omega)) *
    rad;
  const y = Math.tan(obliquity / 2) ** 2,
    l = longitude * rad;
  const equation =
    ((y * Math.sin(2 * l) -
      2 * eccentricity * Math.sin(m) +
      4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l) -
      0.5 * y * y * Math.sin(4 * l) -
      1.25 * eccentricity ** 2 * Math.sin(2 * m)) /
      rad) *
    4;
  const utcMinutes = (((time % 86400000) + 86400000) % 86400000) / 60000;
  return {
    latitude: Math.asin(Math.sin(obliquity) * Math.sin(apparent)) / rad,
    longitude: 180 - utcMinutes / 4 - equation / 4,
  };
}

let maximum = 0,
  samples = 0;
for (const day of ['2026-03-20', '2026-06-21', '2026-09-22', '2026-12-21', '2026-10-04'])
  for (let hour = 0; hour < 24; hour++) {
    const time = Date.parse(day + 'T00:00:00Z') + hour * 3600000,
      a = solar.position(time, 37.5665, 126.978),
      b = referenceSun(time);
    const cosine =
      Math.sin(a.latitude * rad) * Math.sin(b.latitude * rad) +
      Math.cos(a.latitude * rad) *
        Math.cos(b.latitude * rad) *
        Math.cos((a.longitude - b.longitude) * rad);
    const difference = Math.acos(Math.min(1, Math.max(-1, cosine))) / rad;
    assert.ok(difference < 0.02, `${day} ${hour}: solar-direction difference ${difference}°`);
    maximum = Math.max(maximum, difference);
    samples++;
  }

// The polar observer still receives a finite direction during continuous day or night.
assert.ok(solar.position(Date.parse('2026-06-21T12:00:00Z'), 89, 0).elevation > 0);
assert.ok(solar.position(Date.parse('2026-12-21T12:00:00Z'), 89, 0).elevation < 0);
console.log(
  JSON.stringify(
    { samples, maxSunDirectionDifferenceDegrees: maximum, polarGeometry: 'passed' },
    null,
    2,
  ),
);
