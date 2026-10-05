# Above

Above explores the satellites above your chosen location. On your first visit, choose **Use my location**, select a city, or enter coordinates. The satellite sky, globe, horizon count, and selected paths adjust to that observer. Click the location in the header to change it; your choice is remembered in this browser.

Every dot comes from the recorded active catalog, calculated at October 4, 2026, 01:05:38 UTC for your location. Tap one for its name, altitude, speed, and a reviewed fact. **Show me something cool** explores mission stories, while varying the objects and topics it selects. Arrow keys visit satellites in compass order; Escape clears the selection. Selection and recent discoveries are remembered in this browser.

## Two clocks, one view

The satellite sky stays at the recorded moment. The Earth lighting follows the device's current clock and refreshes each minute for the selected observer. The time beside the location and the date beneath the count belong to the satellite snapshot. City choices use that city's time zone; device and custom locations use the browser's time zone. This is a location-aware recorded sky, not current satellite tracking.

North is up, the center is overhead, and the ring marks the horizon. The globe provides geographic context. The dots show directions in the chosen observer's sky rather than locations on Earth's surface. The solid trail reconstructs the previous five minutes from the orbit model; the dashed arrow predicts the following five minutes from the same recorded inputs. Neither line is a telemetry record.

Altitude is height above Earth; elevation is angle above the horizon. Decorative shimmer and sunlight on the globe do not mean a satellite can be seen with the naked eye. Brightness, weather, and local obstructions are not modeled.

## Choose a location

