import { position as solarPosition } from './solar.bab656eafe2d.mjs';

const $ = (selector) => document.querySelector(selector),
  phone = $('.am-phone'),
  sky = $('.am-sky');
const canvas = $('.am-dots'),
  ctx = canvas.getContext('2d'),
  light = $('.am-earth-light');
const lightCtx = light.getContext('2d'),
  mask = document.createElement('canvas');
light.width = light.height = mask.width = mask.height = 256;
const maskCtx = mask.getContext('2d'),
  surface = lightCtx.createImageData(256, 256),
  maskPixels = maskCtx.createImageData(256, 256);
const motion = matchMedia('(prefers-reduced-motion: reduce)'),
  rad = Math.PI / 180,
  ns = 'http://www.w3.org/2000/svg';
// Keep the existing storage key so a product rename preserves saved discoveries.
const preferenceKey = 'above:living-earth:v1',
  pathCache = new Map(),
  colors = getComputedStyle(phone);
const locationKey = 'above:observer:v1', dialog = $('.am-location-dialog');
const cities = {
  Berlin: [52.52, 13.405, 'Europe/Berlin'],
  'Cape Town': [-33.9249, 18.4241, 'Africa/Johannesburg'],
  Delhi: [28.6139, 77.209, 'Asia/Kolkata'],
  Dubai: [25.2048, 55.2708, 'Asia/Dubai'],
  London: [51.5074, -0.1278, 'Europe/London'],
  'Los Angeles': [34.0522, -118.2437, 'America/Los_Angeles'],
  'Mexico City': [19.4326, -99.1332, 'America/Mexico_City'],
  'New York': [40.7128, -74.006, 'America/New_York'],
  Paris: [48.8566, 2.3522, 'Europe/Paris'],
  'São Paulo': [-23.5505, -46.6333, 'America/Sao_Paulo'],
  Seoul: [37.5665, 126.978, 'Asia/Seoul'],
  Singapore: [1.3521, 103.8198, 'Asia/Singapore'],
  Sydney: [-33.8688, 151.2093, 'Australia/Sydney'],
  Tokyo: [35.6762, 139.6503, 'Asia/Tokyo'],
};
let snapshotObjects, snapshotDiscoveries, snapshotEarth, chosenLocation = null, rememberedLocation = null,
  locationResources = null, locationAttempt = 0, locationRequest = 0, factData = null;
let keyboardNavigation = false;
document.addEventListener('keydown', () => { keyboardNavigation = true; }, true);
document.addEventListener('pointerdown', () => { keyboardNavigation = false; }, true);
const dotColor = colors.getPropertyValue('--am-dot').trim(),
  accent = colors.getPropertyValue('--am-accent').trim();
const factsRevision = '2024557ce0b4';
const state = {
  selected: null,
  story: false,
  discovered: [],
  library: factsRevision,
  choice: null,
  seenStories: [],
  seenGroups: [],
};
let frame,
  objects = [],
  byId,
  ordered,
  discoveries,
  baseTime,
  observer,
  orbitRows,
  orbitalLibrary;
let factLibrary = null,
  factTools = null,
  factsLoad = null,
  factsAttempt = 0,
  interactionRevision = 0;
let orbitLoad = null,
  globalOrbitLoad = null,
  libraryLoad = null,
  libraryAttempt = 0,
  skyLoad = null,
  ready = false,
  intersects = true,
  raf = null,
  lastFrame = 0,
  width = 0,
  dpr = 0;
let buckets = [],
  highlight = null,
  lastSolarMinute = null,
  maskUrl = null,
  maskRevision = 0,
  saveTimer = null,
  lastSaved = null;
let drawCount = 0;
const number = (n) => Math.round(n).toLocaleString('en-US');
const bearing = (n) =>
  [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ][Math.round(n / 22.5) % 16];
const svgNode = (name, attrs = {}) => {
  const node = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

async function json(url) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Data unavailable');
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
function validState(value) {
  const sameLibrary = value?.library === factsRevision;
  const indexes = (list, limit) =>
    Array.isArray(list)
      ? [...new Set(list.filter((i) => Number.isInteger(i) && i >= 0 && i < 10000))].slice(-limit)
      : [];
  return {
    selected: byId.has(value?.selected) ? value.selected : null,
    story: value?.story === true,
    library: factsRevision,
    choice:
      sameLibrary && Number.isInteger(value?.choice) && value.choice >= 0 && value.choice < 10000
        ? value.choice
        : null,
    seenStories: sameLibrary ? indexes(value?.seenStories, 24) : [],
    seenGroups: sameLibrary ? indexes(value?.seenGroups, 6) : [],
    discovered: Array.isArray(value?.discovered)
      ? [...new Set(value.discovered.filter((id) => byId.has(id)))].slice(-64)
      : [],
  };
}
function restore() {
  try {
    const saved = localStorage.getItem(preferenceKey);
    if (saved && saved.length < 2048) {
      Object.assign(state, validState(JSON.parse(saved)));
      lastSaved = saved;
      flushSave();
      return;
    }
    // Migrate only this app's prior wrapper state, after successfully saving the replacement.
    const key = `codex:visualization-widget-state-v2:${JSON.stringify([location.pathname, location.search])}`;
    const legacy = localStorage.getItem(key);
    if (!legacy || legacy.length > 16384) return;
    const parsed = JSON.parse(legacy),
      old =
        parsed?.privateContent?.aboveCinematic?.[0] ||
        parsed?.widgetState?.privateContent?.aboveCinematic?.[0];
    if (old) {
      Object.assign(state, validState(old));
      flushSave();
      if (lastSaved === JSON.stringify(state)) localStorage.removeItem(key);
    }
  } catch {
    /* Storage can be unavailable; the sky still works in memory. */
  }
}
function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!ready) return;
  const value = JSON.stringify(state);
  if (value === lastSaved) return;
  try {
    localStorage.setItem(preferenceKey, value);
    lastSaved = value;
  } catch {
    // Full or denied preference storage must not interrupt interaction.
  }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 150);
}

