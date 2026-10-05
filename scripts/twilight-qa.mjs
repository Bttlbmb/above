import { chromium, browserOptions } from './qa-runtime.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url),
  out = new URL('qa/current/twilight/', root);
await mkdir(out, { recursive: true });
const url = process.env.QA_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch(browserOptions);
const errors = [],
  views = [],
  lighting = [],
  times = {
    sunrise: '2026-10-04T21:30:00Z',
    day: '2026-10-05T03:00:00Z',
    sunset: '2026-10-05T08:00:00Z',
    night: '2026-10-05T15:00:00Z',
  },
  reference = new URL('../tests/fixtures/twilight-globe.png', import.meta.url);
const ready = async (page) => {
  await page.waitForSelector('.am-dots[data-drawn="1127"]');
  await page.waitForFunction(() =>
    document.querySelector('[data-land-mask]').getAttribute('href')?.startsWith('blob:'),
  );
};
const fixtures = [
  [320, 740, 2],
  [360, 800, 3],
  [375, 812, 3],
  [390, 844, 2],
  [414, 896, 3],
  [430, 932, 3],
  [600, 960, 2],
  [768, 1024, 2],
  [1024, 768, 1],
  [1280, 800, 1],
  [1440, 900, 2],
  [1920, 1080, 1],
  [2560, 1440, 1],
  [844, 390, 3],
  [390, 844, 1],
  [390, 844, 3],
];
try {
  for (const [width, height, dpr] of fixtures) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.install({ time: new Date(times.sunset) });
    await page.goto(url);
    await ready(page);
    const name = `${width}x${height}-${dpr}x`,
      geometry = await page.evaluate(() => {
        const sky = document.querySelector('.am-sky').getBoundingClientRect(),
          phone = document.querySelector('.am-phone').getBoundingClientRect(),
          header = document.querySelector('.am-header').getBoundingClientRect(),
          loc = document.querySelector('.am-location').getBoundingClientRect();
        const relative = (selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {
            left: r.left - sky.left,
            top: r.top - sky.top,
            width: r.width,
            height: r.height,
          };
        };
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          phoneFits: phone.left >= 0 && phone.right <= innerWidth,
          headerFits: loc.left >= header.left && loc.right <= header.right + 0.5,
          square: Math.abs(sky.width - sky.height) < 0.5,
          globeWidth: sky.width,
          earth: relative('.am-earth'),
          light: relative('.am-earth-light'),
          objects: +document.querySelector('.am-dots').dataset.drawn,
          buffers: document.querySelector('.am-earth-light').width,
        };
      });
    assert.equal(geometry.overflow, false);
    assert.equal(geometry.phoneFits, true);
    assert.equal(geometry.headerFits, true);
    assert.equal(geometry.square, true);
    assert.equal(geometry.objects, 1127);
    assert.deepEqual(geometry.earth, geometry.light);
    assert.equal(geometry.buffers, 256);
    await page.locator('.am-phone').screenshot({ path: new URL(`${name}-idle.png`, out).pathname });
    await page.screenshot({ path: new URL(`${name}-viewport.png`, out).pathname, fullPage: true });
    await page.locator('.am-cool').click();
    await page.waitForSelector('.am-trail[data-selected]');
    assert.equal(await page.locator('.am-trail').getAttribute('data-samples'), '121');
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page
      .locator('.am-phone')
      .screenshot({ path: new URL(`${name}-selected.png`, out).pathname });
    views.push({ width, height, dpr, ...geometry, pathSamples: 121 });
    await page.close();
  }
  for (const [time, iso] of Object.entries(times))
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
        colorScheme: 'dark',
      });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.clock.install({ time: new Date(iso) });
      await page.goto(url);
      await ready(page);
      await page
        .locator('.am-sky')
        .screenshot({ path: new URL(`${time}-${width}-globe.png`, out).pathname });
      const clock = +(await page.locator('.am-earth-light').getAttribute('data-solar-time'));
      assert.ok(Math.abs(clock - Date.parse(iso)) < 60000);
      lighting.push({ time, width, clock });
      await page.close();
    }
  // Compare the shipped rendering to the approved screenshot at its original viewport.
  const page = await browser.newPage({
    viewport: { width: 430, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  await page.clock.install({ time: new Date(times.sunset) });
  await page.goto(url);
  await ready(page);
  const actual = await page.locator('.am-sky').screenshot(),
    approved = await readFile(reference);
  const comparison = await page.evaluate(
    async ({ actual, approved }) => {
      const load = async (base64) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + base64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return {
          width: img.width,
          height: img.height,
          data: ctx.getImageData(0, 0, img.width, img.height).data,
        };
      };
      const a = await load(actual),
        b = await load(approved);
      if (a.width !== b.width || a.height !== b.height) return { sameSize: false };
      let sum = 0,
        count = 0;
      // Interior comparison excludes the original low-resolution atmospheric rim and SVG coastline edges.
      for (let y = 0; y < a.height; y++)
        for (let x = 0; x < a.width; x++)
          if (Math.hypot(x - a.width / 2, y - a.height / 2) < a.width * 0.34) {
            const i = (y * a.width + x) * 4;
            for (let k = 0; k < 3; k++) {
              sum += Math.abs(a.data[i + k] - b.data[i + k]);
              count++;
            }
          }
      return { sameSize: true, meanInteriorChannelDifference: sum / count };
    },
    { actual: actual.toString('base64'), approved: approved.toString('base64') },
  );
  assert.equal(comparison.sameSize, true);
  assert.ok(
    comparison.meanInteriorChannelDifference < 2,
    'Shipped twilight should visually agree with the approved prototype',
  );
  await page.close();
  assert.deepEqual(errors, []);
  const cards = [
    ['Small phone', '320 × 740 · 2×', '320x740-2x-idle.png'],
    ['Phone', '390 × 844 · 3×', '390x844-3x-idle.png'],
    ['Tablet', '768 × 1024 · 2×', '768x1024-2x-idle.png'],
    ['Desktop', '1440 × 900 · 2×', '1440x900-2x-idle.png'],
  ];
  const imgs = await Promise.all(
    cards.map(
      async ([title, caption, file]) =>
        `<article><h2>${title}</h2><p>${caption}</p><img alt="${title}" src="data:image/png;base64,${(await readFile(new URL(file, out))).toString('base64')}"></article>`,
    ),
  );
  const board = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Above · Twilight at every size</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#0b1220;color:#f5f1e9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{margin-bottom:28px}header>span{font-size:10px;letter-spacing:1.5px;color:#f5bd8e}h1{font-size:27px;font-weight:450;letter-spacing:-.7px;margin:10px 0}header p,article p{font-size:12px;color:#a9b4c4;margin:8px 0 16px}h2{font-size:17px;font-weight:450;margin:0}section{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}img{display:block;width:100%;border-radius:18px}footer{font-size:11px;color:#8390a4;margin-top:24px}</style><body><header><span>ABOVE / IMPLEMENTED TWILIGHT</span><h1>A quiet glow, at every size.</h1><p>The approved wider band at 30% intensity · actual app screenshots at the same sunset.</p></header><section>${imgs.join('')}</section><footer>16 viewport / pixel-density combinations, from 320 to 2560 pixels wide. Sunrise, midday, sunset, night, and satellite selection also checked.</footer></body></html>`;
  await writeFile(new URL('resolution-review.html', out), board);
  const boardPage = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });
  await boardPage.setContent(board);
  await boardPage.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
  await boardPage.screenshot({ path: new URL('resolutions.png', out).pathname, fullPage: true });
  await boardPage.close();
  const report = {
    capturedAt: new Date().toISOString(),
    errors,
    views,
    lighting,
    approvedPrototypeComparison: comparison,
  };
  await writeFile(
    new URL('twilight-review.json', new URL('qa/current/', root)),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        viewports: views.length,
        lightingViews: lighting.length,
        errors,
        approvedPrototypeComparison: comparison,
        resolutions: new URL('resolutions.png', out).pathname,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
