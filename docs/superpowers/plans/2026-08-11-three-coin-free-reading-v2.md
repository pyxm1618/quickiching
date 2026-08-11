# Three-Coin Free Reading V2 Implementation Plan

**Goal:** Deliver a complete deterministic, no-login, no-AI Three-Coin result page with 64 hexagram interpretations, 384 moving-line interpretations, synthesis, browser-session recovery, Concept A/Motion F UI, strict SEO boundaries, and the isolated 404 metadata fix.

**Base:** `main` at `48857221c0ca21ba76638b4d36fe567d62800621`

**Branch:** `three-coin-free-reading-v2`

**Architecture:** Preserve the existing casting engine and authoritative release/session semantics. Keep V1 interpretation intact for Yarrow/Mei Hua. Put V2 interpretation behind sixteen explicit dynamic catalog chunks (`01-04` … `61-64`) so the Three-Coin homepage never imports the 64/384 prose catalog and a result loads only the chunk(s) needed for its primary/relating hexagrams.

## Locked constraints

- No change to Three-Coin randomness, King Wen mapping, moving-line derivation, or Motion F authority boundary.
- No AI, question input, personalization, auth, DB, payment, credits, history, permanent sharing, CMS, localization, SEO hexagram/line pages, or production indexing submission.
- Result URL exactly `/readings/three-coin/result`; no state in path/query.
- Result is `noindex, follow`, absent from sitemap and IndexNow live set.
- Public SEO V1 title/description/H1/canonical and exact eight indexable URLs remain unchanged.
- Only explicit `Start a New Reading` clears the completed session.
- Draft PR only; no merge or production deployment.

## Task 1 — Shared Three-Coin session boundary

Files:
- `src/lib/three-coin-session.ts`
- `src/lib/three-coin-session.test.ts`
- minimal integration in `src/components/public-reading/three-coin-tool.tsx`

Implementation:
- [x] Preserve the existing storage key.
- [x] Validate JSON shape, 0–6 length, exact sequential indexes, legal 6/7/8/9 values, legal coin faces, current algorithm version, and coin-face arithmetic.
- [x] Expose focused read/write/clear/completed functions.
- [x] Keep release-time persistence authoritative before Motion F visual settlement.
- [ ] Execute session tests on the exact final head.

## Task 2 — Interpretation catalog and provenance

Files:
- `src/domain/interpretation/v2/types.ts`
- `src/domain/interpretation/v2/profile.ts`
- `src/domain/interpretation/v2/catalog/01-04.ts` … `61-64.ts`
- `src/domain/interpretation/v2/load-interpretation.ts`
- `src/domain/interpretation/v2/interpretation-completeness.test.ts`
- `docs/THREE_COIN_FREE_READING_V2_PROVENANCE.md`

Implementation:
- [x] Define only fields used by the result product.
- [x] Add 64 hexagram profiles.
- [x] Add six separately authored semantic emphases for every hexagram: 384 exact `(hexagramNumber, position)` inputs.
- [x] Expand those semantic inputs deterministically into theme/meaning/change/caution/reflection/synthesis fields.
- [x] Add fail-fast 1–64 dynamic loader across sixteen four-hexagram chunks.
- [x] Record classical/historical research boundary and original-prose policy.
- [x] Add quality gates for 64/384 completeness, duplicate keys/content, placeholders, prophecy language, and highly repetitive line openings.
- [ ] Execute completeness/content-quality tests on the exact final head.

## Task 3 — Deterministic synthesis

Files:
- `src/domain/interpretation/v2/build-reading-synthesis.ts`
- `src/domain/interpretation/v2/build-free-reading.ts`
- `src/domain/interpretation/v2/build-free-reading.test.ts`

Implementation:
- [x] Keep casting facts supplied exclusively by existing `buildHexagramResult`.
- [x] Bind actual 6/9 lines to Old yin/Old yang and yin→yang/yang→yin direction.
- [x] Stable branch for zero moving lines.
- [x] Include every moving line bottom→top for single/multiple/six-line cases.
- [x] Compare relating structure without deterministic future claims.
- [x] Produce Situation / Where Change Is Happening / Direction of Change / 50–100 word Bottom Line.
- [x] Add fixtures for zero, one, multiple, and six changes plus casting-invariance/determinism assertions.
- [ ] Execute synthesis tests on the exact final head.

## Task 4 — Result route and UI

