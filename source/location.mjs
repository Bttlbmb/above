import { geoOrthographic, geoPath, geoGraticule10 } from './vendor/geo.mjs';
import { ecfToLookAngles } from './vendor/satellite.js';

const rad = Math.PI / 180;
export function validLocation(value) {
  return Boolean(value && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180 &&
    typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 40);
}

// World positions are propagated once during the build at the preserved catalog instant.
// Changing the observer then needs only local look-angle calculations, not 16,000 SGP4 runs.
export function skyForLocation(world, location) {
  if (!validLocation(location)) throw new Error('Invalid observer');
  const observer = { latitude: location.latitude * rad, longitude: location.longitude * rad, height: 0 };
  return world.objects.map(([id, name, x, y, z, altitude, speed]) => {
    const look = ecfToLookAngles(observer, { x, y, z });
    if (!Number.isFinite(look.elevation) || look.elevation < 0) return null;
    const elevation = look.elevation / rad, radius = (90 - elevation) / 95 * 43;
    return { id, name, azimuth: look.azimuth / rad, elevation,
      x: 50 + Math.sin(look.azimuth) * radius,
      y: 50 - Math.cos(look.azimuth) * radius, altitude, speed, range: look.rangeSat };
  }).filter(Boolean).sort((a, b) => b.elevation - a.elevation || a.id - b.id);
}

export function earthForLocation(land, location) {
  if (!validLocation(location)) throw new Error('Invalid observer');
  const projection = geoOrthographic().rotate([-location.longitude, -location.latitude])
    .translate([128, 128]).scale(96).precision(0.2);
  const path = geoPath(projection);
  return { land: path(land), graticule: path(geoGraticule10()), sphere: path({ type: 'Sphere' }) };
}
