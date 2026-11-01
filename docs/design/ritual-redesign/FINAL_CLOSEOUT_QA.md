# Ritual final closeout assessment — NOT PASS

Base: `8329ef2f3dfe912a2a0e37fdcbaddb6e06f5bf66`.
Branch: `codex/three-coin-visual-phase3-5`.
Performance integration checkpoint: `35bb1bcba1b3880cbfc9eea54306daf832337be0`.
Home iteration-25 checkpoint: `b1ae450`.

This assessment does **not** declare Phase 3–5 complete or authorize release.
Coverage reconciles: **7 total = 0 PASS + 7 NOT PASS + 0 BLOCKED + 0 unreviewed + 0 rejected**.
Visual Complete: **NO**.

## Latest native visual evidence

`FINAL_CLOSEOUT_CAPTURE_INDEX.json` records seven same-build capture hashes, fixtures and environment. Raw reference/runtime/side-by-side/alpha-overlay/difference images are retained locally in `.artifacts/ritual-qa/final-closeout/accepted-cohort/ref-01` through `ref-07`; no temporary screenshots are staged.

Chrome 156.0.8078.48; macOS/Darwin 25.6.0; Apple M4 ANGLE Metal WebGL2. Canonical viewport 1672×941 CSS px, zoom 1, DPR/render DPR 1. Real WebGL is required for coin states. All captures have zero runtime errors. All seven isolated room images exactly match the unchanged 1671×941 clean production master with one repeated right-edge column. Reference edge normalization is ≤2px without artwork resampling.

Only the previously approved data/font/export/background/coin-engraving/decorative-paper source-content differences are allowed. None waives foreground position, dimensions, crop, geometry, opacity, lighting, color, layout, material or motion. Shared Header remains as required by the formal package; global navigation is unchanged.

| State | Work checked in this pass | Remaining identifiable foreground differences | Result |
|---|---|---|---|
| ref-01 Home | Preserved iteration-25 CTA metrics; shared physical thickness increased to 0.224 across both faces; revised metal response and qi visibility; one concentrated final Home capture | Coin reflection/highlight and thickness appearance; thin trail curvature/brightness/extent; particle/qi distribution; title metrics, question frame, CTA luminance and glow | NOT PASS |
| ref-02 Question | Blurred the empty input for the resting fixture; calibrated heading/group anchor, divider from approved master fragments, card border and CTA icon | Title/ink-circle bounds and supporting-copy anchors; divider/cloud alignment; frame/crop and CTA brightness/profile | NOT PASS |
| ref-03 Casting | Calibrated heading/ink-circle; coin B exposes an oblique face at the deterministic 500ms sample; exact final faces retained | Coin poses still differ, especially B's projected major-axis angle; face highlights; trail curvature/radiance; particle/qi field | NOT PASS |
| ref-04 Result | Calibrated heading anchor, removed extra CTA inner outline; differentiated the left local halo from other coins | Material contrast and highlight distribution; halo/orbit shape; label edge geometry; heading and CTA metrics/glow | NOT PASS |
| ref-05 Progress | Lowered progress-only key/fill; shortened high trails; calibrated sidebar and active marker; only the newly recorded authoritative line animates | Face still too luminous; smoke/trail field and particle extent; sidebar ornament/wrapping and exact row geometry | NOT PASS |
| ref-06 Auth/Save | Calibrated title/action spacing; approved divider fragments; sign-in blocked during entrance; explicit action keys and unchanged save/error handling | Frame bounds and paper tint/material; title ink bounds; button profile/ornament/glow and exact supporting-copy alignment | NOT PASS |
| ref-07 Reveal | Added a local Back link without clearing the cast; calibrated seal, line gaps and button typography; React still renders all authoritative content over the blank master | Frame/tint; title/number/seal alignment; line/button geometry and exact content layout; source-content exemptions do not cover these | NOT PASS |

Each state has an actual before/fix/after browser capture in `.artifacts/ritual-qa/final-closeout/`, followed by the final same-build cohort. Home was not allowed to block assessment of later states. No state was promoted using a similarity percentage or the whole-image diff metric.

## Motion and business boundaries

