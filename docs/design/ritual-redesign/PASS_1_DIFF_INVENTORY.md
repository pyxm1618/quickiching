# Pass 1 — Complete Coverage / foreground difference inventory

Base: `8329ef2f3dfe912a2a0e37fdcbaddb6e06f5bf66`. Performance checkpoint: `3911d3555c6bce582b4a9f5030421e4c0e943687`.
Branch: `codex/three-coin-visual-phase3-5`. This inventory and the associated implementation form the new coverage checkpoint after 3911d355; no older baseline was restored.

Coverage: **7 total = 0 PASS + 7 reviewed NOT PASS + 0 unreviewed + 0 deferred + 0 rejected.**
Pass 1 coverage is complete. Visual Complete: **NO**. Strict Pixel Closeout and full Motion QA remain incomplete.

All native captures: installed Chrome 155.0.8059.85; macOS / Apple M4 ANGLE Metal WebGL2 for coin states; 1672 × 941 CSS px; zoom 1; CSS and renderer DPR 1. No Desktop fallback is accepted.
The helper samples completed CSS entrances for static layout; actual motion needs separate real-time verification. Reference padding/cropping is at the right/bottom edge only, ≤2px, without artwork resampling.
Evidence directories are local QA artifacts retained outside Git; the reproducible capture/diff helpers are source controlled. `QA_CAPTURE_INDEX.json` records file hashes and fixture metadata. All seven isolated background comparisons have a null difference bounding box against the unchanged clean master plus its one right-edge column.

## Allowed source/data differences only

- Unique clean room is checked against the production master; concept backgrounds do not cause scene replacement.
- Coin engraving source follows approved front/back masters. Geometry, pose, material and effects remain strict.
- Decorative and parchment source patterns follow official masters; crop, scale, position, opacity, color, material and effects remain strict.
- Official business data and locked font glyph shapes are retained. No business algorithm, hexagram data or typeface is changed to reduce diff.
- Shared Header/BrandMark remains unchanged as required by ASSET_MANIFEST / TYPOGRAPHY_SPEC. It is not redesigned to mimic concept navigation.

## Seven-state findings

### ref-01 — Home: NOT PASS

Evidence: `.artifacts/ritual-qa/seven-state-checkpoint/ref-01`. Shared QA build: `ovnaexo_sa8Yer7I0tDQH`.

- Coin thickness and bronze contrast remain different.
- Trail curvature/brightness, particle extent and visible smoke differ.
- Card corners/border, CTA ornament/glow and precise heading metrics remain unresolved.

### ref-02 — Question Confirm: NOT PASS

Evidence: `.artifacts/ritual-qa/seven-state-checkpoint/ref-02`. Shared QA build: `ovnaexo_sa8Yer7I0tDQH`.

- Title and ink-circle visual bounds differ; supporting text sits above reference anchors.
- Divider visible extent and cloud alignment differ.
- Question-card border/crop, CTA icon dimensions and glow differ.

### ref-03 — Casting: NOT PASS

Evidence: `.artifacts/ritual-qa/seven-state-checkpoint/ref-03`. Shared QA build: `ovnaexo_sa8Yer7I0tDQH`.

- At fixed 500ms the second coin is nearly edge-on; reference exposes an oblique face.
- Coin highlight response is overbright; trajectory trace curves do not match.
- Particle distribution/extent and airflow visibility remain different.
- Title group and supporting text metrics differ.

### ref-04 — Cast Result: NOT PASS

Evidence: `.artifacts/ritual-qa/seven-state-checkpoint/ref-04`. Shared QA build: `ovnaexo_sa8Yer7I0tDQH`.

- Reference-matching Heads/Tails/Tails fixture uses the real algorithm.
- Faces are overly bright, including center/right highlights.
- Label edge geometry and CTA ornament/glow differ.
- Heading metrics and label/button entrance sequence require closeout.

### ref-05 — Six-Line Progress: NOT PASS

