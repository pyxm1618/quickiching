# PR #76 Performance Closeout

Starting Head: `05435e9faa8ae406d337bca2a4caf55f49d4469c`.

Outcome: **PERFORMANCE CLOSEOUT NOT PASS**. No merge, production deployment, API, Auth, payment, database, AI, casting algorithm, SEO copy or information architecture change.

## Method and coverage

Lighthouse 13.4.1; Chrome 156.0.8078.48; Node 22.23.2; Bun 1.3.14; frozen lockfile; actual Next production builds. Unchanged default mobile/desktop throttling. Three independent runs for the five mobile core surfaces below; medians and full ranges retained. Other successful rows have one pinned-runtime sample. Initial full baseline also retained; Account baseline uses the initial Node 26 build, so its before/after timing is informational rather than a controlled comparison.

18 requested navigation observations = 12 lab-budget pass + 4 lab-budget reject + 2 deferred + 0 unknown/unreviewed. This counts navigation observations, not authenticated product acceptance. My Readings redirects to disabled signin (410) in this anonymous environment. Account really opens, but shows its anonymous load failure; populated account content and authenticated saved Result remain **NOT VERIFIED**. SessionStorage Result fixture is explicitly synthetic and exercises the actual completed-cast auth gate, never a claimed real saved reading.

## Before / after

P = Lighthouse Performance; LCP/TBT in ms; First Load JS uses the Next build display (kB), separate from measured browser script transfer. Image transfer includes response overhead.

| Device / surface | P before → after | LCP before → after | CLS before → after | TBT before → after | First Load JS | Image bytes before → after |
| --- | --- | --- | --- | --- | --- | --- |
| mobile-home | 86 → 88 | 4085 → 3855 | 0.0000 → 0.0000 | 1.0 → 0.0 | 174 kB → 174 kB | 148871 → 148944 |
| mobile-methods-three-coin | 100 → 100 | 1358 → 1359 | 0.0000 → 0.0000 | 0.0 → 0.0 | 173 kB → 174 kB | 3091 → 3091 |
| mobile-readings-three-coin-result | 79 → 99 | 5422 → 1360 | 0.0530 → 0.0530 | 0.0 → 0.0 | 186 kB → 186 kB | 197049 → 197123 |
| mobile-hexagrams | 83 → 82 | 4249 → 4449 | 0.0911 → 0.0911 | 1.0 → 0.0 | 131 kB → 131 kB | 2874990 → 437645 |
| mobile-hexagrams-24-return | 88 → 90 | 3895 → 3596 | 0.0000 → 0.0000 | 0.0 → 0.5 | 107 kB → 107 kB | 148420 → 148420 |
| mobile-zh-hexagrams | 100 → 100 | 1508 → 1508 | 0.0000 → 0.0000 | 0.0 → 0.0 | 107 kB → 107 kB | 3091 → 3091 |
| mobile-zh-hexagrams-24-return | 100 → 100 | 1508 → 1507 | 0.0000 → 0.0000 | 0.0 → 0.0 | 107 kB → 107 kB | 3091 → 3091 |
| mobile-my-readings | DEFERRED | N/A | N/A | N/A | 108 kB → 107 kB | N/A: real login required |
| mobile-account | 86 → 89 | 4077 → 3745 | 0.0000 → 0.0000 | 0.0 → 0.0 | 174 kB → 174 kB | 149010 → 149084 |
| desktop-home | 86 → 95 | 2547 → 1580 | 0.0000 → 0.0000 | 0.0 → 0.0 | 174 kB → 174 kB | 2107930 → 910218 |
| desktop-methods-three-coin | 100 → 100 | 329 → 329 | 0.0000 → 0.0000 | 0.0 → 0.0 | 173 kB → 174 kB | 1446 → 1446 |
| desktop-readings-three-coin-result | 77 → 100 | 4974 → 328 | 0.0545 → 0.0545 | 0.0 → 0.0 | 186 kB → 186 kB | 4953427 → 1088128 |
| desktop-hexagrams | 99 → 99 | 784 → 854 | 0.0556 → 0.0556 | 0.0 → 0.0 | 131 kB → 131 kB | 3069217 → 631874 |
| desktop-hexagrams-24-return | 99 → 100 | 878 → 797 | 0.0000 → 0.0000 | 0.0 → 0.0 | 107 kB → 107 kB | 345498 → 345496 |
| desktop-zh-hexagrams | 100 → 100 | 369 → 368 | 0.0000 → 0.0000 | 0.0 → 0.0 | 107 kB → 107 kB | 1446 → 1446 |
| desktop-zh-hexagrams-24-return | 100 → 100 | 367 → 368 | 0.0000 → 0.0000 | 0.0 → 0.0 | 107 kB → 107 kB | 1446 → 1446 |
| desktop-my-readings | DEFERRED | N/A | N/A | N/A | 108 kB → 107 kB | N/A: real login required |
| desktop-account | 89 → 95 | 2178 → 1536 | 0.0000 → 0.0000 | 0.0 → 0.0 | 174 kB → 174 kB | 2108098 → 910386 |