The task-local `scripts/ritual-motion-gate.mjs` uses actual UI controls, browser crypto inputs and the existing client save pipeline. Named local API fixtures never reach the real persistence backend. Standard and Reduced runs each perform all six real casts, reach auth-required, preserve the exact completed session, receive an intercepted QUESTION_LOCKED failure without reveal, retry the identical request, then exercise the 240ms/160ms gate exit and 420ms/140ms result entrance. This is **not live-account or real History persistence evidence**.

Latest real-browser boundary ledger: **3 total = 3 PASS + 0 FAIL + 0 unreviewed**: standard full flow, Reduced full flow, and animation-suppressed first-cast recovery. Standard observed heading/label/Record availability: approximately 1827/1909/2260ms from actual pointer release. Reduced: approximately 317/330/481ms. Exact per-run values and screenshots are retained in the capture index and local motion directory. Timing observations are not image-fidelity acceptance.

Presentation changes preserve the shared question form while outgoing Home/Question groups fade inertly; preserve one real coin canvas; stage result heading, labels and Record; gate Record on both the original business guard and its entrance; retain an inert saved gate during exit before mounting result children; and reduce UI translation/delay for Reduced Motion. No animation decides auth, persistence, coin faces or line values.

Overall strict **Motion QA: NOT PASS**. Coin/effect paths, visible poses and their reference fidelity remain unresolved; current-result UI exit and the complete action-swap sequence still need strict closeout. Passing the timing/business fixture does not waive these requirements.

## Review and scope

One independent read-only code review found no Critical issue and one Important issue: relying exclusively on `animationend` could permanently disable confirmation/Record when animations are cancelled or suppressed. The failure was reproduced in a real browser, then fixed with bounded presentation completion and verified by the animation-suppressed regression. The original `canRecord` business guard remains required. The review's Reduced-coverage finding was addressed by extending the real Reduced run through all six casts and save/reveal fixtures.

No reviewer modified core files. No framework, dependency, backend abstraction or domain architecture was introduced. No API, DB, migration, Auth backend, History backend, payment, credit or AI code changed. Original production masters and references are untouched. Only obsolete scaffold selectors/copy in the existing browser gates were adapted; cancellation, storage failure/retry, authoritative-result, bottom-up order, privacy, concealment and restore assertions remain enforced.

The generated local QA page is removed before the ordinary build. It must remain absent from the source/production manifest and return 404. Local artifacts and caches are preserved outside the commit; none is silently discarded.

QUESTION_LOCKED remains unchanged. **BUSINESS RELEASE BLOCKED — QUESTION_LOCKED**.

## Fresh final engineering verification

The latest ordinary production build passed after the owned QA fixture was removed. The source and production app-paths manifest contain no QA route, and `/ritual-qa-local` returns HTTP 404. All 42 files in the accepted seven-state capture index were read back and SHA-256 verified.

- Full unit suite: **134 files / 881 PASS**.
- Final real-Chrome business/renderer regression: **16 total = 16 PASS + 0 FAIL + 0 unreviewed**.
- PostgreSQL serial integration: **24 files / 152 tests PASS**; migration integrity and Drizzle metadata checks PASS. No DB schema or migration was changed.
- Complete local CI command `node scripts/vercel-build.mjs`: **PASS**, including production build, lint, typecheck, unit, SEO/content, browser, bundle and official Lighthouse gates. Successful log: `/tmp/ritual-final-full-ci-final.log`. Remote GitHub Actions were **not run** for this closeout assessment; local CI does not establish remote CI success.
- Three fresh sequential Mobile Lighthouse runs against the final ordinary production server: **3899.4198ms / 3900.30895ms / 3898.86285ms**. Median **3899.4198ms**, budget **<4000ms**: **PERFORMANCE PASS**. All three measured accessibility and SEO scores are 100. The official performance gate also passed; no threshold, Desktop DPR or required effects were reduced. Raw report hashes and exact measurements are in the capture index.

These engineering passes do not complete the foreground Pixel or strict Motion gate. All seven foreground states remain **NOT PASS**; strict Motion remains **NOT PASS**. The user subsequently authorized a formal handoff checkpoint containing all valid source changes and formal QA records. This checkpoint is not a completion commit or release. Raw `.artifacts/` remain local and excluded from Git. No Draft PR, merge or deployment is included. Core code changes stop after the handoff push.
