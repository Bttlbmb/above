# Verification

Run the build before checking the deployed files. The solar and fact checks need only Node.js; browser checks additionally use the optional tools below.

```sh
node scripts/build.mjs
node scripts/solar-qa.mjs
node scripts/facts-qa.mjs
node scripts/verify.mjs
node scripts/import-facts.mjs --check
```

The solar check compares 120 hourly samples with an independent Meeus/NOAA calculation and checks polar geometry. The fact check verifies source and review mappings, direct access to all 1,115 individual facts, discovery ranking, and 80 choices with bounded histories.

## Browser tools

Browser checks use Playwright and axe-core as optional development tools. They never enter the hosted application. The audited environment used Playwright 1.62.1 and axe-core 4.10.3. Install tools locally, or point at an existing installation:

```sh
npm install --no-save --package-lock=false playwright@1.62.1 axe-core@4.10.3
npx playwright install chromium
```

`PLAYWRIGHT_PACKAGE` selects the absolute path to an installed Playwright `package.json`. `CHROMIUM_PATH` selects an installed Chrome or Chromium executable, and `AXE_PATH` selects `axe.min.js`. Without overrides, the scripts use the local packages and Playwright's browser. `QA_URL` selects a preview address. Start the appropriate preview server before running browser checks.

Automated accessibility scans are useful evidence, but they do not replace keyboard and screen-reader testing. These checks use Chromium; Safari, Firefox, and physical devices need separate verification.

## Checks

- `node scripts/browser-qa.mjs` checks 320/390/736 px layouts, an independent globe projection, minute and date rollover, 121-sample trails, fact selection and provenance, saved preferences and migration, denied storage, loading retries, automatic shimmer, reduced motion, same-origin requests, and automated accessibility. It includes an 80-click discovery session.
- `node scripts/twilight-qa.mjs` checks 16 viewport and pixel-density combinations, four lighting phases, globe alignment, and selection. It compares the globe interior with `tests/fixtures/twilight-globe.png`, the retained approved reference.
- `node scripts/performance-qa.mjs` records three fresh sessions: initial and selected asset sizes, drawing work and time, heap use, geometry changes, and saved preferences. It measures the current app; old wrapper comparisons have been removed.
- `node scripts/capture-palette.mjs` captures current-clock phone and desktop views and checks colors, object count, paths, and overflow.

Generated reports and screenshots stay in ignored `qa/`. Fixed lighting fixtures make visual comparisons repeatable. Timing and heap figures describe the test machine and browser; they are not promises about phones or hosted networks.