### Mobile stability

| Surface | Samples | Final LCP range (ms) | Final median (ms) |
| --- | --- | --- | --- |
| mobile-home | 3 | 3810–3876 | 3855 |
| mobile-methods-three-coin | 3 | 1359–1360 | 1359 |
| mobile-readings-three-coin-result | 3 | 1360–1361 | 1360 |
| mobile-hexagrams | 3 | 4102–4520 | 4449 |
| mobile-hexagrams-24-return | 3 | 3588–3599 | 3596 |

## Changes and reasons

- Keep all six PNG masters. Deliver content-hashed, quality-95 WebP for the stage, result card, desktop textures and transparent platform; mobile textures retain exact visible RGB through lossless WebP. Existing mobile background/result derivatives are copied byte-for-byte to hashed delivery URLs. Account coins use a 900px lossless derivative for a 300px CSS display. Do not alter CSS geometry, composition or motion rules. Full provenance, dimensions and original/delivery hashes: `pr-76-assets.json`.
- Keep existing Hub next/image Hero priority, Scroll Grid priority and responsive card frames. Only the low-priority lazy platform gets native responsive WebP srcset; sizes match the existing 66vw / 57.5vw / 50vw layout. Desktop P99 and sub-second LCP remain. Existing `public/hexagram-detail/delivery/` sources and references are untouched.
- Result card gets media-matched LCP image preload. Keep only the actually used Mono 400 font preloaded; 500/600/700 remain available on demand, with unchanged typefaces and weights. Disable brand-link auto-prefetch to prevent unrelated Home RSC/font downloads from competing on other pages; navigation destinations and click behavior stay unchanged.
- Preserve dynamic Three.js, scene deferral, ImageBitmapLoader, reduced motion, authoritative faces, motion functions, demand-driven RAF and disposal. Bound desktop DPR at 2 (mobile remains 1); use 1024 desktop / existing 512 mobile texture sizes; skip direct render callbacks while hidden. Retain HalfFloat HDR scene and Bloom settings; remove unused depth attachments only from the two full-screen composer buffers.
- Keep AccountModalHost/User Menu client boundaries. No broad component or business refactor for small JS savings. Build-reported First Load remains 107–186 kB. Asset gate additionally measures compressed initial chunks including inherited layout (240 KiB cap); this is a different, more inclusive measurement than Next route display.

## Cache strategy

- Only content-hashed `/performance/` delivery files receive `public, max-age=31536000, s-maxage=31536000, immutable`. Change bytes by generating a new hash URL and updating CSS/preloads/srcset; never overwrite bytes at an old hashed path. Masters and legacy fixed URLs do not receive unsafe year-long caching.
- Next hashed JS/CSS/fonts retain framework immutable caching. `/_next/image` keeps framework-managed Accept/Vary handling and receives a one-day minimum TTL, with longer upstream lifetimes honored for hashed inputs. Do not apply image caching to documents, dynamic APIs, Auth, user data or result data.
- Local browser/header verification is recorded separately. Vercel CDN HIT/MISS behavior at the final deployment is **NOT VERIFIED** until that deployment is available; local headers cannot establish a CDN hit.

