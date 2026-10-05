import { chromium, browserOptions, chooseSeoul } from './qa-runtime.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = new URL('../qa/current/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch(browserOptions),
  views = [];
try {
  for (const [name, width, height] of [
    ['phone', 390, 1100],
    ['desktop', 1280, 1000],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: name === 'phone' ? 2 : 1,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
    });
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:4174/');
    await page.waitForSelector('.am-dots[data-drawn="1127"]');
    await chooseSeoul(page);
    await page.waitForFunction(() =>
      document.querySelector('[data-land-mask]').getAttribute('href')?.startsWith('blob:'),
    );
    if (name === 'phone')
      await page
        .locator('.am-phone')
        .screenshot({ path: new URL('orbital-dawn-phone-idle.png', output).pathname });
    await page.locator('.am-cool').click();
    await page.waitForSelector('.am-trail[data-selected]');
    if (name === 'phone') {
      await page.locator('.am-cool').click();
      await page.waitForSelector('.am-trail[data-selected]');
    }
    const view = await page.evaluate(() => {
      const phone = document.querySelector('.am-phone'),
        dots = document.querySelector('.am-dots'),
        light = document.querySelector('.am-earth-light'),
        style = getComputedStyle(phone);
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        objects: +dots.dataset.drawn,
        selected: +dots.dataset.selected,
        samples: +document.querySelector('.am-trail').dataset.samples,
        clock: +light.dataset.solarTime,
        sunDirection: [+light.dataset.lightEast, +light.dataset.lightNorth, +light.dataset.lightUp],
        palette: Object.fromEntries(
          ['bg', 'text', 'muted', 'line', 'accent', 'dot'].map((k) => [
            k,
            style.getPropertyValue('--am-' + k).trim(),
          ]),
        ),
      };
    });
    assert.equal(view.objects, 1127);
    assert.equal(view.samples, 121);
    assert.equal(view.overflow, false);
    assert.equal(view.palette.accent, '#f5bd8e');
    assert.ok(Math.abs(view.clock - Date.now()) < 60000);
    const screenshot = { path: new URL(`orbital-dawn-${name}.png`, output).pathname };
    if (name === 'phone') await page.locator('.am-phone').screenshot(screenshot);
    else await page.screenshot({ ...screenshot, fullPage: true });
    views.push({ name, ...view });
    await page.close();
  }
  await writeFile(
    new URL('palette-review.json', output),
    JSON.stringify({ capturedAt: new Date().toISOString(), views }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        views,
        screenshots: [
          'orbital-dawn-phone-idle.png',
          'orbital-dawn-phone.png',
          'orbital-dawn-desktop.png',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
