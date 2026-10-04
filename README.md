# Above · Living Earth

A private, static, interactive demonstration of the cinematic Living Earth satellite-sky design. Open the page to see a gently shimmering satellite field and Earth lighting for the current time in Seoul; tap a dot for its recorded position and past/next five-minute trajectory. No backend, accounts, analytics or location request is required by this demonstration.

## Scope and data

This is a recorded design demo, not the live-location satellite app. The sky contains 1,127 active-catalog satellites above Seoul's geometric horizon at **2026-10-04 01:05:38 UTC** (10:05 KST), observer 37.5665° N, 126.978° E at sea level. Orbital coordinates remain at that snapshot while decorative shimmer animates and Earth lighting follows the current clock. Names and catalog numbers come from CelesTrak; altitude, speed, bearing and elevation are calculated using satellite.js 7.0.1. Mission stories use the reviewed official sources below. Country, launch and brightness facts are not inferred.

CelesTrak's [active GP catalog](https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json), obtained on October 4, 2026, was propagated client-side using SGP4; records outside a 72-hour freshness window or with invalid propagation were excluded. The snapshot and minimal orbital inputs are embedded. The demo makes no fresh CelesTrak request. CelesTrak [GP documentation](https://celestrak.org/NORAD/documentation/gp-data-formats.php) and [usage policy](https://celestrak.org/usage-policy.php) govern source format and retrieval frequency.

Satellite dots use user-relative azimuth/elevation. The faint Earth is geographical context, not the geographic positions of the satellite dots. Selected paths contain 121 SGP4 samples over ten minutes, retain invalid gaps, refine horizon crossings and clip below the horizon. Solid means reconstructed past; dashed and an arrow mean predicted future. Apparent slow motion stays at true scale.

**Show me something cool** rotates through nine distinct objects in this snapshot. It starts with mission stories, then highlights nearby, fast-moving and unusual-orbit objects, preferring at least 10° elevation for calculated discoveries. It skips the currently selected object and avoids repeats until the set is exhausted, then starts a new cycle. Discovery history is saved locally alongside selection. Facts are one or two sentences; all dynamic values refer to the recorded sky. Orbital periods are approximate, calculated as 1,440 minutes divided by catalog mean motion (revolutions per day).

Mission facts reviewed on October 4, 2026:

| Object | Fact source |
| --- | --- |
| QZS-1R / Michibiki-1R (49336) | Japan Cabinet Office: [QZSS and its compatibility with GPS](https://qzss.go.jp/en/overview/services/sv02_why.html) |
| Proba-3 OSC (62258) | ESA: [the Occulter blocks the Sun for its companion to study the corona](https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Proba-3_s_first_artificial_solar_eclipse) |
| THEMIS A (30580) | NASA: [THEMIS investigates what triggers auroras](https://science.nasa.gov/mission/THEMIS/) |

Other discovery facts use only the embedded CelesTrak orbital elements and calculated position/speed/range. No mission purpose is guessed from a name or orbit. Mission descriptions state the spacecraft's role, without asserting its present operating status.

## Earth lighting

The Sun's position uses [USNO's approximate solar algorithm](https://aa.usno.navy.mil/faq/sun_approx), sidereal rotation and observer-relative geometry. Sunrise/sunset are searched and refined at a solar-center elevation of −0.833333°, following [USNO's sea-level, unobstructed-horizon convention](https://aa.usno.navy.mil/faq/RST_defs). Weather, terrain, refraction and observer height can shift observed times.

Earth lighting starts at the browser's current clock and refreshes each minute, including with shimmer paused or reduced motion enabled. It catches up when the page returns to view. Sunrise and sunset are recalculated for the current Seoul calendar day. The clock is the only lighting time source; older saved times are ignored. The device clock is assumed to be accurate. The satellite snapshot keeps its separate recorded-time label.

Published Natural Earth land geometry is projected with D3. A 256 × 256 lighting canvas uses the calculated Sun direction and globe surface normals. A smooth light-to-dark fade, artistic surface brightness and a narrow atmospheric glow add depth. A matching luminance mask brightens sunlit land. Brightness and bloom are aesthetic choices, not physical visibility predictions. The independently shimmering satellites do not imply naked-eye visibility.

A pause control stops decorative shimmer, and reduced-motion preference disables it automatically. Hidden/offscreen pages do not redraw it; Earth shading updates with clock changes rather than every animation frame. Keyboard arrows select satellites by compass bearing and Escape clears selection. Selection and motion preferences are saved only on this browser.

## Architecture, setup and hosting

`source/cinematic-living-earth.html` is the editable visualization source. `dist/index.html` is its standalone export, wrapped with the visualization runtime styles. `.openai/hosting.json` declares static `dist` output. The Sites workflow tracks and pushes source, packages those static files and publishes a private Site. There is no deployment build step, server runtime or OpenAI API key.

To serve locally, run `node scripts/serve.mjs`, then open its printed URL. Run `node scripts/solar-qa.mjs` for a dependency-free comparison against the independent Meeus/NOAA calculation: 120 hourly samples across equinoxes, solstices and the recorded date must agree within 0.02°. Tests also verify event crossings and polar no-event states. Browser checks cover globe projection alignment, the current clock, stale saved-state recovery, day rollover, 320/390/736 px layouts, SGP4 paths, motion pause/reduced-motion behavior and accessibility.

`scripts/browser-qa.mjs` is the local development audit. It requires Playwright, Chromium, axe-core and the cached pinned assets from the sibling experiments; `PLAYWRIGHT_PACKAGE`, `CHROMIUM_PATH`, `AXE_PATH` and `QA_URL` can override this workspace's defaults. Its latest results are in `qa/report.json`; screenshots are generated locally and ignored by Git. To regenerate the standalone export after editing the source, use the bundled visualization renderer with `source/cinematic-living-earth.html`, `dist/index.html`, `--title 'Above · Living Earth'` and `--force`, then retain the outer document's description and favicon.

The default export loads pinned static D3 7.9.0, topojson-client 3.1.0 and satellite.js 7.0.1 libraries from jsDelivr. A CDN failure can limit maps or paths; the recorded satellite sky remains usable. Access to those assets shares ordinary network request information with the CDN. Embedded orbital data and geometry require no data service request.

## Licenses and limitations

Natural Earth land geometry is public domain. D3 and topojson-client use ISC licenses, and satellite.js uses MIT. Their notices are retained in `THIRD_PARTY_NOTICES.md`. Orbital data attribution belongs to CelesTrak and its contributing catalog sources. This demo uses the recorded orbit epoch for freshness checks and must not be interpreted as current tracking after that date. The production live-location application is a separate Site.