## Gates and remaining blockers

- CWV release goals stay LCP ≤2500ms, CLS ≤0.1, interaction latency ≤200ms. CI LCP ceiling is 2750ms (10% lab tolerance), never 3800–4000ms. CI also checks P≥90 mobile / ≥95 desktop, TBT≤200ms (not a substitute for INP), per-page image totals 768/1536 KiB mobile/desktop, single image 256/768 KiB, and measured script transfer 320 KiB. Texture pair ≤1 MiB, each declared derivative ≤768 KiB, source hashes and complete 14-item delivery inventory are checked. Lighthouse regression guard compares the same redesign baseline and device: ≤5 points and ≤10%+100ms LCP increase.
- Home median still exceeds 2.5s. Its mobile LCP is the visible question-card background (only about 15 kB), while the heavy WebGL scene is absent initially. Remaining critical CSS/font/client loading needs further measurement; removing another master image cannot by itself resolve this LCP.
- English Hub mobile median remains above target and is about 200ms above its pinned baseline median despite a large image reduction. Before/after sample ranges overlap; preserve this regression signal rather than claiming mobile Hub completion. Hero is the LCP element; its existing next/image delivery remains intact.
- English Detail mobile remains above target with existing delivery derivatives preserved. Its visible text/header and rendering/font critical path remain; do not re-enable PNG masters.
- Anonymous Account modal mobile remains above target; real account and My Readings performance require a usable login state. These are deferred, never fabricated.
- These results do **not** establish a hard visual-design lower bound. Further engineering work may still be possible; it would be false to call the current state an accepted design trade-off or to assert that every remaining improvement must break visuals/business. No content hiding, delayed real first-screen content, changed throttling, reduced design dimensions or altered business behavior was used.

## Verification and evidence

- Production build and typecheck passed; 924 unit tests passed; lint has zero errors and the retained native platform-img warning. Final targeted tests: 18 passed. Asset/JS guard passed. Actual performance-budget failures are intentionally retained.
- Raw before, intermediate, pinned baseline, final three-run reports, screenshots, full font/image ledgers, build logs and browser evidence: `.artifacts/performance-closeout/`. Compact reviewable measurements are committed in `pr-76-measurements.json`.
- WebGL interaction, cache observations and CI results are appended below after their verification.

## WebGL and browser cache observations

Four real click-through profiles (desktop DPR 1/2/3 and mobile DPR 3), each with one actual local cast. Initially no canvas and no texture requests; authoritative faces match observed mesh faces after the cast; idle draw increments remain zero. Local, unthrottled Event Timing max is 128ms after vs 104ms before across the observed interactions. These short samples are interaction latency evidence, **not field INP** or a p75 RUM claim.

Desktop texture transfer: 12,483,234 → 870,184 bytes; mobile: 812,390 → 588,870 bytes. Desktop texture allocation estimate with RGBA8+mips: 42.7 → 10.7 MiB (calculation, not a browser GPU-memory measurement). At desktop DPR 3, canvas/render targets change from 4050×2820 to 2700×1880, a 55.6% pixel-count reduction. HDR/Bloom values and motion/physics stay intact.

| Profile | PMREM CPU ms before → after | First-render CPU ms before → after |
| --- | --- | --- |
| desktop DPR 1 | 53.5 → 37.5 | 82.6 → 60.8 |
| desktop DPR 2 | 38.1 → 27.2 | 108.2 → 45.9 |
| mobile DPR 3 | 37.3 → 29.0 | 29.6 → 33.9 |
| desktop DPR 3 | 29.6 → 32.2 | 117.3 → 39.6 |

CPU marks are single local observations; they are not GPU timer queries or stable FPS benchmarks. Browser screenshots at equal DPR show the same layout/composition; this is not a claim of pixel-identical encoding or independent user visual approval. Against source pixels resampled to the same output size, mobile lossless textures and resized lossless account coins preserve visible RGB; lossy derivatives preserve alpha exactly. PNG masters remain unmodified.

