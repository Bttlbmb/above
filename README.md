# Above · Living Earth

A private, static, interactive demonstration of the cinematic Living Earth satellite-sky design. Open the page to see a gently shimmering satellite field and Earth lighting for the current time in Seoul; tap a dot for its recorded position and past/next five-minute trajectory. No backend, accounts, analytics or location request is required by this demonstration.

The Orbital Dawn palette uses a navy background and surface, blue satellite dots, warm off-white text and peach highlights. The globe's RGB shading uses the same palette: blue oceans, peach sunlit land and a subtle warm atmospheric rim. This changes only visual colors; current solar direction, lighting timing and geometric boundaries are preserved. The favicon keeps its original orbit motif in the new colors.

A static, irregular star texture adds quiet detail to the outer page and faint highlights to the card. It replaces the regular dot grid, uses one 30,046-byte WebP without new animation or JavaScript, and stays behind the opaque sky chart and controls. Card blending leaves the original navy surface unchanged. The texture is decorative and generated, not an astronomically mapped star field. `evidence/star-texture.json` records the exact built-in image-generation prompt, input/output hashes, dimensions and encoding settings.

## Scope and data

This is a recorded design demo, not the live-location satellite app. The sky contains 1,127 active-catalog satellites above Seoul's geometric horizon at **2026-10-04 01:05:38 UTC** (10:05 KST), observer 37.5665° N, 126.978° E at sea level. Orbital coordinates remain at that snapshot while decorative shimmer animates and Earth lighting follows the current clock. Names and catalog numbers come from CelesTrak; altitude, speed, bearing and elevation are calculated using satellite.js 7.0.1. Mission stories use the reviewed official sources below. Country, launch and brightness facts are not inferred.

CelesTrak's [active GP catalog](https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json), obtained on October 4, 2026, was propagated client-side using SGP4; records outside a 72-hour freshness window or with invalid propagation were excluded. The snapshot and minimal orbital inputs are bundled as lossless compact JSON tables. The demo makes no fresh CelesTrak request. CelesTrak [GP documentation](https://celestrak.org/NORAD/documentation/gp-data-formats.php) and [usage policy](https://celestrak.org/usage-policy.php) govern source format and retrieval frequency.

Satellite dots use user-relative azimuth/elevation. The faint Earth is geographical context, not the geographic positions of the satellite dots. Selected paths contain 121 SGP4 samples over ten minutes, retain invalid gaps, refine horizon crossings and clip below the horizon. Solid means reconstructed past; dashed and an arrow mean predicted future. Apparent slow motion stays at true scale.

**Show me something cool** selects from **32 distinct reviewed mission stories** associated with this recorded sky. Exceptional stories rank ahead of ordinary mission stories; routine catalog context is excluded. Selection skips the current object, prefers objects at least 10° up, remembers 64 recent objects and 24 recent story IDs, and balances six recent mission families. Shared constellation stories count as one story, so hundreds of similar satellites do not dominate the button. These are bounded recency rules, not a guarantee of a complete ordered tour.

A direct tap or keyboard selection shows an individual catalog fact when one is verified. The library covers **1,115 distinct satellites** with 1,115 individual context facts and 36 applicable shared profiles (35 shared stories, including three context stories). Twelve catalog identities were missing or conflicting and receive no new factual assertion; their original dots and calculated orbital information remain. The research handoff also contains 31 reviewed profiles outside this sky, retained in the source evidence and omitted from runtime data.

Each displayed fact has discreet source links, one per publisher. The full supporting references, scope, estimate flags and independent review are preserved in the source evidence. Catalog mass and dimension statements retain the catalog's estimate labels and avoid treating an ambiguous body dimension as length or diameter. Mission descriptions distinguish historical achievements, design capability and constellation-level properties; they do not assert current health or service status. No purpose is guessed from a name or orbit.

### Fact review and provenance