function active() {
  return ready && intersects && !document.hidden;
}
function animate() {
  return active() && !motion.matches;
}
function schedule() {
  if (animate() && raf === null) raf = requestAnimationFrame(tick);
  else if (!animate() && raf !== null) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}
function tick(time) {
  raf = null;
  if (time - lastFrame >= 50) {
    lastFrame = time;
    drawDots(time);
  }
  schedule();
}

// Batch faint dots by deterministic shimmer phase and rebuild geometry only after a real resize.
function sizeCanvas() {
  const next = sky.clientWidth,
    nextDpr = Math.min(devicePixelRatio || 1, 3);
  if (!next || (next === width && nextDpr === dpr)) return false;
  width = next;
  dpr = nextDpr;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(width * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buckets = Array.from({ length: 32 }, (_, i) => ({
    path: new Path2D(),
    phase: i * 2.399963229728653,
    period: 8 + (i % 13) / 2,
  }));
  for (const object of objects) {
    const p = buckets[object.id % 32].path,
      x = (object.x * width) / 100,
      y = (object.y * width) / 100;
    p.moveTo(x + 0.85, y);
    p.arc(x, y, 0.85, 0, Math.PI * 2);
  }
  buildHighlight();
  return true;
}
function buildHighlight() {
  const object = byId?.get(state.selected);
  highlight = null;
  if (!object) return;
  const x = (object.x * width) / 100,
    y = (object.y * width) / 100,
    halo = new Path2D(),
    dot = new Path2D();
  halo.arc(x, y, 8, 0, Math.PI * 2);
  dot.arc(x, y, 4, 0, Math.PI * 2);
  highlight = { halo, dot };
}
function drawDots(time) {
  if (!width) return;
  ctx.clearRect(0, 0, width, width);
  ctx.fillStyle = dotColor;
  const amplitude = motion.matches ? 0 : 0.09;
  for (const bucket of buckets) {
    ctx.globalAlpha =
      0.27 + amplitude * Math.sin((time / 1000 / bucket.period) * Math.PI * 2 + bucket.phase);
    ctx.fill(bucket.path);
  }
  if (highlight) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.08;
    ctx.fill(highlight.halo);
    ctx.globalAlpha = 1;
    ctx.fill(highlight.dot);
  }
  canvas.dataset.drawn = objects.length;
  canvas.dataset.selected = state.selected || '';
  canvas.dataset.frame = String(++drawCount);
}
function labelPosition() {
  const object = byId?.get(state.selected);
  if (!object || !width) return;
  const label = $('.am-selected-label');
  label.style.maxWidth = 'calc(100% - 6px)';
  const w = label.getBoundingClientRect().width,
    h = label.getBoundingClientRect().height;
  const anchor =
    (object.x * width) / 100 + w + 10 > width
      ? `calc(${object.x}% - ${w + 10}px)`
      : `calc(${object.x}% + 10px)`;
  const left = `clamp(3px, ${anchor}, calc(100% - ${w + 3}px))`;
  label.style.left = left;
  label.style.maxWidth = `calc(100% - ${left} - 3px)`;
  label.style.top = `clamp(3px, calc(${object.y}% - ${h / 2}px), calc(100% - ${h + 3}px))`;
}
function render() {
  const object = byId.get(state.selected),
    selected = Boolean(object);
  for (const selector of ['.am-detail', '.am-selected-label']) $(selector).hidden = !selected;
  $('.am-idle').hidden = selected;
  if (object) {
    $('[data-name]').textContent = object.name;
    $('[data-id]').textContent = 'Catalog ' + object.id;
    $('[data-elevation]').textContent = Math.round(object.elevation) + '° up';
    $('[data-altitude]').textContent = number(object.altitude) + ' km above Earth';
    $('[data-speed]').textContent = object.speed.toFixed(2) + ' km/s';
    $('[data-range]').textContent = number(object.range) + ' km from you';
    $('.am-selected-label').textContent = object.name.split(' (')[0];
    labelPosition();
  }
  sky.setAttribute(
    'aria-label',
    `${number(objects.length)} satellites above the horizon.${object ? ` Selected ${object.name}, ${Math.round(object.elevation)} degrees up, bearing ${bearing(object.azimuth)}.` : ''} Use arrow keys to explore.`,
  );
  renderFact();
  buildHighlight();
  drawDots(performance.now());
  drawTrail();
  schedule();
}
function renderFact() {
  let fact;
  if (factLibrary) {
    const chosen = state.story ? factLibrary.facts[state.choice] : null;
    fact = chosen?.ids.includes(state.selected)
      ? chosen
      : (state.story ? factTools.bestFact : factTools.detailFact)(factLibrary, state.selected);
  }
  fact ||= discoveries.get(state.selected);
  // Fallback stories were captured for Seoul. Keep their observer-dependent wording local.
  let text = fact?.text || '';
  const object = byId.get(state.selected);
  if (fact?.source && object) {
    if (object.id === 49336) text = text.split(' In this recorded sky')[0];
    if (object.id === 30580) text = text.split(' In this snapshot')[0];
    if (object.id === 67555) text = `This satellite is about ${number(object.range)} km from you in this snapshot. Its calculated height above Earth is ${number(object.altitude)} km.`;
  }
  $('[data-story]').hidden = !fact;
  $('[data-story]').textContent = text.replace(/\brecorded sky\b/g, 'sky snapshot');
  $('[data-story]').dataset.key = fact?.key || 'recorded-' + state.selected;
  $('[data-story]').dataset.story = fact?.story ?? '';
  const sources = fact?.sources || (fact?.source ? [{ url: fact.source }] : []);
  const container = $('[data-sources]');
  container.replaceChildren();
  for (const source of sources) {
    const url = new URL(source.url);
    if (url.protocol !== 'https:') continue;
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.label || ({ 'celestrak.org': 'CelesTrak', 'qzss.go.jp': 'QZSS',
      'www.esa.int': 'ESA', 'science.nasa.gov': 'NASA' }[url.hostname] || url.hostname);
    link.title = source.title || link.textContent;
    link.setAttribute('aria-label', `${link.textContent}: ${source.title || 'supporting source'} (opens in a new tab)`);
    container.append(document.createTextNode(container.childNodes.length ? ' · ' : 'Source: '), link);
  }
  container.hidden = !container.childNodes.length;
}
// Optional data has its own retry lifecycle so the sky can survive a failed request.
async function loadFacts() {
  if (factLibrary) return true;
  if (!factsLoad) {
    const attempt = factsAttempt++,
      moduleUrl = './facts.0e4807146641.mjs' + (attempt ? `?retry=${attempt}` : '');
    factsLoad = Promise.all([json('./assets/facts.2024557ce0b4.json'), import(moduleUrl)])
      .then(([data, tools]) => {
        factTools = tools;
        factData = data;
        factLibrary = tools.createLibrary(data, objects);
        phone.dataset.factCount = factLibrary.facts.length;
        phone.dataset.factObjects = factLibrary.bySatellite.size;
        state.seenStories = state.seenStories.filter((i) => i < factLibrary.storyCount);
        state.seenGroups = state.seenGroups.filter((i) => i < factLibrary.groups.length);
        if (!factLibrary.facts[state.choice]?.ids.includes(state.selected)) state.choice = null;
        $('[data-fact-status]').textContent = '';
        renderFact();
        save();
        return true;
      })
      .catch(() => {
        factsLoad = null;
        $('[data-fact-status]').textContent =
          'More satellite facts could not load. Snapshot facts remain available.';
        return false;
      });
  }
  return factsLoad;
}
function select(id, story = false) {
  interactionRevision++;
  state.selected = id;
  state.story = story;
  state.choice = null;
  render();
  save();
  if (id) loadFacts();
}
function discoverFallback() {
  const candidates = [...discoveries.values()].filter((fact) => fact.id !== state.selected);
  if (!candidates.length) {
    const object = objects.find((o) => o.id !== state.selected);
    if (object) select(object.id);
    return;
  }
  let fact = candidates.find((f) => !state.discovered.includes(f.id));
  if (!fact) {
    state.discovered = [];
    fact = candidates[0];
  }
  state.discovered.push(fact.id);
  state.selected = fact.id;
  state.story = true;
  state.choice = null;
  render();
  save();
}
// Ignore delayed discovery results after a newer pointer or keyboard selection.
async function discover() {
  const revision = ++interactionRevision,
    button = $('.am-cool');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    const loaded = await loadFacts();
    if (revision !== interactionRevision) return;
    const choice = loaded ? factTools.chooseFact(factLibrary, state) : null;
    if (choice) {
      factTools.rememberFact(state, choice);
      state.selected = choice.object.id;
      state.story = true;
      state.choice = choice.fact.index;
      render();
      save();
    } else discoverFallback();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

async function loadOrbits(id) {
  if (orbitalLibrary && orbitRows?.records.has(id)) return;
  if (!libraryLoad) {
    const url = './satellite.65ebf6a76659.mjs' + (libraryAttempt ? `?retry=${libraryAttempt}` : '');
    libraryAttempt++;
    libraryLoad = import(url)
      .then((lib) => {
        orbitalLibrary = lib;
        return lib;
      })
      .catch((error) => {
        libraryLoad = null;
        throw error;
      });
  }
  if (!orbitLoad)
    orbitLoad = Promise.all([json('./assets/orbits.7365d90b0f26.json'), libraryLoad])
      .then(([data, lib]) => {
        if (!Array.isArray(data.fields) || !Array.isArray(data.records))
          throw new Error('Invalid orbital data');
        const idIndex = data.fields.indexOf('NORAD_CAT_ID');
        if (idIndex < 0) throw new Error('Missing orbital IDs');
        orbitRows = {
          fields: data.fields,
          records: new Map(data.records.map((row) => [Number(row[idIndex]), row])),
        };
        orbitalLibrary = lib;
      })
      .catch((error) => {
        orbitLoad = null;
        throw error;
      });
  await orbitLoad;
  if (!orbitRows.records.has(id)) {
    if (!globalOrbitLoad) globalOrbitLoad = json('./assets/catalog.8b1373dcc945.json').then((data) => {
      const indexes = orbitRows.fields.map((field) => data.fields.indexOf(field));
      if (indexes.some((i) => i < 0)) throw new Error('Invalid global orbit data');
      const idIndex = data.fields.indexOf('NORAD_CAT_ID');
      for (const row of data.records)
        orbitRows.records.set(Number(row[idIndex]), indexes.map((i) => row[i]));
    }).catch((error) => { globalOrbitLoad = null; throw error; });
    await globalOrbitLoad;
  }
}
// This bounded cache contains modelled paths at the fixed snapshot time, never telemetry.
function calculateTrail(id) {
  if (pathCache.has(id)) {
    const cached = pathCache.get(id);
    pathCache.delete(id);
    pathCache.set(id, cached);
    return cached;
  }
  const row = orbitRows.records.get(id);
  if (!row) throw new Error('Missing orbit');
  const omm = Object.fromEntries(orbitRows.fields.map((key, i) => [key, row[i]])),
    record = orbitalLibrary.json2satrec(omm);
  const epoch = Date.parse(omm.EPOCH.endsWith('Z') ? omm.EPOCH : omm.EPOCH + 'Z');
  function point(seconds) {
    if (Math.abs(baseTime + seconds * 1000 - epoch) > 72 * 3600000) return null;
    const date = new Date(baseTime + seconds * 1000),
      pv = orbitalLibrary.propagate(record, date);
    if (!pv?.position || record.error) return null;
    const look = orbitalLibrary.ecfToLookAngles(
        observer,
        orbitalLibrary.eciToEcf(pv.position, orbitalLibrary.gstime(date)),
      ),
      elevation = look.elevation / rad,
      r = ((90 - elevation) / 95) * 43;
    return Number.isFinite(elevation) && Number.isFinite(look.azimuth)
      ? {
          seconds,
          elevation,
          x: 50 + Math.sin(look.azimuth) * r,
          y: 50 - Math.cos(look.azimuth) * r,
        }
      : null;
  }
  // Refine horizon crossings and preserve missing propagation gaps instead of joining them.
  function crossing(a, b) {
    let low = a,
      high = b;
    for (let i = 0; i < 15; i++) {
      const mid = point((low.seconds + high.seconds) / 2);
      if (!mid) break;
      if (mid.elevation >= 0 === low.elevation >= 0) low = mid;
      else high = mid;
    }
    return point((low.seconds + high.seconds) / 2);
  }
  function visible(points) {
    const segments = [];
    let current = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        previous = points[i - 1];
      if (!p) {
        if (current.length) segments.push(current);
        current = [];
        continue;
      }
      if (p.elevation >= 0) {
        if (previous && previous.elevation < 0) {
          const edge = crossing(previous, p);
          if (edge) current.push(edge);
        }
        current.push(p);
      } else if (previous && previous.elevation >= 0) {
        const edge = crossing(previous, p);
        if (edge) current.push(edge);
        if (current.length) segments.push(current);
        current = [];
      }
    }
    if (current.length) segments.push(current);
    return segments;
  }
  const samples = [];
  for (let seconds = -300; seconds <= 300; seconds += 5) samples.push(point(seconds));
  const trail = {
    samples,
    past: visible(samples.slice(0, 61)),
    future: visible(samples.slice(60)),
  };
  if (pathCache.size >= 8) pathCache.delete(pathCache.keys().next().value);
  pathCache.set(id, trail);
  return trail;
}
async function drawTrail() {
  const svg = $('.am-trail'),
    status = $('[data-path-status]'),
    id = state.selected;
  svg.replaceChildren();
  delete svg.dataset.selected;
  status.textContent = '';
  if (!id) return;
  status.textContent = 'Calculating path…';
  try {
    await loadOrbits(id);
    if (id !== state.selected) return;
    const trail = calculateTrail(id),
      now = trail.samples.find((p) => p?.seconds === 0);
    if (!now) throw new Error('Unusable position');
    const w = width;
    svg.setAttribute('viewBox', `0 0 ${w} ${w}`);
    const defs = svgNode('defs'),
      clip = svgNode('clipPath', { id: 'am-path-clip' });
    clip.append(svgNode('circle', { cx: w / 2, cy: w / 2, r: w * 0.407368 }));
    defs.append(clip);
    const arrow = svgNode('marker', {
      id: 'am-direction',
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 5,
      markerHeight: 5,
      orient: 'auto',
    });
    arrow.append(
      svgNode('path', {
        d: 'M 1 1 L 9 5 L 1 9',
        fill: 'none',
        stroke: 'var(--am-accent)',
        'stroke-width': 1.5,
        'stroke-opacity': 0.75,
      }),
    );
    defs.append(arrow);
    svg.append(defs);
    const group = svgNode('g', { 'clip-path': 'url(#am-path-clip)' });
    for (const [part, segments] of [
      ['past', trail.past],
      ['future', trail.future],
    ])
      for (const segment of segments) {
        if (segment.length < 2) continue;
        const d = segment
            .map((p, i) => `${i ? 'L' : 'M'}${(p.x * w) / 100},${(p.y * w) / 100}`)
            .join(''),
          path = svgNode('path', {
            d,
            class: 'am-trail-path',
            'data-part': part,
          });
        if (part === 'future') path.setAttribute('marker-end', 'url(#am-direction)');
        group.append(path);
      }
    svg.append(group);
    svg.dataset.selected = id;
    svg.dataset.samples = trail.samples.length;
    svg.dataset.zeroX = now.x;
    svg.dataset.zeroY = now.y;
    status.textContent = '';
  } catch {
    if (id === state.selected)
      status.textContent = 'Path unavailable right now. Select an object to try again.';
  }
}