Evidence: `.artifacts/ritual-qa/seven-state-checkpoint/ref-05`. Shared QA build: `ovnaexo_sa8Yer7I0tDQH`.

- Progress coin is visible after the layer-opacity fix, but overexposed.
- Trails extend too high and lack the reference smoke-like curls.
- Sidebar marker geometry/wrapping and row decorations differ.
- Six rows use authoritative bottom-up order; reference example row data is not substituted.
- Reset-to-progress continuity still needs motion closeout.

### ref-06 — Auth / Save Gate: NOT PASS

Evidence: `.artifacts/ritual-qa/seven-state-checkpoint/ref-06`. Shared QA build: `ovnaexo_sa8Yer7I0tDQH`.

- Actual six-cast route reaches auth-required with 18 business bits and no result leak.
- Card frame bounds, tint/material and title bounds differ.
- Supporting copy and sign-in CTA sit lower than reference.
- Divider ornaments, button profile and glow differ.
- Gate interaction delay, Saving action transition and successful-save exit require motion closeout.

### ref-07 — Result Reveal: NOT PASS

Evidence: `.artifacts/ritual-qa/seven-state-checkpoint/ref-07`. Shared QA build: `ovnaexo_sa8Yer7I0tDQH`.

- Actual result component rendered with explicitly local-only saved-reading props; no real authentication/History success is claimed.
- Card frame bounds and material/tint differ.
- Title/number alignment, seal geometry, line-bar geometry and button text metrics differ.
- Local Back action and result entrance/gate exit require closeout.
- Official result data is Youthful Folly / hexagram 4 with authoritative line values and Chinese classical Judgment/Image; concept English examples are not substituted.
- Legacy reading-reveal background/border was removed for Ritual only. The isolated production background now matches exactly; the foreground card still does not pass.

## Remaining verification boundaries

- Latest checkpoint: build PASS, 134 files / 879 tests PASS, 16 real-browser boundary cases PASS.
- Current coverage checkpoint: fresh ordinary build PASS, 134 files / 879 tests PASS, lint PASS, complete real-browser suite 16/16 PASS (0 FAIL / 0 unreviewed).
- Full CI remains NOT PASS. Last measured mobile LCP: 5670.60ms on the earlier resource-optimization build; not a fresh measurement of this coverage build.
- No API / DB / migration / Auth backend / History backend / payment / AI changes.
- QUESTION_LOCKED: UNCHANGED. BUSINESS RELEASE BLOCKED — QUESTION_LOCKED.


## Reproduce the local result fixture

Use the pinned Node 22.x / Bun 1.3.14 and installed Chrome recorded above. Python image comparison requires Pillow. Existing CI installs Puppeteer through `bun add --no-save puppeteer-core@25.1.0`; no manifest/lock change is required.

1. `node scripts/ritual-qa-fixture.mjs install`
2. `RITUAL_VISUAL_QA=1 bun run build`
3. `RITUAL_VISUAL_QA=1 bun run start -- -p 3028`
4. Home: `node scripts/ritual-capture.mjs OUTPUT_DIR`; states 02–07: `node scripts/ritual-state-capture.mjs STATE OUTPUT_DIR`.
5. Generate each native comparison with `python3 scripts/ritual-image-compare.py REFERENCE RUNTIME OUTPUT_DIR`.
6. Stop the server, run `node scripts/ritual-qa-fixture.mjs remove`, rebuild normally, and confirm `/ritual-qa-local` returns 404.

The temporary generated route is never committed or deployed. It requires the explicit local QA flag and the exact localhost host. State 07 uses saved-reading fixture props, not a real-account persistence claim. States 02–06 use the actual application controls and injected deterministic crypto inputs; observed draw counts are asserted as 0 / 3 / 3 / 12 / 18. Motion closeout remains separate from completed-entrance layout snapshots.

Performance patch `a169a4c6dd8ae58e86d4619b89ea039925997257` has not been integrated. Full CI and strict seven-state Pixel/Motion PASS remain outstanding.
