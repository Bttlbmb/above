# Above · Living Earth

A private, static, interactive demonstration of the cinematic Living Earth satellite-sky design. Open the page to see a gently shimmering satellite field; tap a dot for its calculated position and past/next five-minute trajectory. Replay sunrise or sunset to watch the Earth lighting change. No backend, accounts, analytics or location request is required by this demonstration.

## Scope and data

This is a recorded design demo, not the live-location satellite app. The sky contains 1,127 active-catalog satellites above Seoul's geometric horizon at **2026-10-04 01:05:38 UTC** (10:05 KST), observer 37.5665° N, 126.978° E at sea level. Orbital coordinates remain at that snapshot while decorative shimmer and explicit color replays animate. Names and catalog numbers come from CelesTrak; altitude, speed, bearing and elevation are calculated using satellite.js 7.0.1. No new purpose, country, launch or brightness facts are asserted.

CelesTrak's [active GP catalog](https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json), obtained on October 4, 2026, was propagated client-side using SGP4; records outside a 72-hour freshness window or with invalid propagation were excluded. The snapshot and minimal orbital inputs are embedded. The demo makes no fresh CelesTrak request. CelesTrak [GP documentation](https://celestrak.org/NORAD/documentation/gp-data-formats.php) and [usage policy](https://celestrak.org/usage-policy.php) govern source format and retrieval frequency.

Satellite dots use user-relative azimuth/elevation. The faint Earth is geographical context, not the geographic positions of the satellite dots. Selected paths contain 121 SGP4 samples over ten minutes, retain invalid gaps, refine horizon crossings and clip below the horizon. Solid means reconstructed past; dashed and an arrow mean predicted future. Apparent slow motion stays at true scale.

## Earth lighting

The Sun's position uses [USNO's approximate solar algorithm](https://aa.usno.navy.mil/faq/sun_approx), sidereal rotation and observer-relative geometry. Sunrise/sunset are searched and refined at a solar-center elevation of −0.833333°, following [USNO's sea-level, unobstructed-horizon convention](https://aa.usno.navy.mil/faq/RST_defs). Weather, terrain, refraction and observer height can shift observed times.

Published Natural Earth land geometry is projected with D3. A 256 × 256 lighting canvas uses the calculated Sun direction and globe surface normals. A smooth light-to-dark fade, artistic surface brightness and a narrow atmospheric glow add depth. A matching luminance mask brightens sunlit land. Brightness and bloom are aesthetic choices, not physical visibility predictions. The independently shimmering satellites do not imply naked-eye visibility.

The preview buttons replay 90 minutes in 16 seconds. Reduced-motion preference shows still event states. A pause control stops decorative shimmer. Hidden/offscreen pages do not redraw it; Earth shading updates with solar-time changes rather than every animation frame. Keyboard arrows select satellites by compass bearing and Escape clears selection. Selection and motion preferences are saved only on this browser.

## Architecture, setup and hosting

`dist/index.html` is the standalone export of the previously reviewed interactive visualization, wrapped with its local preview/runtime styles. `.openai/hosting.json` declares static `dist` output. The Sites workflow tracks and pushes source, packages those static files and publishes a private Site. There is no build step, server runtime or OpenAI API key.

To serve locally, run `node scripts/serve.mjs`, then open its printed URL. The original experiment was checked at 320, 390 and 736 px, including all-dot rendering, east/west solar lighting, soft transitions, SGP4 paths, motion pause/reduced-motion behavior and zero axe violations. The hosted export reuses that verified source.

The default export loads pinned static D3 7.9.0, topojson-client 3.1.0 and satellite.js 7.0.1 libraries from jsDelivr. A CDN failure can limit maps or paths; the recorded satellite sky remains usable. Access to those assets shares ordinary network request information with the CDN. Embedded orbital data and geometry require no data service request.

## Licenses and limitations

Natural Earth land geometry is public domain. D3 and topojson-client use ISC licenses, and satellite.js uses MIT. Their notices are retained in `THIRD_PARTY_NOTICES.md`. Orbital data attribution belongs to CelesTrak and its contributing catalog sources. This demo uses the recorded orbit epoch for freshness checks and must not be interpreted as current tracking after that date. The production live-location application is a separate Site.
