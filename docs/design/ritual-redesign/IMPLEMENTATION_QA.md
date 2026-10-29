# Phase 3–5 implementation / evidence ledger

Base commit: `8329ef2f3dfe912a2a0e37fdcbaddb6e06f5bf66`.
Performance checkpoint: `3911d3555c6bce582b4a9f5030421e4c0e943687` (pushed and remote SHA verified). The subsequent Complete Coverage changes are recorded in the new checkpoint containing QA_CAPTURE_INDEX.json.
Branch: `codex/three-coin-visual-phase3-5`.

This ledger records incomplete work. It is not an acceptance certificate.

## Current snapshot — Complete Coverage finished; Strict Pixel Closeout started

- Performance checkpoint `3911d3555c6bce582b4a9f5030421e4c0e943687` is pushed and its remote SHA was read back. No reset or baseline switch occurred.
- Pass 1 coverage: 7 = 0 PASS + 7 reviewed NOT PASS + 0 unreviewed + 0 deferred + 0 rejected. All seven have actual native browser captures, side-by-side, overlay, difference and concrete findings in `PASS_1_DIFF_INVENTORY.md`.
- All seven states were recaptured on the same QA build `ovnaexo_sa8Yer7I0tDQH`; isolated backgrounds are pixel-identical to the clean master in 7/7 states. Foreground status remains NOT PASS in all seven. No source-art permission waives layout, material or effects.
- New coverage checkpoint validation: ordinary production build PASS; 134 files / 879 tests PASS; lint PASS; full real-Chrome boundary suite 16/16 PASS, 0 FAIL / 0 unreviewed. Gate tests also assert that the new card/Deep Reading stay absent before save, and saved result lines render 6 → 1 from top to bottom.
- Result visual fixture uses the actual client with explicit local-only saved-reading props. This is not real authentication/History-save evidence. Its generated route was removed by exact owned-content verification.
- Full CI remains NOT PASS. Last measured mobile LCP 5670.60ms belongs to an earlier build; no fresh performance PASS is claimed.
- No PR, merge or deployment. Visual Complete: NO. Phase 3/4/5 remain incomplete.

## Coverage accounting

| Reference | Visual status | Local evidence directory |
|---|---|---|
| ref-01 Home | NOT PASS | `.artifacts/ritual-qa/seven-state-checkpoint/ref-01` |
| ref-02 Question | NOT PASS | `.artifacts/ritual-qa/seven-state-checkpoint/ref-02` |
| ref-03 Casting | NOT PASS | `.artifacts/ritual-qa/seven-state-checkpoint/ref-03` |
| ref-04 Cast Result | NOT PASS | `.artifacts/ritual-qa/seven-state-checkpoint/ref-04` |
| ref-05 Six-Line Progress | NOT PASS | `.artifacts/ritual-qa/seven-state-checkpoint/ref-05` |
| ref-06 Auth / Save Gate | NOT PASS | `.artifacts/ritual-qa/seven-state-checkpoint/ref-06` |
| ref-07 Result Reveal | NOT PASS | `.artifacts/ritual-qa/seven-state-checkpoint/ref-07` |

Internal reviewed NOT PASS = 7; unreviewed = 0; PASS = 0. No reference is rejected or excluded. Strict Pixel Closeout is a separate remaining gate.

## Locked environment

Canonical captures use production Next.js 15.5.25 at `127.0.0.1:3028`; installed real Chrome/155.0.8059.85; headless capture with Puppeteer; macOS Apple M4 / ANGLE Metal; viewport 1672x941 CSS px, zoom 1, DPR 1. WebGL2 verified. No fallback used in the captured Home screenshots.

Initial Tabbit attempts were excluded from canonical QA because viewport/DPR did not remain fixed and Next development JavaScript was blocked by the existing CSP. CSP was not weakened. The canonical captures use the production build.

## Intentional deviations

- Coin source art only: user explicitly confirmed that front/back master artwork is authoritative. Reference source-art differences are permitted; this does not waive dimensions, physical hole, thickness, perspective, angle, material response, highlights, shadows or effects. No texture is redrawn or warped.
- Background only: user explicitly confirmed on 2026-10-28 that production `bg-stage-master-clean.png` is the independent background QA target. Concept room/background differences are permitted only in that layer. No foreground differences are waived.
- Reference export edges only: top/left aligned; deterministic right/bottom crop/pad up to 2 pixels. No reference artwork scaling, warping or resampling.
- Reference `0/200` uses sample business data; runtime retains existing max=500 rather than changing question rules.
- Locked fonts remain Georgia / Kaushan Script. This does not waive layout metrics.