Files:
- `src/app/readings/three-coin/result/page.tsx`
- `src/components/three-coin-result/three-coin-result-client.tsx`
- `src/components/three-coin-result/reading-result-view.tsx`
- `src/components/three-coin-result/result-page.module.css`

Implementation:
- [x] Server route shell with result-specific `noindex, follow` metadata and no canonical.
- [x] Small client controller owns only session restore, deterministic cast rebuild, dynamic interpretation load, error/empty/ready state, and explicit reset.
- [x] Pure result view owns Overview, Primary, Structure, Changing Lines, optional Relating, Synthesis, Bottom Line, Reflection, What to Watch, disclaimer, and New Reading.
- [x] No-changing-lines and multiple-changes conventions implemented explicitly.
- [x] Concept A/Motion F visual language, responsive transformation path, moving-line text/glyphs, visible focus, and reduced-motion CSS.
- [ ] Execute 320/375/390 overflow and accessibility-sensitive browser checks on the exact final head.

## Task 5 — Three-Coin formed → reveal transition

File:
- `src/components/public-reading/three-coin-tool.tsx`

Implementation:
- [x] Sixth release still commits and persists immediately.
- [x] Motion F still delays only visual disclosure.
- [x] After final settlement show `Your hexagram is formed` + `Reveal Your Reading`.
- [x] Remove only Three-Coin inline V1 result; Yarrow/Mei Hua remain on V1.
- [x] No navigation-time recast or reset.
- [ ] Execute real six-cast Chromium flow on the exact final head.

## Task 6 — SEO and 404 boundary

Files:
- `src/lib/seo.ts`
- `src/lib/seo.test.ts`
- `src/lib/indexnow.test.ts`
- `src/app/[...not-found]/page.tsx`
- `src/app/not-found.tsx`

Implementation:
- [x] Keep `INDEXABLE_PATHS` at the existing eight public URLs.
- [x] Treat Three-Coin result as non-indexable product state.
- [x] Reject result URL from IndexNow live normalization.
- [x] Add dedicated unmatched-route metadata + not-found UI.
- [x] Add production-HTML assertions for result robots and clean 404 title/robots/description/canonical/OG.
- [ ] Execute those HTTP/head assertions against a production build on the exact final head.

## Task 7 — Browser, bundle, Lighthouse, and regression gates

Files:
- `scripts/browser-gate.mjs`
- `scripts/three-coin-v2-browser-gate.mjs`
- `scripts/interpretation-bundle-gate.mjs`
- `scripts/result-lighthouse-gate.mjs`
- `scripts/vercel-build.mjs`

Implementation:
- [x] Real Three-Coin flow: cast six → formed → reveal → fixed result URL → refresh → explicit New Reading.
- [x] Legal deterministic fixture: invalid direct result, desktop, 320/375/390, refresh, back, forward, reset.
- [x] Preserve Yarrow start/resume/result/reset and Mei Hua result/reset regression gates.
- [x] Inspect browser-downloaded JS for absence of V2 prose on homepage and selected primary/relating chunks on result.
- [x] Homepage Lighthouse Mobile/Desktop preserved.
- [x] Populated result Lighthouse Mobile/Desktop added with preserved sessionStorage; record Performance/Accessibility/SEO/LCP/CLS/TBT while not treating result SEO score as an indexing gate.
- [x] Keep IndexNow execution dry-run only.
- [ ] Execute all runtime gates on the exact final head.

## Task 8 — Self-review and PR

- [x] SRP: storage, casting, interpretation composition, client orchestration, and presentation have separate responsibilities.
- [x] YAGNI/KISS: no API, AI/provider layer, DB, auth, payment, CMS, rule engine, class hierarchy, DI, Redux/Zustand, or future commercial abstractions.
- [x] Naming: new business boundaries use concrete names such as `completedThreeCoinSteps`, `primaryBundle`, `activeLineInterpretations`, `buildReadingSynthesis`, and `clearThreeCoinReading`; no vague production `processReading`/`handleStuff`/`doThing` style functions were introduced.
- [x] Fail Fast: invalid session state becomes formal empty state; malformed interpretation keys throw explicit errors; primary/relating bundle mismatches and moving-line mismatches are explicit errors.
- [x] Cohesion: casting owns what was cast; interpretation owns static explanation/synthesis; result UI owns presentation.
- [x] Draft PR #22 created against `main`.
- [ ] Formal exact-head CI/runtime evidence must pass before verdict can be `READY FOR INDEPENDENT REVIEW`.
- [ ] After validation, ensure PR is returned to Draft and remains unmerged/unpublished.