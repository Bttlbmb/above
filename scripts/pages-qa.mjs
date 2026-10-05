// Exercise the build under a project-site prefix, with no root-level asset fallback.
import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium, browserOptions, chooseSeoul } from './qa-runtime.mjs';

const root = await realpath(fileURLToPath(new URL('../docs/', import.meta.url)));
const types = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
};
const server = http.createServer(async (req, res) => {
  try {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    assert.ok(route.startsWith('/above/'));
    const relative = route.slice('/above/'.length) || 'index.html';
    const file = await realpath(path.resolve(root, relative));
    assert.ok(file.startsWith(root + path.sep));
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/above/`;
  browser = await chromium.launch(browserOptions);
  const report = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => errors.push(request.url()));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(url);
    await page.waitForSelector('.am-dots[data-drawn="1127"]');
    await chooseSeoul(page);
    for (let i = 0; i < 3; i++) {
      await page.locator('.am-cool').click();
      await page.waitForSelector('.am-phone[data-fact-objects="1115"]');
      const selected = await page.locator('.am-dots').getAttribute('data-selected');
      await page.waitForSelector(`.am-trail[data-selected="${selected}"]`);
      assert.equal(await page.locator('.am-trail').getAttribute('data-samples'), '121');
      assert.ok((await page.locator('[data-story]').textContent()).length > 30);
    }
    await page.reload();
    await page.waitForSelector('.am-dots[data-drawn="1127"]');
    await chooseSeoul(page);
    await page.waitForSelector('.am-trail[data-selected]');
    await page.locator('.am-location').click();
    await page.locator('#am-city').selectOption('London');
    await page.locator('.am-location-submit').click();
    await page.waitForSelector('.am-dots[data-drawn="1013"]');
    await page.waitForSelector('.am-location-dialog', { state: 'hidden' });
    await page.locator('.am-cool').click();
    await page.waitForSelector('.am-trail[data-selected]');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#am-city').value === 'London');
    await page.locator('.am-location-submit').click();
    await page.waitForSelector('.am-dots[data-drawn="1013"]');
    await page.waitForSelector('.am-trail[data-selected]');
    const urls = requests.filter((address) => /^https?:/.test(address));
    assert.ok(urls.every((address) => address.startsWith(url)), 'Assets must stay under /above/');
    for (const asset of ['sky', 'stars', 'style', 'app', 'solar', 'facts', 'orbits', 'satellite', 'location', 'world', 'land', 'geo'])
      assert.ok(urls.some((address) => address.includes(`/assets/${asset}.`)), asset);
    assert.deepEqual(errors, []);
    report.push({ width, projectPath: true, discoveries: 3, selectedPaths: true, reload: true,
      locationChange: true, globalAssetsUnderPrefix: true });
    await context.close();
  }
  console.log(JSON.stringify({ verified: true, report }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