## Current implementation boundaries

- Real Three.js renderer shared across Home, Question and live casting, shared extruded round coin / physical square hole / inner wall / thickness, approved front/back textures, bronze material, lighting, emissive rim and local shader glow.
- Deterministic presentation pose function consumes `CoinFace`; no business random, derivation, persistence, auth, APIs or navigation in the scene.
- Four new presentation tests cover all 8 authoritative face combinations at landing, deterministic seed/time, seed-independent landing, and reduced-motion face preservation.
- Home and Question UI code is in development. No visual PASS is claimed.
- Plain `three` runtime dependency and `@types/three` development types added. Type package transitively installs addon typings including physics declarations; no physics engine is imported or used by the runtime.
- Local Puppeteer is installed ephemerally with `--no-save`; package manifest/lock were not changed by that QA install.
- Decoration crops are original pixels from the approved sheet: ink-circle `(45,0,855,682)`, gold-cloud `(1120,105,1970,445)`, divider `(750,465,1920,635)`, yin-yang part `(1210,465,1375,635)`. No regenerated art.

## Earlier verified snapshots (see current snapshot above)

- Main baseline: 130 files / 860 tests PASS before product edits.
- Full implementation unit suite: 133 files / 874 tests PASS under pinned Node/Bun after geometry/effect refinements, before the latest material and hero-pose calibration. Full suite must be repeated for final acceptance.
- Typecheck: PASS after physical-cap and effect-history changes; latest hero-pose and CTA calibration await rebuild.
- Build: PASS under pinned Node 22.23.2 / Bun 1.3.14 through iteration-14.
- Lint: latest run PASS, 0 errors / 0 warnings.
- One exact-copy scaffold assertion was updated from `Start Casting` to design CTA `Cast the Coins`; state/freeze assertions are retained.
- Real Chrome boundary gate: all 13 cases PASS on iteration-09 build: eight authoritative combinations, reduced motion, disabled WebGL fallback, module-load fallback, EN/ZH flow, and storage retry preserving the same cast. This is business/rendering regression evidence, not pixel or motion acceptance. Full final tests / full CI / seven-state pixel QA / complete motion QA: NOT VERIFIED.

Phase 3: FAIL (incomplete)
Phase 4: FAIL (incomplete)
Phase 5: FAIL (incomplete)

Business algorithm / API / DB / migration / auth backend / History backend / payment / AI backend changed: NO.
QUESTION_LOCKED: UNCHANGED. No live request was used to retest this known blocker.

Do not label this work `VISUAL / EXPERIENCE IMPLEMENTATION READY`.

## Latest Home observations

Iteration-09 removes the coplanar-surface z-fighting bands. Remaining identifiable differences include coin lighting, apparent tilt, trail shape/brightness, question-card edges, and CTA treatment. Home remains NOT PASS. Source-art clarification for decoration/parchment remains pending; it is not an approved deviation. Existing shared Header/BrandMark remain as explicitly required by ASSET_MANIFEST and TYPOGRAPHY_SPEC. Main H1 retains authoritative existing SEO copy; reference example text is not product-copy authority.

Background-only pixel comparison in iteration-10: PASS (`background-comparison.json`, difference bounding box null). Exactly one right-edge source column is repeated; no image resampling. This is not Home foreground acceptance. Iteration-11 foreground still NOT PASS.

Iteration-13: canonical Home runtime/reference/side-by-side/overlay/difference and build ID recorded. Foreground NOT PASS. Targeted real-browser `six-lines-auth` regression PASS: six actual algorithm calls / eighteen fixture bits, same session and earlier steps, auth-required gate, no primary/relating/deep result, and same completed session after refresh. This does not verify real-account History saving or formal Gate visuals.

Targeted `six-lines-auth-zh-reduced` browser regression also PASS: same six-line completion / auth concealment / refresh preservation assertions in ZH with Reduced Motion. The complete helper now defines 15 cases; the previous full ledger covers 13, and the two added targeted cases each have separate result files. Do not present this as one final full-suite 15-case run.

Fresh full browser boundary run on iteration-14 build: 15/15 PASS, 0 FAIL, 0 unreviewed. Settled real-WebGL screenshots were captured for the named regression cases; these are diagnostic scaffold screenshots, not formal ref-04 acceptance. Inspection identified remaining old palm/energy layers in the ritual scaffold; latest source removes these only from the Home ritual presentation, preserving the existing default-method UI. Full visual implementation remains incomplete.

