import { chromium, browserOptions, chooseSeoul, axePath } from './qa-runtime.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = new URL('../qa/button-anchor/', import.meta.url);
await mkdir(out, { recursive: true });
const json = async (name) => JSON.parse(await readFile(new URL('../source/data/' + name, import.meta.url), 'utf8'));
const sky = await json('sky.json'), library = await json('facts.json');
const objects = new Map(sky.objects.map((row) => {
  const object = Object.fromEntries(sky.fields.map((field, i) => [field, row[i]]));
  return [object.id, object];
}));
// Include every individual fact and each mission story with its longest applicable name.
const cases = library.facts.map((row) => ({ text: row[5], sources: row[6].map((i) => library.sources[i]), object: row[1].map((id) => objects.get(id))
  .reduce((a, b) => a.name.length >= b.name.length ? a : b) }));
const browser = await chromium.launch(browserOptions), report = [], errors = [];
try {
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width < 600 ? 950 : 1100 }, reducedMotion: 'reduce' });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:4174/');
    await page.waitForSelector('.am-dots[data-drawn]');
    await chooseSeoul(page);
    await page.locator('.am-cool').scrollIntoViewIfNeeded();
    const initial = await page.locator('.am-cool').boundingBox();
    const point = { x: initial.x + initial.width / 2, y: initial.y + initial.height / 2 };
    const tops = [initial.y];
    let previous = null;
    for (let i = 0; i < 32; i++) {
      // Keep the pointer stationary, as a person repeatedly clicking the same button would.
      await page.mouse.click(point.x, point.y);
      await page.waitForSelector('.am-cool:not(:disabled)');
      const id = await page.locator('.am-dots').getAttribute('data-selected');
      assert.ok(id && id !== previous, `${width}px: discovery missed the stationary pointer`);
      previous = id;
      tops.push((await page.locator('.am-cool').boundingBox()).y);
    }
    assert.ok(Math.max(...tops) - Math.min(...tops) < 0.5, `${width}px: button moved during discovery`);
    await page.locator('.am-phone').screenshot({ path: new URL(`card-${width}.png`, out).pathname });
    const allFacts = await page.evaluate((cases) => {
      const detail = document.querySelector('.am-detail'), story = document.querySelector('[data-story]'),
        button = document.querySelector('.am-cool'), reading = document.querySelector('.am-reading');
      const initialTop = button.getBoundingClientRect().top;
      let maxMove = 0, maxContentHeight = 0, minimumGap = Infinity;
      for (const { text, sources, object } of cases) {
        document.querySelector('[data-name]').textContent = object.name;
        document.querySelector('[data-id]').textContent = 'Catalog ' + object.id;
        document.querySelector('[data-elevation]').textContent = Math.round(object.elevation) + '° up';
        document.querySelector('[data-altitude]').textContent = Math.round(object.altitude).toLocaleString('en-US') + ' km above Earth';
        document.querySelector('[data-speed]').textContent = object.speed.toFixed(2) + ' km/s';
        document.querySelector('[data-range]').textContent = Math.round(object.range).toLocaleString('en-US') + ' km from you';
        const refs = document.querySelector('[data-sources]');
        refs.hidden = false;
        refs.replaceChildren();
        for (const source of sources) {
          const a = document.createElement('a');
          a.textContent = source.label;
          a.href = source.url;
          refs.append(document.createTextNode(refs.childNodes.length ? ' · ' : 'Source: '), a);
        }
        story.hidden = false;
        story.textContent = text;
        const b = button.getBoundingClientRect(), d = detail.getBoundingClientRect(), r = reading.getBoundingClientRect();
        maxMove = Math.max(maxMove, Math.abs(b.top - initialTop));
        maxContentHeight = Math.max(maxContentHeight, d.bottom - r.top);
        minimumGap = Math.min(minimumGap, b.top - d.bottom);
      }
      return { cases: cases.length, maxMove, maxContentHeight, minimumGap,
        reservedHeight: reading.getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth > innerWidth };
    }, cases);
    assert.ok(allFacts.maxMove < 0.5, `${width}px: current fact library exceeds reserved space: ${JSON.stringify(allFacts)}`);
    assert.ok(allFacts.minimumGap >= 24, 'Text must not overlap the button');
    assert.equal(allFacts.overflow, false);
    // Future longer copy and enlarged reading text must expand the card, with no clipping or inner scrolling.
    const expanded = await page.evaluate(() => {
      const phone = document.querySelector('.am-phone'), reading = document.querySelector('.am-reading');
      const before = phone.getBoundingClientRect().height;
      const sizes = [reading, ...reading.querySelectorAll('*')].map((el) => [el, parseFloat(getComputedStyle(el).fontSize)]);
      for (const [el, size] of sizes) el.style.fontSize = size * 2 + 'px';
      document.querySelector('[data-story]').textContent += ' ' + document.querySelector('[data-story]').textContent.repeat(4);
      return { before, after: phone.getBoundingClientRect().height,
        textBottom: document.querySelector('[data-story]').getBoundingClientRect().bottom,
        buttonTop: document.querySelector('.am-cool').getBoundingClientRect().top,
        phoneOverflow: phone.scrollHeight > phone.clientHeight + 1,
        innerScroll: reading.scrollHeight > reading.clientHeight + 1,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(expanded.after > expanded.before);
    assert.ok(expanded.buttonTop - expanded.textBottom >= 24);
    assert.equal(expanded.phoneOverflow || expanded.innerScroll || expanded.horizontalOverflow, false);
    await page.evaluate(await readFile(axePath(), 'utf8'));
    const violations = await page.evaluate(async () => (await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    })).violations.map((v) => v.id));
    assert.deepEqual(violations, []);
    report.push({ width, clicksAtFixedPoint: 32, buttonMovement: Math.max(...tops) - Math.min(...tops),
      allFacts, enlargedTextExpands: true, accessibilityViolations: 0 });
    await page.close();
  }
  assert.deepEqual(errors, []);
  const result = { verified: true, report, errors };
  await writeFile(new URL('report.json', out), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