// The lighting clock is independent of the recorded satellite sky. Reuse both pixel buffers.
function updateSolar() {
  if (!active()) return;
  const time = Date.now(),
    minute = Math.floor(time / 60000);
  if (minute === lastSolarMinute) return;
  lastSolarMinute = minute;
  const sun = solarPosition(time, frame.observer.latitude, frame.observer.longitude);
  const phi = frame.observer.latitude * rad,
    delta = (sun.longitude - frame.observer.longitude) * rad,
    declination = sun.latitude * rad;
  const east = Math.cos(declination) * Math.sin(delta),
    north =
      Math.cos(phi) * Math.sin(declination) -
      Math.sin(phi) * Math.cos(declination) * Math.cos(delta),
    up =
      Math.sin(phi) * Math.sin(declination) +
      Math.cos(phi) * Math.cos(declination) * Math.cos(delta);
  const softness = Math.sin(6 * rad),
    smooth = (t) => {
      const v = Math.max(0, Math.min(1, t));
      return v * v * (3 - 2 * v);
    };
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const sx = (x + 0.5 - 128) / 96,
        sy = (y + 0.5 - 128) / 96,
        r = Math.hypot(sx, sy),
        i = (y * 256 + x) * 4;
      if (r > 1.14) continue;
      if (r <= 1) {
        const z = Math.sqrt(Math.max(0, 1 - r * r)),
          cosine = east * sx - north * sy + up * z,
          day = smooth((cosine + softness) / (2 * softness)),
          lambert = Math.pow(Math.max(0, cosine), 0.65),
          volume = 0.7 + 0.3 * z;
        const rim =
            Math.exp(-(((r - 0.985) / 0.014) ** 2)) *
            Math.pow(Math.max(0, east * sx - north * sy + 0.12 * up), 0.7),
          dusk = Math.exp(-((cosine / (softness * 0.8)) ** 2)) * 0.7 * (1 - z * 0.3),
          lit = day * (0.4 + 0.6 * lambert);
        // Angular widths keep the approved twilight wash proportional to Earth at every screen size.
        const twilight = 0.3,
          gold = Math.exp(-(((cosine - 0.028) / 0.087) ** 2)) * (0.74 + 0.26 * z) * twilight,
          rose = Math.exp(-(((cosine + 0.055) / 0.165) ** 2)) * twilight,
          blue = Math.exp(-(((cosine + 0.15) / 0.15) ** 2)) * twilight;
        surface.data[i] = Math.min(
          255,
          (11 + lit * 32 + dusk * 18) * volume + rim * 98 + gold * 64 + rose * 13 + blue,
        );
        surface.data[i + 1] = Math.min(
          255,
          (18 + lit * 45 + dusk * 8) * volume + rim * 76 + gold * 39 + rose * 8 + blue * 6,
        );
        surface.data[i + 2] = Math.min(
          255,
          (32 + lit * 66 + dusk * 4) * volume + rim * 57 + gold * 20 + rose * 17 + blue * 19,
        );
        surface.data[i + 3] = Math.round(255 * smooth((1.004 - r) / 0.009));
        const brightness = Math.min(255, Math.round(25 + day * (95 + lambert * 130)));
        maskPixels.data[i] = maskPixels.data[i + 1] = maskPixels.data[i + 2] = brightness;
        maskPixels.data[i + 3] = 255;
      } else {
        const limb = Math.pow(Math.max(0, (east * sx - north * sy) / r), 1.1),
          bloom = Math.exp(-(((r - 1) / 0.043) ** 2)) * limb * 0.21;
        surface.data[i] = 245;
        surface.data[i + 1] = 189;
        surface.data[i + 2] = 142;
        surface.data[i + 3] = Math.round(bloom * 255);
      }
    }
  lightCtx.putImageData(surface, 0, 0);
  maskCtx.putImageData(maskPixels, 0, 0);
  const revision = ++maskRevision;
  mask.toBlob((blob) => {
    if (!blob || revision !== maskRevision) return;
    const next = URL.createObjectURL(blob),
      previous = maskUrl;
    maskUrl = next;
    $('[data-land-mask]').setAttribute('href', next);
    if (previous) URL.revokeObjectURL(previous);
  }, 'image/png');
  light.dataset.lightEast = east;
  light.dataset.lightNorth = north;
  light.dataset.lightUp = up;
  light.dataset.solarTime = time;
  phone.dataset.solarTime = time;
  phone.dataset.sunElevation = sun.elevation;
  const rising =
    solarPosition(time + 60000, frame.observer.latitude, frame.observer.longitude).elevation >
    sun.elevation;
  phone.dataset.phase =
    sun.elevation >= 4
      ? 'Daylight'
      : sun.elevation >= -0.833333
        ? rising
          ? 'Sunrise'
          : 'Sunset'
        : sun.elevation >= -18
          ? rising
            ? 'Dawn'
            : 'Dusk'
          : 'Night';
}

