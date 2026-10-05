import { chromium, browserOptions } from './qa-runtime.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
const name = 'current';
const output = new URL('../qa/current/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch(browserOptions);
const runs = [];
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 1100 },
      colorScheme: 'dark',
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Date.now = () => Date.parse('2026-10-04T03:00:00Z');
      window.__perf = { arcs: 0, fills: 0, lightUpdates: 0, raf: [], writes: 0 };
      const p = CanvasRenderingContext2D.prototype;
      for (const key of ['arc', 'fill', 'putImageData']) {
        const original = p[key];
        p[key] = function (...args) {
          if (this.canvas.classList.contains('am-dots'))
            window.__perf[key === 'arc' ? 'arcs' : 'fills']++;
          if (key === 'putImageData' && this.canvas.classList.contains('am-earth-light'))
            window.__perf.lightUpdates++;
          return original.apply(this, args);
        };
      }
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (fn) =>
        request((time) => {
          const canvas = document.querySelector('.am-dots'),
            before = canvas?.dataset.frame,
            start = performance.now();
          fn(time);
          if (canvas?.dataset.frame !== before) window.__perf.raf.push(performance.now() - start);
        });
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) {
        window.__perf.writes++;
        return write.apply(this, args);
      };
    });
    const responses = [];
    page.on('response', (r) => responses.push(r));
    const started = Date.now();
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:4174/');
    const target = page;
    await target.waitForSelector('.am-dots[data-drawn="1127"]');
    const firstSkyMs = Date.now() - started;
    await page.waitForTimeout(150);
    await target.evaluate(() => {
      __perf.arcs = 0;
      __perf.fills = 0;
      __perf.raf = [];
      __perf.lightUpdates = 0;
    });
    await page.waitForTimeout(1500);
    const idle = await target.evaluate(() => ({
      ...__perf,
      frameCount: document.querySelector('.am-dots').dataset.frame,
    }));
    const initialResponses = responses.filter((r) => /^https?:/.test(r.url()));
    await target.evaluate(() => {
      window.__earthMutations = 0;
      new MutationObserver(
        (r) => (window.__earthMutations += r.filter((m) => m.type === 'childList').length),
      ).observe(document.querySelector('.am-earth'), { childList: true, subtree: true });
      __perf.lightUpdates = 0;
    });
    await target.locator('.am-cool').click();
    await target.waitForSelector('.am-trail[data-selected]');
    await page.waitForTimeout(100);
    const selected = await target
      .evaluate(() => ({
        lightUpdates: __perf.lightUpdates,
        earthGeometryMutations: window.__earthMutations,
        storageBytes: Object.keys(localStorage).reduce(
          (sum, key) => sum + key.length + localStorage.getItem(key).length,
          0,
        ),
      }))
      .catch(() =>
        target.evaluate(() => ({
          lightUpdates: __perf.lightUpdates,
          earthGeometryMutations: window.__earthMutations,
          storageBytes: null,
        })),
      );
    const heap = await page
      .context()
      .newCDPSession(page)
      .then((s) => s.send('Runtime.getHeapUsage'));
    const sizes = await Promise.all(
      responses.map(async (r) => {
        try {
          return { url: r.url(), bytes: (await r.body()).length };
        } catch {
          return null;
        }
      }),
    );
    if (run === 0)
      await target
        .locator('.am-phone')
        .screenshot({ path: new URL(`${name}-selected-390.png`, output).pathname });
    const initialNetworkBytes = (
      await Promise.all(
        initialResponses.map(async (r) => {
          try {
            return (await r.body()).length;
          } catch {
            return 0;
          }
        }),
      )
    ).reduce((s, n) => s + n, 0);
    const networkBytes = sizes
      .filter((r) => r && /^https?:/.test(r.url))
      .reduce((s, r) => s + r.bytes, 0);
    const cpu = idle.raf.reduce((s, v) => s + v, 0),
      result = {
        firstSkyMs,
        initialNetworkBytes,
        networkBytes,
        idleDraws: idle.raf.length,
        idleCanvasArcCalls: idle.arcs,
        idleCanvasFillCalls: idle.fills,
        idleDrawCpuMs: cpu,
        meanDrawCpuMs: idle.raf.length ? cpu / idle.raf.length : 0,
        ...selected,
        heapUsedBytes: heap.usedSize,
        resources: sizes.filter(Boolean),
      };
    runs.push(result);
    await context.close();
  }
  const html = await readFile(new URL('../docs/index.html', import.meta.url));
  const report = {
    name,
    htmlBytes: html.length,
    htmlGzipBytes: gzipSync(html).length,
    htmlBrotliBytes: brotliCompressSync(html).length,
    runs,
  };
  await writeFile(new URL(`performance-${name}.json`, output), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ...report,
        runs: runs.map(({ resources, ...r }) => ({
          ...r,
          resourceCount: resources.length,
          resourceBytes: resources.reduce((s, r) => s + r.bytes, 0),
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
