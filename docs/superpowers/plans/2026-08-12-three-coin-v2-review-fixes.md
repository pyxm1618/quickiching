# Three-Coin V2 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve PR #22's two P1 and two P2 independent-review findings without changing the V2 architecture or scope.

**Architecture:** Keep the existing casting domain, result route, 16 interpretation chunks, dynamic loader, deterministic synthesis, and V1 paths for Yarrow/Mei Hua. Strengthen browser-session persistence as an explicit error boundary and move V2 prose authorship from a shared line-position generator into per-line/per-hexagram catalog data.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, Puppeteer/Chromium, Lighthouse, sessionStorage.

## Global Constraints

- Same PR #22 and branch `three-coin-free-reading-v2`; do not merge.
- No production deployment, Google/Bing submission, or production IndexNow.
- No AI, auth, DB, payment, credits, CMS, localization, or sharing.
- Do not change casting randomness, King Wen mapping, result URL, noindex policy, or public SEO URL set.
- Yarrow and Mei Hua remain on their existing V1 result path.
- Test-first for every behavioral change.

---

### Task 1: Make Three-Coin session persistence fail fast

**Files:**
- Modify: `src/lib/three-coin-session.test.ts`
- Modify: `src/lib/three-coin-session.ts`
- Modify: `src/components/public-reading/three-coin-tool.tsx`
- Modify: `src/components/three-coin-result/three-coin-result-client.tsx`
- Modify: `scripts/three-coin-v2-browser-gate.mjs`

**Interfaces:**
- `readThreeCoinSteps(): ThreeCoinStep[]` throws `THREE_COIN_SESSION_READ_FAILED` when browser `getItem` throws.
- `writeThreeCoinSteps(steps): void` validates then throws `THREE_COIN_SESSION_WRITE_FAILED` when `setItem/removeItem` throws.
- `clearThreeCoinReading(): void` throws `THREE_COIN_SESSION_CLEAR_FAILED` when `removeItem` throws.

- [ ] Add Vitest cases that replace `window.sessionStorage` methods with throwing implementations and assert exact error codes for read/write/clear.
- [ ] Run `bun vitest run src/lib/three-coin-session.test.ts` and confirm the new cases fail because current code swallows storage errors.
- [ ] Change the session boundary to throw the exact errors above while retaining current invalid-shape parsing behavior.
- [ ] Run the focused session tests and confirm green.
- [ ] Add UI state for a persistence failure in `ThreeCoinTool`; write the new committed step before updating React `steps`, and abort the cast commit if persistence throws.
- [ ] Ensure a failed write cannot produce `Six lines sealed`, `Your hexagram is formed`, or `Reveal Your Reading`; expose a concise recoverable error message and allow retrying the same line.
- [ ] Change incomplete-reading `reset()` so storage clear occurs before in-memory reset; if clear throws, keep the current reading and surface the error.
- [ ] Change result-page `Start a New Reading` so navigation only occurs after `clearThreeCoinReading()` succeeds; on failure keep the result visible and show `THREE_COIN_SESSION_CLEAR_FAILED`.
- [ ] Extend Chromium gate with injected `getItem`, `setItem`, and `removeItem` failures proving the UI fail-fast behavior.
- [ ] Commit the task.

---

### Task 2: Remove duplicate anchor ID and clean completed reset UX

**Files:**
- Modify: `src/components/public-reading/three-coin-tool.tsx`
- Modify: `scripts/browser-gate.mjs`
- Modify: `scripts/three-coin-v2-browser-gate.mjs`

**Interfaces:**
- Homepage `src/app/page.tsx` remains the sole owner of `id="three-coin-reading"`.
- Sidebar reset is available only while `visuallyComplete === false`.

- [ ] Add browser assertions that homepage `document.querySelectorAll('#three-coin-reading').length === 1` and that the completed chamber exposes `Reveal Your Reading` but no sidebar `New reading` button.
- [ ] Run the browser gate against the current head and confirm those assertions fail.
- [ ] Remove `id="three-coin-reading"` from the `ThreeCoinTool` root section.
- [ ] Render the sidebar `New reading` control only before visual completion; do not add a replacement destructive completed-state control.
- [ ] Run the focused browser gate and confirm green.
- [ ] Commit the task.

---

### Task 3: Replace template-expanded line prose with authored line records