async function loadSky() {
  if (skyLoad) return skyLoad;
  $('.am-cool').disabled = true;
  $('.am-idle').textContent = 'Loading the sky…';
  skyLoad = (async () => {
    try {
      frame = await json('./assets/sky.98d3686f045e.json');
      if (!Array.isArray(frame.objects) || !frame.objects.length)
        throw new Error('Invalid snapshot');
      objects = frame.objects.map((row) =>
        Object.fromEntries(frame.fields.map((key, i) => [key, row[i]])),
      );
      snapshotObjects = objects;
      snapshotDiscoveries = frame.discoveries;
      snapshotEarth = {
        land: $('#am-land-shape').getAttribute('d'),
        graticule: $('.am-graticule').getAttribute('d'),
        sphere: $('.am-earth-edge').getAttribute('d'),
      };
      byId = new Map(objects.map((o) => [o.id, o]));
      ordered = [...objects].sort((a, b) => a.azimuth - b.azimuth || a.id - b.id);
      discoveries = new Map(frame.discoveries.map((f) => [f.id, f]));
      baseTime = Date.parse(frame.recordedAt);
      observer = {
        latitude: frame.observer.latitude * rad,
        longitude: frame.observer.longitude * rad,
        height: 0,
      };
      // Release the duplicated table; only the decoded sky remains in memory.
      delete frame.objects;
      delete frame.fields;
      ready = true;
      $('[data-help]').id = 'am-help';
      sky.setAttribute('aria-describedby', 'am-help');
      $('.am-idle').textContent = 'Tap a satellite to explore.';
      $('.am-cool').disabled = discoveries.size < 2;
      $('.am-cool').lastChild.textContent = 'Show me something cool';
      sizeCanvas();
      updateSolar();
      render();
      if (state.selected) loadFacts();
    } catch {
      ready = false;
      $('.am-idle').textContent = 'Sky unavailable. Please try again.';
      $('.am-cool').disabled = false;
      $('.am-cool').lastChild.textContent = 'Try again';
    } finally {
      skyLoad = null;
    }
  })();
  return skyLoad;
}

