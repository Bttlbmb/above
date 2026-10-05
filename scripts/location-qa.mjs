import { chromium, browserOptions, axePath } from './qa-runtime.mjs';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { skyForLocation } from '../source/location.mjs';
const url = process.env.QA_URL || 'http://127.0.0.1:4174/';
const out = new URL('../qa/location/', import.meta.url);
await mkdir(out, { recursive: true });
const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const refs = await read('../evidence/location-reference.json');
const original = await read('../source/data/sky.json');
const files = await readdir(new URL('../docs/assets/', import.meta.url));
const world = await read('../docs/assets/' + files.find((f) => /^world\./.test(f)));
const browser = await chromium.launch(browserOptions), errors = [], report = [];
async function choose(page, name) {
  await page.locator('#am-city').selectOption(name);
  await page.locator('.am-location-submit').click();
  await page.waitForSelector('.am-location-dialog', { state: 'hidden' });
}
async function axe(page) {
  await page.evaluate(await readFile(axePath(), 'utf8'));
  const result = await page.evaluate(() => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  }));
  assert.deepEqual(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), []);
}
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 950 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('.am-dots[data-drawn]');
  assert.equal(await page.locator('.am-location-dialog').isVisible(), true);
  assert.equal(await page.locator('.am-locate').evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.am-location-dialog').isVisible(), true);
  await axe(page);
  await page.screenshot({ path: new URL('startup.png', out).pathname });
  for (const place of refs.places) {
    if (!(await page.locator('.am-location-dialog').isVisible())) await page.locator('.am-location').click();
    await choose(page, place.name);
    assert.equal(Number(await page.locator('.am-dots').getAttribute('data-drawn')), place.aboveHorizon);
    assert.equal(await page.locator('[data-location-name]').textContent(), place.name);
    assert.equal(Number(await page.locator('.am-phone').getAttribute('data-latitude')), place.latitude);
    assert.equal(Number(await page.locator('.am-phone').getAttribute('data-longitude')), place.longitude);
    await page.locator('.am-cool').click();
    await page.waitForSelector('.am-cool:not(:disabled)');
    const id = Number(await page.locator('.am-dots').getAttribute('data-selected'));
    assert.ok(skyForLocation(world, place).some((o) => o.id === id), `${place.name}: selected ${id}`);
    await page.waitForSelector(`.am-trail[data-selected="${id}"]`);
    assert.equal(await page.locator('.am-trail').getAttribute('data-samples'), '121');
    report.push({ city: place.name, count: place.aboveHorizon, discoveryAboveHorizon: true });
  }
  await page.locator('.am-location').click();
  await choose(page, 'New York');
  const objects = skyForLocation(world, refs.places.find((p) => p.name === 'New York'));
  const ids = new Set(original.objects.map((o) => o[0]));
  const target = objects.find((o) => !ids.has(o.id) && o.elevation > 10);
  const size = await page.locator('.am-sky').evaluate((el) => el.clientWidth);
  await page.locator('.am-sky').click({ position: { x: target.x * size / 100, y: target.y * size / 100 } });
  assert.equal(Number(await page.locator('.am-dots').getAttribute('data-selected')), target.id);
  await page.waitForSelector(`.am-trail[data-selected="${target.id}"]`);
  const zero = await page.locator('.am-trail').evaluate((el) => [Number(el.dataset.zeroX), Number(el.dataset.zeroY)]);
  assert.ok(Math.hypot(zero[0] - target.x, zero[1] - target.y) < 1e-8);
  await page.reload();
  await page.waitForSelector(`.am-trail[data-selected="${target.id}"]`);
  assert.equal(await page.locator('.am-location-dialog').isVisible(), false);
  assert.equal(await page.locator('[data-location-name]').textContent(), 'New York');
  await axe(page);
  for (const [width, height] of [[320, 844], [390, 950], [1920, 1080], [4158, 2126]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bg = await page.evaluate(() => {
      const s = getComputedStyle(document.body, '::before');
      return { size: s.backgroundSize, left: s.left, right: s.right };
    });
    assert.deepEqual(bg, { size: 'cover', left: '0px', right: '0px' });
    await page.screenshot({ path: new URL(`view-${width}.png`, out).pathname });
    await page.locator('.am-location').click();
    await page.screenshot({ path: new URL(`chooser-${width}.png`, out).pathname });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('.am-location-cancel').click();
  }
  await page.locator('.am-location').click();
  await page.locator('#am-city').selectOption('custom');
  await page.locator('#am-place-name').fill('North Pole');
  await page.locator('#am-latitude').fill('91');
  await page.locator('#am-longitude').fill('180');
  await page.locator('.am-location-submit').click();
  assert.equal(await page.locator('.am-location-dialog').isVisible(), true);
  await page.locator('#am-latitude').fill('90');
  await page.locator('.am-location-submit').click();
  await page.waitForSelector('.am-location-dialog', { state: 'hidden' });
  assert.equal(await page.locator('[data-location-name]').textContent(), 'North Pole');
  await context.close();
  const allowed = await browser.newContext({ geolocation: { latitude: 51.5074, longitude: -0.1278 }, permissions: ['geolocation'] });
  const located = await allowed.newPage();
  await located.goto(url);
  await located.locator('.am-locate').click();
  await located.waitForSelector('.am-location-dialog', { state: 'hidden' });
  assert.equal(await located.locator('[data-location-name]').textContent(), 'Your location');
  assert.equal(await located.locator('.am-dots').getAttribute('data-drawn'), '1013');
  await allowed.close();
  for (const code of [1, 2, 3]) {
    const denied = await browser.newContext({ viewport: { width: 320, height: 844 } });
    const fallback = await denied.newPage();
    await fallback.addInitScript((code) => {
      navigator.geolocation.getCurrentPosition = (_, fail) => fail({ code });
    }, code);
    await fallback.goto(url);
    await fallback.locator('.am-locate').click();
    assert.equal(await fallback.locator('.am-location-dialog').isVisible(), true);
    assert.match(await fallback.locator('.am-location-status').textContent(), /Choose a city/);
    await choose(fallback, 'London');
    assert.equal(await fallback.locator('.am-dots').getAttribute('data-drawn'), '1013');
    await denied.close();
  }
  const retryContext = await browser.newContext();
  const retry = await retryContext.newPage();
  let attempts = 0;
  await retry.route('**/world.*.json', (r) => ++attempts === 1
    ? r.fulfill({ status: 503, body: 'unavailable' }) : r.continue());
  await retry.goto(url);
  await retry.locator('#am-city').selectOption('London');
  await retry.locator('.am-location-submit').click();
  await retry.waitForFunction(() => document.querySelector('.am-location-status').textContent.includes('could not load'));
  assert.equal(await retry.locator('.am-location-dialog').isVisible(), true);
  await choose(retry, 'London');
  assert.equal(attempts, 2);
  await retryContext.close();
  assert.deepEqual(errors, []);
  const result = { verified: true, report, startupChooser: true, geolocation: true,
    deniedAndTimeoutFallbacks: true, outsideReferenceTrail: true, rememberedLocationAndSelection: true,
    globalDataRetry: true, widths: [320, 390, 1920, 4158], accessibilityViolations: 0, errors };
  await writeFile(new URL('report.json', out), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