Full local CI attempt 1 FAIL: exact H1 lost the space before the em dash after visual line splitting; corrected product text and added exact H1 unit assertion. Hero retains existing primary phrase; semantic SEO assertions are not weakened. Attempt 2 passes homepage semantic audit / SEO registry and browser language gates, then FAILS waiting for old scaffold confirmation copy. Gate is updated narrowly to observe the actual confirmation state and formal Cast the Coins CTA, and to wait for the specified reset to enable the next cast. Existing transaction/auth/result assertions remain. Final CI still NOT VERIFIED.

CI attempt 3: desktop transaction semantics and full completed-cast/auth flow PASS; 375px completed-cast/auth flow PASS; other-method browser flows PASS. It then FAILS because the mobile navigation check searches innerText for a one-line H1 while the approved visual H1 uses two blocks. The check now waits for the exact same H1 textContent, retaining exact copy and heading identity while allowing the formal visual line break. No navigation assertion is removed.

CI attempt 4: general browser gate, mobile navigation/footer, and on-page SEO PASS. Three-Coin V2 gate then FAILS because it treats the persistent renderer section as available casting controls during storage failure. Actual cast controls are absent. The gate now checks the real hold button and retains the assertion that it must be absent; its confirmation selector/CTA are updated to the same approved UI as the general gate. No storage/retry/reveal assertion is removed. Latest Home light paths (12 curves) are calibrated but all remain pending new screenshot inspection; no curve or Home PASS is implied.

CI attempt 5: all functional/SEO/language/navigation/logo gates PASS, but overall CI FAILS Lighthouse severe Home performance limits (mobile 61 / LCP 39781ms; desktop 75 / LCP 6346ms; accessibility/SEO both 100). Lighthouse identifies the question-card background as LCP: it unnecessarily downloads the full 3.3MB result-card master. Minimum fix in latest source: exact native-pixel interior crop `(512,350,1158,534)` from that unchanged master, preloaded at high priority. No resampling/new artwork or effect deletion. Transfer/visual outcome not yet reverified.

Targeted Lighthouse after card-crop preload: desktop performance 80 / accessibility 100 / SEO 100 / LCP 3739.95ms / TBT 76ms; mobile still FAILS (performance 61, simulated LCP 22230ms). Latest source adds an exact lossless center crop of the same clean room `(571,0,1100,941)` for portrait aspect ratio <=11/20. All RGBA channels are verified identical to the source crop; no resampling or new background art. Full canonical Desktop still uses the original full PNG. This implements the already-existing responsive center crop without transferring offscreen room pixels. Outcome pending rebuild.

Latest transfer optimization: full clean room also has a lossless WebP representation (1,567,634 bytes), verified identical in every RGBA channel to the unchanged PNG master. Canonical layout now uses that same full decoded image; browser isolated-background equality must be repeated before acceptance. Gold-cloud and yin-yang crops also have lossless same-dimension WebP representations with 2/2 RGBA-equality checks PASS. These are transfer representations of existing production art, not additional backgrounds/motifs or intentional visual deviations. Both coin PNG masters remain the direct runtime textures.

Iteration-16 browser codec check: full room, portrait room crop and paper crop each have 0 differing RGBA channels against their formal source. However transparent gold-cloud WebP has 178186 differing browser-decoded channels and yin-yang WebP has 30573, despite file-level equality. Both are NOT PASS and reverted to their approved PNG crops. Generated public WebP outputs removed with positive item-level evidence: total 2 = rejected 2 + pass 0 + unreviewed 0; both original PNG crops preserved. No codec deviation is accepted. The 16 capture is NOT PASS and its comparison/performance chain correctly stopped at this failed invariant.

Latest Home helper row: the existing required Skip — free reading only action now occupies the reference helper-text anchor instead of adding a second row. Action function, free-only wording and question-freeze rules are unchanged. Reference helper wording is non-authoritative sample product copy under ASSET_MANIFEST. This change awaits screenshot inspection.

Reduced Motion regression: new short-visible-travel test failed the previous implementation (58.73px observed within a continuous visible run vs 49.2px maximum for D=164). Latest presentation-only fix uses a 40px lift (0.244D), a zero-opacity anchor change, direct shortest rotation and 280ms duration; coordinated coins remove the small reduced-only stagger so the shared layer fade remains continuous. Authoritative faces/casts/session are unchanged. Browser QA pending.