function locationStatus(message) {
  $('.am-location-status').textContent = message;
  $('.am-location-status').hidden = !message;
}
function locationBusy(busy) {
  for (const element of dialog.querySelectorAll('button:not(.am-location-cancel), input, select'))
    element.disabled = busy;
  if (!busy) coordinateInputs();
  dialog.setAttribute('aria-busy', String(busy));
}
function openLocation() {
  locationRequest++;
  locationBusy(false);
  locationStatus('');
  if (chosenLocation) fillLocation(chosenLocation);
  $('.am-location-cancel').hidden = !chosenLocation;
  if (!dialog.open) dialog.showModal();
}
function coordinateInputs() {
  const custom = $('#am-city').value === 'custom';
  $('.am-custom-location').hidden = !custom;
  $('#am-latitude').required = $('#am-longitude').required = custom;
  $('#am-place-name').disabled = $('#am-latitude').disabled = $('#am-longitude').disabled = !custom;
}
function fillLocation(location) {
  rememberedLocation = location;
  const city = cities[location.name];
  const knownCity = city && city[0] === location.latitude && city[1] === location.longitude;
  const savedOption = $('#am-city option[value="saved"]');
  savedOption.hidden = savedOption.disabled = Boolean(knownCity);
  savedOption.textContent = `${location.name} (saved location)`;
  $('#am-city').value = knownCity ? location.name : 'saved';
  $('#am-place-name').value = location.name;
  $('#am-latitude').value = location.latitude;
  $('#am-longitude').value = location.longitude;
  coordinateInputs();
}
function closeLocation() {
  dialog.close();
  const button = $('.am-location');
  // Return keyboard users to the location control without leaving a ring after pointer use or reload.
  if (keyboardNavigation) button.focus();
  else if (document.activeElement === button) button.blur();
}
async function loadLocationResources() {
  if (!locationResources) {
    const attempt = locationAttempt++;
    locationResources = Promise.all([
      import('./location.5fd3753e54ec.mjs' + (attempt ? `?retry=${attempt}` : '')),
      json('./assets/world.37dc5dbd0e1f.json'), json('./assets/land.c9a6b2b0c59c.json'),
    ]).catch((error) => {
      locationResources = null;
      throw error;
    });
  }
  return locationResources;
}
function locationLabel(location) {
  const time = $('.am-location time'), date = new Date(baseTime);
  let timeZone = location.timeZone;
  try { new Intl.DateTimeFormat('en', { timeZone }).format(date); }
  catch { timeZone = undefined; }
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(date);
  const timestamp = new Intl.DateTimeFormat('en-GB', {
    timeZone, dateStyle: 'long', timeStyle: 'short',
  }).format(date);
  $('[data-location-name]').textContent = location.name;
  $('.am-location').title = `${location.name} · ${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}° · Change location`;
  time.textContent = clock;
  time.dateTime = date.toISOString();
  time.title = `Sky snapshot · ${timestamp}`;
  time.setAttribute('aria-label', `Sky snapshot, ${timestamp}, for ${location.name}`);
  $('[data-help]').textContent = `North is up. The center is overhead and the ring is your horizon.
    Satellite positions are calculated for ${location.name} at ${date.toISOString()} from the recorded catalog.
    The globe is a contextual backdrop, not the ground positions of the satellites.
    The solid path shows the past five minutes; the dashed arrow predicts the next five minutes.
    Arrow keys select satellites by compass bearing. Decorative shimmer does not indicate naked-eye visibility.`;
}
async function applyLocation(location, request) {
  if (!ready) throw new Error('Sky unavailable');
  if (!location || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 ||
      !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180 ||
      typeof location.name !== 'string' || !location.name.trim() || location.name.length > 40)
    throw new Error('Invalid location');
  let nextObjects, earth;
  if (location.latitude === cities.Seoul[0] && location.longitude === cities.Seoul[1]) {
    nextObjects = snapshotObjects;
    earth = snapshotEarth;
  } else {
    const [tools, world, land] = await loadLocationResources();
    nextObjects = tools.skyForLocation(world, location);
    earth = tools.earthForLocation(land, location);
  }
  if (request !== locationRequest) return;
  interactionRevision++;
  const firstLocation = !chosenLocation;
  objects = nextObjects;
  frame.observer = location;
  chosenLocation = location;
  observer = { latitude: location.latitude * rad, longitude: location.longitude * rad, height: 0 };
  byId = new Map(objects.map((o) => [o.id, o]));
  if (firstLocation) restore();
  ordered = [...objects].sort((a, b) => a.azimuth - b.azimuth || a.id - b.id);
  discoveries = new Map(snapshotDiscoveries.filter((f) => byId.has(f.id)).map((f) => [f.id, f]));
  if (factData) {
    factLibrary = factTools.createLibrary(factData, objects);
    phone.dataset.factObjects = factLibrary.bySatellite.size;
  }
  Object.assign(state, validState(state));
  if (!state.selected) state.story = false;
  pathCache.clear();
  $('#am-land-shape').setAttribute('d', earth.land || '');
  $('.am-graticule').setAttribute('d', earth.graticule);
  $('.am-earth-edge').setAttribute('d', earth.sphere);
  phone.dataset.latitude = location.latitude;
  phone.dataset.longitude = location.longitude;
  $('.am-count').textContent = number(objects.length) + ' satellites above the horizon';
  $('.am-idle').textContent = objects.length ? 'Tap a satellite to explore.' : 'No satellites above this horizon in the recorded catalog.';
  $('.am-cool').disabled = objects.length < 2;
  locationLabel(location);
  width = 0;
  lastSolarMinute = null;
  sizeCanvas();
  updateSolar();
  render();
  if (state.selected) loadFacts();
  save();
  try { localStorage.setItem(locationKey, JSON.stringify(location)); } catch { /* Optional preference. */ }
  closeLocation();
}
async function chooseLocation(location, request = ++locationRequest) {
  locationBusy(true);
  locationStatus('Calculating your sky…');
  try {
    if (!ready) await loadSky();
    await applyLocation(location, request);
  } catch {
    if (request === locationRequest) {
      if (!dialog.open) openLocation();
      locationStatus('This sky could not load. Please try again or choose another location.');
    }
  } finally {
    if (request === locationRequest) locationBusy(false);
  }
}
$('.am-location').addEventListener('click', openLocation);
$('#am-city').addEventListener('change', coordinateInputs);
$('.am-location-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#am-city').value, city = cities[name];
  const location = name === 'saved' ? rememberedLocation : city ? { name, latitude: city[0], longitude: city[1], timeZone: city[2] } : {
    name: $('#am-place-name').value.trim() || 'My location',
    latitude: Number($('#am-latitude').value), longitude: Number($('#am-longitude').value),
  };
  chooseLocation(location);
});
$('.am-locate').addEventListener('click', async () => {
  const request = ++locationRequest;
  if (!navigator.geolocation || !window.isSecureContext) {
    locationStatus('Device location is unavailable here. Choose a city or enter coordinates instead.');
    return;
  }
  locationBusy(true);
  locationStatus('Waiting for your location…');
  try {
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      resolve, reject, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    ));
    if (request !== locationRequest) return;
    await chooseLocation({ name: 'Your location', latitude: position.coords.latitude,
      longitude: position.coords.longitude }, request);
  } catch (error) {
    if (request === locationRequest) locationStatus(error.code === 1
      ? 'Location permission was declined. Choose a city or enter coordinates instead.'
      : 'Your location could not be found. Choose a city or enter coordinates instead.');
  } finally {
    if (request === locationRequest) locationBusy(false);
  }
});
function cancelLocation(event) {
  if (!chosenLocation) { event?.preventDefault(); return; }
  locationRequest++;
  closeLocation();
  locationBusy(false);
}
dialog.addEventListener('cancel', cancelLocation);
$('.am-location-cancel').addEventListener('click', cancelLocation);
sky.addEventListener('click', (event) => {
  if (!ready) return;
  if (event.detail === 0) {
    next(1);
    return;
  }
  const rect = sky.getBoundingClientRect(),
    x = event.clientX - rect.left,
    y = event.clientY - rect.top;
  let nearest = null,
    distance = 22 * 22;
  for (const object of objects) {
    const d = ((object.x * rect.width) / 100 - x) ** 2 + ((object.y * rect.width) / 100 - y) ** 2;
    if (d < distance) {
      nearest = object;
      distance = d;
    }
  }
  if (nearest) select(nearest.id);
  else if (state.selected) select(null);
});
function next(delta) {
  const i = ordered.findIndex((o) => o.id === state.selected);
  const index =
    i < 0 ? (delta > 0 ? 0 : ordered.length - 1) : (i + delta + ordered.length) % ordered.length;
  select(ordered[index].id);
}
sky.addEventListener('keydown', (event) => {
  if (!ready) return;
  if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    next(event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
  }
  if (event.key === 'Escape') select(null);
});
$('.am-cool').addEventListener('click', () => {
  if (ready) discover();
  else loadSky();
});
new ResizeObserver(() => {
  if (ready && sizeCanvas()) {
    labelPosition();
    drawDots(performance.now());
    if (state.selected) drawTrail();
  }
}).observe(sky);
new IntersectionObserver((entries) => {
  intersects = entries[0].isIntersecting;
  if (active()) updateSolar();
  schedule();
}).observe(phone);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushSave();
  else updateSolar();
  schedule();
});
window.addEventListener('pagehide', flushSave);
motion.addEventListener('change', () => {
  if (ready) render();
});
setInterval(updateSolar, 15000);
async function start() {
  openLocation();
  // Location controls remain available after the recorded sky finishes loading.
  locationBusy(true);
  await loadSky();
  locationBusy(false);
  $('.am-locate').focus();
  if (!ready) {
    locationStatus('The sky could not load. Choose a location to try again.');
    return;
  }
  try {
    const saved = localStorage.getItem(locationKey);
    if (saved && saved.length < 1024) {
      const location = JSON.parse(saved);
      if (location && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 &&
          Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 &&
          typeof location.name === 'string' && location.name.trim() && location.name.length <= 40)
        // Remember the choice without proceeding before the visitor confirms it.
        fillLocation(location);
    }
  } catch { /* A first visit, invalid preferences, or unavailable storage opens the chooser. */ }
}
start();