**Use my location** asks the browser for a position after you press the button. If permission is declined, location services time out, or the browser cannot provide a position, the chooser stays open with city and coordinate alternatives. Device location requires HTTPS or localhost, as described in the [Geolocation specification](https://www.w3.org/TR/geolocation/). No external geocoding service is used.

Fourteen city centers are available, and **Another location** accepts any latitude from −90° to 90° and longitude from −180° to 180°, with an optional name. All calculations assume sea level and an unobstructed geometric horizon. Coordinates are saved only as a local browser preference and are not sent by the app to a server. If browser storage is blocked, the current session still works and the chooser returns on the next visit.

Seoul is one available example, not an inferred user location. Its preserved reference view contains 1,127 satellites. Other locations use the full recorded catalog rather than repositioning only those Seoul objects.

## Run locally

Use Node.js 22 or newer. Building and running require no dependency installation.

```sh
node scripts/build.mjs
node scripts/serve.mjs
```

Open `http://127.0.0.1:4174`. Set `PORT` to change the preview address. Edit `source/`, then rebuild `docs/`; generated filenames contain a content hash so changed assets receive a new address. The build removes obsolete generated assets and checks data consistency before writing them.

## Publish on GitHub Pages

The complete project and its Git history are backed up in [Bttlbmb/above](https://github.com/Bttlbmb/above). The site runs entirely from static files; it needs no OpenAI hosting, server, credentials, or dependency installation.

After making the repository public:

1. Open **Settings → Pages** and set **Build and deployment → Source** to **Deploy from a branch**.
2. Select branch **main** and folder **/docs**, then click **Save**.
3. Once GitHub finishes publishing, open [bttlbmb.github.io/above/](https://bttlbmb.github.io/above/).

The finished static site is committed in `docs/`. GitHub Pages publishes that folder after each push to `main`; there is no custom Actions workflow to configure or run. Source, evidence, tests, and documentation remain in the repository as a backup. Keep `main` as the default branch. No `gh-pages` branch or custom domain is needed.

To update the site, edit `source/`, run `node scripts/build.mjs` and the checks in [QA.md](QA.md), commit the source and regenerated `docs/`, then push to `main`. All asset addresses are relative, including lazy-loaded facts and orbital modules, so the build works beneath `/above/` and on a domain root. `docs/.nojekyll` marks the output as plain static files, so GitHub serves it without Jekyll processing. The `docs/` folder can also be uploaded to another static host.

GitHub's [publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) describes the branch and folder settings.

## Data and evidence

The recorded sky uses CelesTrak's [active-satellite GP catalog](https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json) and satellite.js 7.0.1. The full capture contains 16,636 records; 16,534 have usable orbital elements within 72 hours of the recorded instant. The build propagates these positions once, and the browser calculates which are above the selected observer's horizon. The original Seoul snapshot and its exact orbital inputs remain as a numerical reference and fast path. The browser can request device location, but does not download a current orbital feed.

The fact library contains 1,151 reviewed entries covering 1,115 distinct satellites: 1,115 individual catalog facts and 36 shared mission profiles. Shared profiles represent 35 stories, of which 32 qualify for discovery. Routine context remains available on direct selection. The other 12 Seoul reference objects have no fact in the expanded library. Reviewed facts remain linked to exact satellite identities; objects outside that reference population show orbital details without an invented story. Discovery choices are restricted to objects above the selected horizon.

Physical context comes from [Jonathan McDowell's GCAT](https://planet4589.org/space/gcat/). Mission stories cite individual agency, operator, or manufacturer sources. The compact runtime table preserves all 44 references and exact satellite associations. Estimated quantities and historical wording retain their qualifiers.

`evidence/reviewed-facts.json.gz` preserves the complete reviewed handoff. `evidence/fact-review.json.gz` retains identities, source mappings, review annotations, source-download hashes, and profiles outside this snapshot. Compression is lossless. The other evidence reports retain the original independent audits; they document the earlier review rather than a new factual investigation. Raw research downloads and intermediate drafts are not required by the app and have been removed. Source URLs and hashes remain available for a renewed source check.

To rebuild the compact library, run `node scripts/import-facts.mjs`. It uses the preserved compressed handoff and the exact CelesTrak identities in `evidence/orbital-identities.json`; it requires no sibling prototype or new download. An optional file argument accepts a reviewed JSON or gzip handoff. `--check` validates an import without changing files. The importer requires independent review, exact catalog and international identifiers, source links, and verified object associations. A future snapshot needs new orbital inputs, identities, and evidence together.

## Code and performance

| File                                    | Responsibility                                                        |
| --------------------------------------- | --------------------------------------------------------------------- |
| `source/index.html`, `source/style.css` | Interface, typography, palette, and accessible instructions           |
| `source/app.mjs`                        | Selection, saved preferences, animation, lighting, and selected paths |
| `source/facts.mjs`                      | Fact indexing, interest ranking, and discovery variety                |
| `source/solar.mjs`                      | Approximate solar geometry                                            |
| `source/data/sky.json`                  | Original sky positions and nine fallback discoveries                  |
| `source/data/orbits.json`               | Exact recorded Seoul reference orbital inputs                        |
| `source/data/catalog.json`              | Full recorded active catalog for any observer                        |
| `source/location.mjs`, `source/data/land.json` | Observer calculations and global globe projection               |
| `source/data/facts.json`                | Reviewed text, identifiers, groups, and references                    |
| `source/data/globe.json`                | Land geometry projected for the fixed Seoul observer                  |
| `source/assets/`, `source/vendor/`      | Star texture and pinned orbital library                               |
| `scripts/`                              | Build, import, preview, and verification tools                        |

The browser loads the reference sky first. Choosing another observer loads the precomputed global positions, land geometry and projection module. Facts load after interaction; orbital inputs load when a selected trail is needed. Trails outside the Seoul reference population also load the full catalog. Runtime tables omit repeated keys, and the built sky excludes the unused range column while retaining it in source. All application requests stay on the same origin. There is no framework, backend, external font, analytics, or runtime dependency CDN. The star background covers the entire viewport, including wide desktop screens.

The faint sky uses 32 cached drawing groups instead of rebuilding every dot path each frame. The selected highlight is separate. Canvas sizes change only when needed; hidden or offscreen views stop shimmer. Reduced motion also stops it, while lighting continues to follow the clock.

Earth geometry is shared between base and sunlit layers. Two 256 × 256 pixel buffers provide the lighting and land mask; they update each minute while visible, then catch up when the page returns. Old mask URLs are released. Selected trajectories use 121 samples, preserve failed-calculation gaps, refine horizon crossings, and retain an eight-object cache.

Solar direction follows [USNO's approximate algorithm](https://aa.usno.navy.mil/faq/sun_approx). The broad twilight wash and atmospheric glow are artistic choices around the calculated day/night boundary. Changing the observer rebuilds the globe projection and local sky directions together in the browser, and clears cached paths and lighting for the previous observer. The build rejects mismatched reference inputs.

The selected location and bounded exploration preferences are saved locally: the selected object and fact, library revision, and recent object, story, and family histories. The limits are 64 objects, 24 stories, and six families. Writes are batched, deduplicated, and flushed on leaving the page. A fact revision clears obsolete story indexes. The earlier visualization's saved selection can migrate after a successful replacement save. Blocked storage leaves interaction available in memory. Facts, paths, and orbital tables are never persisted in browser storage.

## Verification and limitations

Run `node scripts/solar-qa.mjs`, `node scripts/facts-qa.mjs`, and `node scripts/verify.mjs`. They check independent solar calculations, reviewed fact mappings, discovery variety, and deployable asset integrity. [Browser checks](QA.md) cover layout, paths, retries, preferences, motion, lighting, and automated accessibility.

If the fact library fails, the snapshot discoveries above the chosen horizon remain available and the next interaction retries. Objects without a reviewed story still expose their orbital details. If a path fails, details remain visible and another selection retries. Snapshot loading has a visible retry action; local JSON requests time out after eight seconds. The current clock must be accurate for Earth lighting. Modern browsers need modules, Canvas `Path2D`, native `dialog`, ResizeObserver, and IntersectionObserver. This is a fixed snapshot, so it does not become current tracking as time passes.

## Licenses

Natural Earth geometry is public domain. D3's geographic projection module runs locally for observer changes; topojson-client was used in the original geometry preparation. Their ISC notices remain. The inline Lucide icons use ISC, and satellite.js uses MIT. [Third-party notices](THIRD_PARTY_NOTICES.md) are copied into every build.

GCAT is © Jonathan McDowell under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its attribution remains in runtime data, evidence, and packaged notices. Mission text consists of original concise paraphrases of cited sources; those publishers retain their copyright.
