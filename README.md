# Above

How much is happening above a single city? Above begins with one recorded answer: 1,127 satellites were above Seoul's geometric horizon at 10:05:38 KST on October 4, 2026.

Every dot comes from that snapshot. Tap one for its name, altitude, speed, and a reviewed fact. **Show me something cool** explores mission stories, while varying the objects and topics it selects. Arrow keys visit satellites in compass order; Escape clears the selection. Selection and recent discoveries are remembered in this browser.

## Two clocks, one view

The satellite sky stays at the recorded moment. The Earth lighting follows the device's current clock and refreshes each minute. The time beside Seoul belongs to the snapshot.

North is up, the center is overhead, and the ring marks the horizon. The globe provides geographic context. The dots show directions in Seoul's sky rather than locations on Earth's surface. The solid trail reconstructs the previous five minutes from the orbit model; the dashed arrow predicts the following five minutes from the same recorded inputs. Neither line is a telemetry record.

Altitude is height above Earth; elevation is angle above the horizon. Decorative shimmer and sunlight on the globe do not mean a satellite can be seen with the naked eye. Brightness, weather, and local obstructions are not modeled.

## Run locally

Use Node.js 22 or newer. Building and running require no dependency installation.

```sh
node scripts/build.mjs
node scripts/serve.mjs
```

Open `http://127.0.0.1:4174`. Set `PORT` to change the preview address. Edit `source/`, then rebuild `dist/`; generated filenames contain a content hash so changed assets receive a new address. The build removes obsolete generated assets and checks data consistency before writing them. `.openai/hosting.json` points to this directory and the existing static Site. Publish through the Sites source-and-archive workflow.

## Data and evidence

The snapshot uses CelesTrak's [active-satellite GP catalog](https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json), calculated with satellite.js 7.0.1 for Seoul at 37.5665° N, 126.978° E and sea level. It includes objects at or above the geometric horizon with orbital elements within 72 hours of the snapshot. The values are preserved without rounding to reduce file size. The browser does not download a current feed or request a location.

The fact library contains 1,151 reviewed entries covering 1,115 distinct satellites: 1,115 individual catalog facts and 36 shared mission profiles. Shared profiles represent 35 stories, of which 32 qualify for discovery. Routine context remains available on direct selection. The other 12 snapshot objects have no fact in the expanded library.

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
| `source/data/orbits.json`               | Exact recorded orbital inputs                                         |
| `source/data/facts.json`                | Reviewed text, identifiers, groups, and references                    |
| `source/data/globe.json`                | Land geometry projected for the fixed Seoul observer                  |
| `source/assets/`, `source/vendor/`      | Star texture and pinned orbital library                               |
| `scripts/`                              | Build, import, preview, and verification tools                        |

The browser loads the sky first. Facts load after interaction; orbital inputs and satellite.js load when a selected trail is needed. Runtime tables omit repeated keys, and the built sky excludes the unused range column while retaining it in source. All application requests stay on the same origin. There is no framework, backend, external font, analytics, or runtime dependency CDN.

The faint sky uses 32 cached drawing groups instead of rebuilding 1,127 dot paths each frame. The selected highlight is separate. Canvas sizes change only when needed; hidden or offscreen views stop shimmer. Reduced motion also stops it, while lighting continues to follow the clock.

Earth geometry is shared between base and sunlit layers. Two 256 × 256 pixel buffers provide the lighting and land mask; they update each minute while visible, then catch up when the page returns. Old mask URLs are released. Selected trajectories use 121 samples, preserve failed-calculation gaps, refine horizon crossings, and retain an eight-object cache.

Solar direction follows [USNO's approximate algorithm](https://aa.usno.navy.mil/faq/sun_approx). The broad twilight wash and atmospheric glow are artistic choices around the calculated day/night boundary. Changing the observer requires rebuilding both land projection and satellite inputs; the build rejects mismatched observers.

Only bounded preferences are saved: the selected object and fact, library revision, and recent object, story, and family histories. The limits are 64 objects, 24 stories, and six families. Writes are batched, deduplicated, and flushed on leaving the page. A fact revision clears obsolete story indexes. The earlier visualization's saved selection can migrate after a successful replacement save. Blocked storage leaves interaction available in memory. Facts, paths, and orbital tables are never persisted in browser storage.

## Verification and limitations

Run `node scripts/solar-qa.mjs`, `node scripts/facts-qa.mjs`, and `node scripts/verify.mjs`. They check independent solar calculations, reviewed fact mappings, discovery variety, and deployable asset integrity. [Browser checks](QA.md) cover layout, paths, retries, preferences, motion, lighting, and automated accessibility.

If the fact library fails, nine snapshot discoveries remain available and the next interaction retries. If a path fails, details remain visible and another selection retries. Snapshot loading has a visible retry action; local JSON requests time out after eight seconds. The current clock must be accurate for Earth lighting. Modern browsers need modules, Canvas `Path2D`, ResizeObserver, and IntersectionObserver. This is a fixed snapshot, so it does not become current tracking as time passes.

## Licenses

Natural Earth geometry is public domain. D3 and topojson-client were used to prepare it; their ISC notices remain. The inline Lucide icons use ISC, and satellite.js uses MIT. [Third-party notices](THIRD_PARTY_NOTICES.md) are copied into every build.

GCAT is © Jonathan McDowell under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its attribution remains in runtime data, evidence, and packaged notices. Mission text consists of original concise paraphrases of cited sources; those publishers retain their copyright.