Browser cache read-back: hashed stage/texture responses have one-year browser/CDN directives; repeat fetches transfer 0 bytes. A newly requested logo transform returns max-age=86400 and Vary: Accept; a transform of a hashed source returns max-age=31536000. An older cached 64px logo transform still returns its previous 60-second TTL until regeneration. This legacy 2.5kB cache entry is preserved in the evidence, not presented as a one-day response. CDN edge HIT/MISS remains unverified.

Runtime asset inventory = 14 approved + 0 deferred + 0 rejected/deleted + 0 unknown; six source master targets are preserved. Full local budget replay rejects four mobile observations and exits 1. The existing populated Result Lighthouse gate passes mobile and desktop (the synthetic completed-cast auth gate only).

## Additional motion harness boundary

The existing motion harness returned 1 pass / 2 failures / 0 unreviewed. Normal and reduced-motion cases timed out waiting for `[data-history-saving]` after requesting `/ritual-qa-local?view=saving`. That temporary route is absent from this ordinary production build (HTTP 404); no QA page or authenticated response was introduced to manufacture acceptance. Treat those saving/reveal cases as **NOT VERIFIED in this environment**, not a successful physics/business regression test. The four actual-cast browser profiles and existing unit tests are separate evidence. CI already installs its own explicitly labeled local-only fixture; its result must be checked independently.

CI: see the existing [PR #76 checks](https://github.com/pyxm1618/quickiching/pull/76/checks) for the final pushed Head. Local performance budgets have four confirmed failures; a green ordinary CI job must not change the NOT PASS closeout decision.

## Changed files

Total: 42 files. Runtime delivery binaries are explicit, master PNGs are not modified.

- `.github/workflows/ritual-closeout-visual-qa.yml`
- `docs/performance/pr-76-assets.json`
- `docs/performance/pr-76-closeout.md`
- `docs/performance/pr-76-lab-baseline.json`
- `docs/performance/pr-76-measurements.json`
- `next.config.mjs`
- `public/performance/accountCoins.7a4f85ddcc102bdf.webp`
- `public/performance/coinBackDesktop.30c2cec3fcce7aae.webp`
- `public/performance/coinBackMobile.e8de8c6b39c8858b.webp`
- `public/performance/coinFrontDesktop.f247842ffde6714b.webp`
- `public/performance/coinFrontMobile.268fc93706d89c5d.webp`
- `public/performance/platformDesktop.6a80016afcf20338.webp`
- `public/performance/platformMobile.5ee9b24ef7aa3211.webp`
- `public/performance/questionDesktop.d616c1d6e5957a79.png`
- `public/performance/questionMobile.aeacbe5208415e49.webp`
- `public/performance/resultDesktop.c8b42fcbbe5723fe.webp`
- `public/performance/resultMobile.b62092713b0e63f0.webp`
- `public/performance/stageDesktop.e37364561615e31f.webp`
- `public/performance/stageMobile.285965e6cb8c7840.webp`
- `public/performance/stagePortrait.bde3e415eb141bc8.webp`
- `scripts/generate-performance-assets.mjs`
- `scripts/performance-asset-gate.mjs`
- `scripts/performance-budget.mjs`
- `scripts/performance-closeout-audit.mjs`
- `scripts/public-p0-lighthouse-gate.mjs`
- `scripts/result-lighthouse-gate.mjs`
- `scripts/ritual-scene-boundary-gate.mjs`
- `scripts/ritual-state-capture.mjs`
- `scripts/vercel-build.mjs`
- `src/app/(default)/hexagrams/hexagrams-experience.tsx`
- `src/app/(default)/readings/three-coin/result/page.tsx`
- `src/app/(localized)/zh/readings/three-coin/result/page.tsx`
- `src/app/fonts.ts`
- `src/components/account/account.css`
- `src/components/public-reading/question-first.tsx`
- `src/components/public-reading/ritual.css`
- `src/components/public-reading/three-coin-fallback.test.tsx`
- `src/components/public-reading/three-coin-fallback.tsx`
- `src/components/public-reading/three-coin-scene.tsx`
- `src/components/site-header.tsx`
- `src/lib/performance-budget.test.ts`
- `src/lib/visual-runtime-assets.ts`