The frozen research handoff was reviewed on October 4, 2026. Its SHA-256 is `8c9a572706630ad0a763352ed01cbf189bf2808882d23a74b3911cf8edc54b32`. Every imported fact and profile requires a verified status and an independent reviewer distinct from its researcher. The importer checks each exact NORAD/COSPAR identity against the original saved CelesTrak GP catalog, checks the recorded name, and verifies every profile-to-satellite association. Rejected drafts are not imported.

Individual physical context comes from [Jonathan McDowell's General Catalog of Artificial Space Objects (GCAT)](https://planet4589.org/space/gcat/). Mission profiles use agency or operator sources, including [ESA's Proba-3 artificial eclipse](https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Proba-3_s_first_artificial_solar_eclipse), [NASA's THEMIS mission](https://science.nasa.gov/mission/THEMIS/), [Japan's QZSS service explanation](https://qzss.go.jp/en/overview/services/sv02_why.html) and [Northrop Grumman's satellite servicing](https://www.northropgrumman.com/what-we-do/space/space-logistics-services). All 44 runtime references are in `source/data/facts.json`.

`evidence/fact-review.json` retains exact identities, record-level reviews, supporting references, scope, interest classifications, source download hashes, licensing and the unused profiles. `evidence/assembly-audit.json`, `evidence/catalog-audit.json` and `evidence/report.json` preserve the independent research audits. This evidence is committed with the source and excluded from the hosted runtime. Large source downloads remain in the ignored research directory. The original nine reviewed snapshot discoveries are retained as a loading-failure fallback; calculated orbital periods there are approximate (1,440 minutes divided by catalog mean motion).

## Earth lighting

The Sun's position uses [USNO's approximate solar algorithm](https://aa.usno.navy.mil/faq/sun_approx), sidereal rotation and observer-relative geometry. The runtime calculates only the current Sun direction; the removed sunrise/sunset time interface no longer triggers daily event searches. The solar helper retains its event calculation for independent mathematical verification, using [USNO's sea-level, unobstructed-horizon convention](https://aa.usno.navy.mil/faq/RST_defs).

Earth lighting starts at the browser's current clock and refreshes each minute, including with shimmer paused or reduced motion enabled. It catches up when the page returns to view. The clock is the only lighting time source; older saved times are ignored. The device clock is assumed to be accurate. The satellite snapshot keeps its separate recorded-time label.

Published Natural Earth land geometry was preprojected once with D3 7.9.0 and topojson-client 3.1.0 for the fixed Seoul observer. The browser reuses these SVG paths, with one land definition shared by the base and sunlit layers. A 256 × 256 lighting canvas uses the calculated Sun direction and globe surface normals. A smooth light-to-dark fade, artistic surface brightness and a narrow atmospheric glow add depth. A matching luminance mask brightens sunlit land. Brightness and bloom are aesthetic choices, not physical visibility predictions. The decorative shimmer does not imply naked-eye visibility.

A small pause/play icon in the header stops decorative shimmer, and reduced-motion preference disables it automatically. The sky flows directly into the selected object’s details; projection captions, sun-time labels, path legends and explanatory backdrop notes are omitted from the visual interface. Screen-reader instructions retain the projection and path conventions, and a hidden status announces path failures. Hidden/offscreen pages do not redraw shimmer; Earth shading updates with clock changes rather than every animation frame. Keyboard arrows select satellites by compass bearing and Escape clears selection. Selection and motion preferences are saved only on this browser.

## Architecture, setup and hosting

The app is native static HTML, CSS, JavaScript modules and JSON. There is no iframe, generic visualization wrapper, icon package, D3 or topojson runtime, framework, backend, analytics, external font or API key. All runtime requests stay on the Site's origin. Inline SVG icons replace the previous full icon-library download. `.openai/hosting.json` declares static `dist` output; the existing private Site and its access settings are preserved.

- `source/index.html` and `source/style.css` contain the minimal interface.
- `source/app.mjs` owns selection, accessibility, animation, lighting and lazy path calculation.
- `source/facts.mjs` indexes the verified library and ranks interest, story novelty and family variety. It loads only on first interaction.
- `source/solar.mjs` calculates solar geometry.
- `source/assets/stars.webp` is the static 1,536 × 1,024 star texture, encoded at WebP quality 88 without resizing. CSS crops it at its natural size; the build hashes its filename and reuses the same file for both background layers.
- `source/data/sky.json` contains the recorded sky and nine reviewed fallback discoveries. Its field table removes repeated keys without rounding any values. Unused satellite ground coordinates are omitted.
- `source/data/facts.json` is a lossless compact table of reviewed wording, exact satellite associations and references: 218,014 B raw, 31,065 B gzip or 20,907 B Brotli. It loads only on the first tap or cool-button press, then remains in memory for this session. Compression figures describe local files; hosting controls actual transfer compression.
- `source/data/orbits.json` preserves all original OMM values. It and the self-hosted, pinned satellite.js module load on the first selection that needs a trajectory, then stay in memory for this page session.
- `source/data/globe.json` contains preprojected SVG geometry. Changing the observer requires regenerating this geometry and the sky/orbit snapshot together; the build rejects an observer mismatch.
- `scripts/build.mjs` validates the snapshot and produces content-hashed assets, shared SVG land geometry and the deployment directory using Node's standard library. It prunes only obsolete generated hash files. It needs no package installation.
- `scripts/import-facts.mjs` imports only the frozen verified research library. Its default input is `research/fact-library/facts.json`; an optional file argument selects another reviewed handoff. Reimporting requires the original saved GP catalog at `../experiments/object-counts/active.json`. Normal builds use the committed compact library and need neither research downloads nor that sibling catalog.

Build with `node scripts/build.mjs`, then serve with `node scripts/serve.mjs` and open the printed address. The local server supports correct module/JSON content types and ETags; hashed preview assets use immutable caching. Production cache and compression policy is controlled by OpenAI hosting. No service worker or persistent orbital-data cache is installed. Publish the built `dist` directory through the Sites workflow; an archive is built from the exact pushed source commit.

### Rendering and storage

The faint field uses 32 cached `Path2D` groups instead of creating 1,127 individual dot paths each frame. Groups shimmer gently with staggered phases and periods; the animation remains decorative. Canvas size changes only when the actual width or pixel density changes. The selected highlight is cached separately. Reduced motion, pause, offscreen state and background visibility stop animation work.

Earth geometry never rebuilds on selection. Two 256 × 256 image buffers are reused for current lighting and its land mask, updating once per minute while visible and catching up on return. The mask uses a temporary blob URL; the previous URL is revoked. SGP4 trajectories use a bounded eight-object LRU cache. Invalid propagation gaps and horizon clipping remain intact.

Only selection, pause, story visibility, selected fact index, library revision and bounded discovery history are persisted under `above:living-earth:v1`. The limits are 64 object IDs, 24 story IDs and six family IDs; an 80-click browser test measured 569 characters, below 1 KB. A library revision change clears its fact/story/family indexes while retaining the selected object and object history. Writes are deduplicated and briefly batched, then flushed when the page hides. The app migrates its previous visualization-wrapper state after successfully saving the smaller replacement, ignores old solar preview times and leaves unrelated keys alone. Storage denial falls back to in-memory interaction. Fact text, orbital data, lighting buffers and paths are never written to local storage.

### Measured improvement

Three fresh local Chromium sessions, 390 × 1,100 CSS pixels at 2× pixel density, current-clock fixture, normal motion. Source sizes are uncompressed HTTP asset bodies; generated mask blobs are excluded from network totals. These measurements describe this desktop environment, not a guaranteed phone or hosted-network speed.

| Measurement | Before | Optimized |
| --- | ---: | ---: |
| Initial HTTP assets | 1,927,477 B | 217,976 B (88.7% smaller, including the star texture) |
| HTTP assets after first discovery and path | 1,927,477 B | 608,587 B (68.4% smaller, including the expanded fact library) |
| HTML file | 976,654 B | 65,194 B (93.3% smaller) |
| Median dot-frame drawing time | 1.45 ms | 0.112 ms (92.3% lower) |
| Faint-dot fills per frame | 1,127 | 32 |
| Median measured JS heap after selection | 6.99 MB | 5.93 MB |
| Earth geometry mutations / lighting updates on selection | 6 / 2 | 0 / 0 |

Full reports are in `qa/performance-baseline.json` and `qa/performance-optimized.json`. Time-to-first-sky is also recorded, but network and browser-startup variation make it less portable than asset-size and draw-work comparisons. The migration verified exact equality of every retained field in all 1,127 sky rows and all 1,127 orbital rows against the prior source; no satellite facts or orbital values were invented or approximated to save space.

### Verification

`node scripts/solar-qa.mjs` is dependency-free: it compares 120 hourly samples across equinoxes, solstices and the recorded date with an independent Meeus/NOAA calculation, requiring agreement within 0.02°. It also checks event crossings and polar no-event states.

`node scripts/facts-qa.mjs` checks interest ranking with synthetic fixtures, every shipped fact's independent review and source mapping, all 1,115 individual facts' accessibility on direct selection, and 80 production-library choices avoiding the recent 24 stories. Synthetic fixture text is never shipped.

`node scripts/browser-qa.mjs` checks 320/390/736 px layouts, globe/solar-mask alignment, clock rollover, 121-sample SGP4 paths matching the preserved snapshot, 12 distinct discovery objects/stories, exceptional-story priority, exclusion of routine context from discovery, individual facts on taps, source links/GCAT attribution, saved-history restoration, old-state migration, blocked storage, lazy same-origin requests, network failure/retry, shimmer/pause/reduced motion, accessibility and CSP. An 80-click stress test checks consecutive repeats and bounded storage. The latest report is `qa/report.json`. It requires Playwright, Chromium, axe-core and the pinned D3 reference asset from the sibling experiments for independent projection verification. `PLAYWRIGHT_PACKAGE`, `CHROMIUM_PATH`, `AXE_PATH` and `QA_URL` override local defaults.

`node scripts/performance-qa.mjs` runs the three-session rendering/loading audit. `--baseline` is retained for use against the prior wrapper export. Screenshots are generated locally and ignored by Git. Development tools and QA assets are excluded from the hosted `dist` bundle.

`node scripts/capture-palette.mjs` captures the actual Orbital Dawn page at 390 px phone and 1,280 px desktop widths using the current device clock and normal motion preference. It verifies the palette, object count, path sample count and lack of horizontal overflow. Captures are in `qa/orbital-dawn-phone-idle.png`, `qa/orbital-dawn-phone.png` and `qa/orbital-dawn-desktop.png`; their recorded solar direction and palette values are in `qa/palette-review.json`.

The local `research/` working directory is also ignored by this application's source repository. Its existing downloads are preserved on disk; they are not needed to build or run this recorded snapshot.

## Licenses and limitations

Natural Earth land geometry is public domain. The geometry's D3 and topojson-client tools and the three inline Lucide icons use ISC licenses; satellite.js uses MIT. Their notices are retained in `THIRD_PARTY_NOTICES.md` and copied to `dist/third-party-notices.txt`. Orbital data attribution belongs to CelesTrak and its contributing catalog sources.

GCAT is © Jonathan McDowell, distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its context facts are concise adaptations of catalog fields, with units and uncertainty retained. Attribution appears alongside displayed facts and in the notices. Agency/operator mission text is original concise paraphrasing of cited sources; those publishers retain their copyright, and no blanket open-content license is asserted.

This demo uses the recorded orbit epoch for freshness checks and must not be interpreted as current tracking after that date. The Earth's orientation is fixed to Seoul, and its lighting relies on an accurate device clock. Local JSON requests time out after eight seconds. The sky remains usable if the lazy fact library fails: the original nine snapshot discoveries remain available, and the next tap or button press retries. Orbital loading failure preserves available facts; selecting an object retries its path. Modern browsers supporting ES modules, Canvas `Path2D`, ResizeObserver and IntersectionObserver are required. The production live-location application is a separate Site.