**Files:**
- Modify: `src/domain/interpretation/v2/profile.ts`
- Modify: `src/domain/interpretation/v2/types.ts` only if needed for input-profile typing; do not change the public `LineInterpretation` output shape.
- Modify all 16 files under `src/domain/interpretation/v2/catalog/`.
- Modify: `src/domain/interpretation/v2/interpretation-completeness.test.ts`
- Modify: `src/domain/interpretation/v2/build-free-reading.test.ts` only where fixtures/assertions must reflect authored data.
- Modify: `docs/THREE_COIN_FREE_READING_V2_PROVENANCE.md`

**Interfaces:**
- Replace `lineEmphases: [string × 6]` with six complete authored line input records containing `theme`, `meaning`, `changeDynamic`, `caution`, `reflection`, and `synthesisPhrase`.
- Each hexagram profile also owns authored `coreMeaning`, `structureInterpretation`, `reflectionQuestions`, and `watchFor`; shared code may validate/normalize but may not generate their substantive prose from one sentence template.
- `buildInterpretationBundle()` becomes assembly/validation only and returns the same `HexagramInterpretationBundle` public shape.

- [ ] Strengthen completeness tests first: assert every line input has all six authored semantic fields, remove reliance on the old `lineEmphases` generator, keep 64/384 uniqueness/completeness, and add deterministic repetition guards over opening signatures for `meaning`, `changeDynamic`, `caution`, `reflection`, `coreMeaning`, reflection questions, and watch items.
- [ ] Add explicit regression fixtures for Hexagram 1 lines 2/5 and Hexagram 24 lines 1–6 so their distinctive received-context themes cannot collapse into generic position prose.
- [ ] Run focused interpretation tests and confirm RED against the current `lineEmphases + buildLineInterpretation()` implementation.
- [ ] Refactor `profile.ts` into validation/assembly helpers; delete the substantive `POSITION_PRESENTATION` prose generator from line output.
- [ ] Migrate catalog chunks 01–04, then run focused tests for those records.
- [ ] Migrate chunks 05–08; run focused tests.
- [ ] Migrate chunks 09–12; run focused tests.
- [ ] Migrate chunks 13–16; run focused tests.
- [ ] Migrate chunks 17–20; run focused tests.
- [ ] Migrate chunks 21–24 with explicit Hexagram 24 six-line review; run focused tests.
- [ ] Migrate chunks 25–28; run focused tests.
- [ ] Migrate chunks 29–32; run focused tests.
- [ ] Migrate chunks 33–36; run focused tests.
- [ ] Migrate chunks 37–40; run focused tests.
- [ ] Migrate chunks 41–44; run focused tests.
- [ ] Migrate chunks 45–48; run focused tests.
- [ ] Migrate chunks 49–52; run focused tests.
- [ ] Migrate chunks 53–56; run focused tests.
- [ ] Migrate chunks 57–60; run focused tests.
- [ ] Migrate chunks 61–64; run focused tests.
- [ ] Run the full interpretation test set and verify exactly 64/384 records, no duplicate keys, deterministic composition, and no old generator dependency.
- [ ] Update provenance to state accurately that each V2 line now stores its complete authored semantic fields; retain the classical/modern copyright boundary and Quick I Ching presentation-convention disclaimer.
- [ ] Commit the content task.

---

### Task 4: Full verification and PR handoff

**Files:**
- Modify validation scripts only if a failing gate exposes a real regression; do not lower thresholds.

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run all Vitest tests.
- [ ] Run IndexNow dry-run and verify the public live set remains exactly eight URLs.
- [ ] Run production `next build`.
- [ ] Run real Chromium gates: Three-Coin cast/reveal/result/refresh/back/forward/reset/invalid state/storage-failure paths at desktop plus 320/375/390; Yarrow and Mei Hua regressions; clean 404 metadata; unique anchor ID; completed-reset UX.
- [ ] Run interpretation bundle gate and prove V2 prose is absent from homepage JS and only selected result chunks load.
- [ ] Run homepage and populated-result Lighthouse mobile/desktop without lowering existing thresholds.
- [ ] Perform final SRP/YAGNI/KISS/naming/fail-fast/cohesion review over the review-fix diff.
- [ ] Confirm PR #22 is Draft, not merged, and no production submission/deployment was initiated.
- [ ] Report the new exact head SHA and only claim READY FOR SECOND INDEPENDENT REVIEW if all gates pass.