CI attempt 6: 133 files / 875 tests PASS and all functional/SEO/language/transaction/auth/navigation/logo gates PASS. Overall FAIL remains: mobile LCP 7898ms (performance 66), desktop LCP 2313ms (performance 88); accessibility/SEO both 100 and CLS 0. Latest source applies only permitted non-QA mobile resource/DPR budgeting (Technical Design lines 612–613, 1021): WebGL DPR capped at 1 below 800px; same-room portrait crop resized 337x600 only below 600px; existing cloud motif sampled at 200x80 only for 100x40 mobile button decoration. Every effect and coin mesh/material remains. Canonical Desktop retains full room/full coin textures and its unmodified DPR. Paper is losslessly encoded at native dimensions; phone paper uses an exact same-center 400x184 crop (635,350,1035,534), with no resampling. Browser validation pending. No reference PNG is resampled.

Latest normative effect fixes: guided landing starts at 72%; late particle births are reduced by 70% once the first coin enters the 82% settle phase; new emission stops within 100ms of final landing; each trail fades for 220ms after its coin lands. Two regression tests failed the old envelopes and pass the corrected pure presentation functions. Casting receives its reference-required local origin glow; no business state is produced by effects.

Iteration-18 rejects both paper WebP representations: full crop 51910 and phone crop 30996 differing browser-decoded channels. The master paper alpha is 251–253, so file-level equality alone was insufficient. Both generated public WebP files were removed after reverting runtime/QA paths to native PNG crops. Total 2 = rejected 2 + unreviewed 0; original master and full PNG crop preserved. No color/alpha tolerance is introduced. Full suite on this source family: 133 files / 877 tests PASS. Fresh screenshot/performance pending PNG rebuild.

New texture-readiness browser regression observed RED: with both coin requests held, the old real-cast button remained enabled. Latest presentation fix defers heavy scene import until after an initial UI paint and keeps the real-cast action disabled until the real renderer has drawn both textures or compatibility fallback is established. The callback carries readiness only, never faces/results. Phase clocks update while assets load, and already-terminal restored stages do not replay absent Hero coins. All cast generation/persistence/auth ownership remains in existing application code. GREEN verification pending rebuild.

Iteration-20: texture-readiness browser case GREEN after observed RED; delayed textures cannot freeze or generate a cast, and release yields the same authoritative faces on the same canvas. Native canonical runtime remains pixel-identical to iteration-17 (null bbox), with 8/8 source crop/codec checks PASS and renderer DPR 1. Home still NOT PASS against the formal reference. Mobile LCP remains 5649.58ms after deferred initialization; readiness is a correctness fix, not a claimed performance PASS. Latest source adds responsive, high-priority discovery of the same room image in initial HTML.

Iteration-21: responsive preloads and non-QA 512x512 coin PNG derivatives preserve canonical Desktop pixels exactly (difference bbox null vs iteration-17). Desktop still loads both untouched master PNGs; eight source checks PASS. Mobile coin transfer falls from roughly 12.5MB to 0.81MB, but targeted Lighthouse still FAILS LCP at 5670.60ms (performance 78, TBT 126ms). No performance gate is weakened. Derivative source hashes, dimensions and Lanczos transform are recorded in `.artifacts/ritual-qa/mobile-resource-diagnostic/coin-provenance.json`. Latest source replaces the four flat-gradient airflow shaders with deterministic, slowly advected noise wisps, retaining the existing paths/lifetime/opacity limits; rebuild and visual inspection pending. No new reference state passes.

Iteration-22: latest production build, typecheck, lint and all 133 files / 877 unit tests PASS. Actual canonical Chrome capture and all 8 source codec/crop checks PASS; reference/runtime/side-by-side/overlay/difference generated. Airflow shader renders without console errors, but smoke richness, particles, trails and coin material still have identifiable reference differences. Home remains NOT PASS; no later reference state has been accepted. Full 16-case browser boundary rerun started and remains pending until its final ledger is inspected.

Iteration-22 full browser boundary rerun completed: total 16 = PASS 16 + FAIL 0 + unreviewed 0. Fresh full ledger inspected. Home remains NOT PASS, references 02–07 remain unreviewed, full CI still FAIL at the known mobile LCP gate. No PR or readiness claim.

## Pass 1 — Complete Coverage (2026-10-29)

