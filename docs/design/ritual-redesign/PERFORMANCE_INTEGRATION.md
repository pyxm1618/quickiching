# Performance integration into the seven-state checkpoint

Baseline: `71f0eb82528b05b6ec2b1c727dfebff891624da7`.
Source patch: `a169a4c6dd8ae58e86d4619b89ea039925997257`.
Integration is semantic: no file from the older performance branch replaces the current presentation.

## Changes

- Defer only the idle mobile Hero heavy scene until interaction, another application phase, a Desktop resize, or the 5-second timer. Desktop retains its existing two-frame mount schedule. Once mounted, the scene stays mounted.
- Discover the question parchment at high priority; request the narrow portrait background at low priority. Explicit mobile-only low-priority decoration hints prevent Chrome from promoting those CSS images to high priority. Remove the Desktop decoration preload.
- Bound non-QA mobile raster transfer using derivatives of the existing approved masters. The unchanged 337×600 mobile background is re-encoded at WebP quality 95; the existing 400×184 mobile question-paper crop uses the same encoding without resampling. Gate/result cards at widths ≤800px use an 800×451 derivative of the approved blank card. Desktop still uses the existing untouched full assets.

The extra raster changes are necessary on the latest presentation: the two-file semantic patch alone measured 4746.3 / 4749.7 / 4751.8ms Home Mobile LCP. Paper-only measured 4201.9ms; background-only measured 4107.4ms. Those failures remain in local evidence. The original result-card master caused 17559ms Mobile gate LCP; the mobile derivative resolves that transfer bottleneck without altering Desktop.

No business result, application state, algorithm, API, DB, migration, Auth/History backend, payment, credit, or AI behavior changes.

## Latest verification

- Ordinary production build: PASS. Generated QA route absent; its URL returns 404.
- Full unit suite: 134 files, 879 tests PASS. Lint and diff whitespace checks PASS.
- Real-browser boundary ledger: 16 total = 16 PASS + 0 FAIL + 0 unreviewed.
- Additional real mobile activation checks: interaction and authoritative cast, Desktop resize, idle timer, and restored question phase: 4 PASS. Deferral itself generates zero business draws.
- Home Mobile cold Lighthouse runs: 3893.86575 / 3897.4277 / 3896.8211ms; median 3896.8211ms. All three below 4000ms. Performance score 88 in all three. PERFORMANCE PASS for this measured environment.
- Unmodified official Public P0 Lighthouse gate: PASS. Local Desktop Home LCP 2494ms; mobile Three-Coin route 3511ms. The latter route is not the Home Mobile measurement.
- Unmodified official result Lighthouse gate on the ordinary build: PASS. Mobile LCP 1959ms, Desktop 3009ms; accessibility 100, SEO 92; CLS 0.0530 / 0.0579.

Browser: Chrome 156.0.8078.48, macOS/Darwin 25.6.0, Apple M4 ANGLE Metal WebGL2. Browser auto-updated from the earlier checkpoint's Chrome 155; latest measurements use 156. Desktop capture: 1672×941 CSS px, zoom 1, DPR/render DPR 1. Lighthouse Home Mobile uses its default 412×823, DPR 1.75, simulated mobile throttling; these are local measurements, not field metrics.

## Desktop preservation and visual status

Fresh Home, Casting, and Result captures after all performance changes compare pixel-for-pixel with the saved `71f0eb8` runtime baselines: all RGB difference bounds are null. No Desktop camera, geometry, material, lighting, particles, trails, airflow, glow, Bloom, layout or QA DPR changes.

This is regression evidence only. All seven states remain **NOT PASS** against the formal foreground references. Seven-state coverage is complete; strict pixel closeout remains in progress; Visual Complete = NO. Full CI is not claimed PASS from these individual checks.

Home remaining differences: coin thickness/metal response, trail curvature/brightness/extent, particle distribution, airflow visibility, question-card frame, CTA metrics/treatment, and heading metrics. Other state findings remain in `PASS_1_DIFF_INVENTORY.md`. Only the already approved source-art/font/data/export deviations apply.

QUESTION_LOCKED is unchanged. **BUSINESS RELEASE BLOCKED — QUESTION_LOCKED**.

Machine-readable derivative provenance, source hashes, pixel regression outcomes and Home LCP evidence are in `PERFORMANCE_INTEGRATION_EVIDENCE.json`. Raw screenshots/reports remain local under `.artifacts/ritual-qa/performance-integration/`; they are not staged with application code.
