// Optional QA dependencies stay outside the browser application.
// Install Playwright and axe-core locally, or point the environment at an existing tool runtime.
import { createRequire } from 'node:module';

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  throw new Error(
    'Browser QA needs Playwright. Install it locally or set PLAYWRIGHT_PACKAGE to its package.json.',
  );
}
export const { chromium } = playwright;
export const browserOptions = {
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
};
export function axePath() {
  return process.env.AXE_PATH || require.resolve('axe-core/axe.min.js');
}