Home frozen at iteration-22 as NOT PASS. Remaining foreground differences: coin thickness/readability and metallic contrast; light-trail path richness/brightness; particle distribution/extent; smoke-like airflow visibility; question-card border/corner artwork; CTA border/glow/ornament treatment; precise heading/layout metrics. Background/source engraving deviations remain narrowly authorized; no other visual tolerance is implied. Progress now proceeds to ref-02–07 regardless of Home status. Performance remains a separate known blocker (mobile LCP 5670.60ms).

User clarification: only decorative/parchment source-art differences follow the official decorative-elements and blank-card masters. No exemption applies to crop, aspect ratio, position, size, opacity, layering, typography, color, composition, material, shadows or glow. This supersedes earlier pending-art clarification.
Ref-02 first production capture completed with 0 business random draws; full comparison files exist. NOT PASS: title/ornament metrics, card border/crop treatment, divider width and CTA icon/glow differ. Character-count synchronization in capture helper also needs correction before final capture.

## Performance profiling checkpoint

2026-10-29: checkpoint preserves existing implementation, including the newly connected casting presentation. Fresh production build PASS; complete unit suite 134 files / 879 tests PASS; complete real-Chrome boundary suite 16/16 PASS (0 FAIL, 0 unreviewed); lint and diff whitespace checks PASS. No visual/business code was modified for this checkpoint. Home stays NOT PASS; ref-02–07 complete visual QA is pending; Visual Complete = NO. Full CI remains NOT PASS and was not rerun for this checkpoint. This is a reproducible profiling baseline, not Phase 3–5 completion.

Staging audit: 43 related source/asset/tool/document files; 241 local temporary artifact files excluded and preserved. No reference or original production master is modified. No API, database, migration, Auth backend, History backend, payment or AI changes. QUESTION_LOCKED is UNCHANGED / BUSINESS RELEASE BLOCKED.

After checkpoint: ref-03 actual casting at fixed 500ms captured and compared, NOT PASS (pose/lighting/trail curvature/particle extent/heading metrics). First helper incorrectly serialized DOMStringMap as empty; capture was rejected and repeated with explicit attribute copying, verifying real WebGL and phase. ref-04 real first cast captured and compared, NOT PASS (overbright metallic response, label geometry, result-heading metrics, CTA treatment); final fixture now uses reference Heads/Tails/Tails without changing the algorithm. ref-05 first capture exposed a presentation-layer opacity defect; only the last coin opacity had controlled the whole layer. Fix uses maximum visible opacity, preserving all existing three-coin phases. Revised capture shows the actual single shared-mesh progress coin and bottom-up recorded rows. NOT PASS: overexposed coin, excessive high trails, insufficient smoke richness, progress/sidebar ornament and spacing. Source line data remains authoritative; no second progress state was introduced.

Pass 1 completed: all seven states have native real-browser evidence and an explicit NOT PASS finding list. Scope is still presentation only. Pass 2 begins with a bounded shared-metal calibration (face tint 0x888888; key intensity 2.0) to address observed face overexposure, without changing textures, geometry, camera, particles, paths or business data. Also removes legacy reading-reveal purple/white background and border only within the Ritual result wrapper; other methods retain their original DOM via a Fragment. New screenshots and regression verification pending.

Strict closeout iteration-23: Home has a fresh native runtime/reference/side-by-side/overlay/difference set. Eight source pixel checks PASS, real WebGL/DPR1 confirmed, no console errors. Home remains NOT PASS; material calibration alone does not resolve trails, smoke, particles, typography/card/CTA differences. Fresh ordinary build (without the temporary fixture route), 134 files / 879 tests, lint and full 16/16 Chrome boundary suite PASS. Temporary QA URL returns HTTP 404; generated route is absent from source. These post-checkpoint changes remain uncommitted; remote checkpoint 3911d35 is unchanged. No manual deployment command was run; automated provider deployment status was not checked.

Coverage checkpoint closeout: seven native capture/diff sets share one QA build; all foregrounds remain NOT PASS, all seven isolated clean backgrounds compare exactly. Ordinary build excludes the generated fixture route and returns 404 for it. Fresh 879 unit tests / 16 browser cases / lint PASS. Evidence hashes and complete findings are recorded in QA_CAPTURE_INDEX.json and PASS_1_DIFF_INVENTORY.md. Performance patch a169a4c6dd8ae58e86d4619b89ea039925997257 remains unintegrated. This is a new development checkpoint after 3911d355, not visual completion.
