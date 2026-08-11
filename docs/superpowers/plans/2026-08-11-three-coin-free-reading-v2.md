# Three-Coin Free Reading V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete deterministic, no-login, no-AI Three-Coin result page with 64 hexagram interpretations, 384 moving-line interpretations, synthesis, state recovery, Concept A/Motion F UI, clean SEO boundaries, and a verified 404 metadata fix.

**Architecture:** Preserve the current casting engine and authoritative session semantics. Split V2 interpretation into per-hexagram dynamic chunks so the result client loads only the primary/relating content and the homepage never hydrates the 64/384 prose dataset. Keep Yarrow/Mei Hua on the existing V1 interpretation path.

**Tech Stack:** Next.js 15.5.20 App Router, React 19, TypeScript, Tailwind/CSS, Vitest, Puppeteer/Chromium, Lighthouse, GitHub Actions.

## Global Constraints

- Base exactly current `main` SHA `48857221c0ca21ba76638b4d36fe567d62800621`.
- Branch `three-coin-free-reading-v2`; Draft PR only; do not merge or deploy production.
- Do not change Three-Coin randomness, King Wen mapping, moving-line derivation, public SEO title/description/H1/canonical, public method URLs, robots policy, or the eight indexable URLs.
- No AI, question input, personalization, auth, database, payment, credits, history, permanent sharing, CMS, localization, new SEO detail pages, or production IndexNow.
- Result URL is exactly `/readings/three-coin/result`, has `noindex, follow`, and carries no reading state in path/query.
- Only explicit `Start a New Reading` clears the completed Three-Coin session.
- Yarrow and Mei Hua continue using the current V1 `ReadingResult`.

---

### Task 1: Shared Three-Coin browser-session boundary

**Files:**
- Create: `src/lib/three-coin-session.ts`
- Create: `src/lib/three-coin-session.test.ts`
- Modify: `src/components/public-reading/three-coin-tool.tsx`

**Interfaces:**
- Produces `THREE_COIN_SESSION_STORAGE_KEY`, `parseThreeCoinSteps(raw)`, `readThreeCoinSteps()`, `writeThreeCoinSteps(steps)`, `clearThreeCoinReading()`, `completedThreeCoinSteps(steps)`.
- Consumes existing `ThreeCoinStep`, `ALGORITHM_VERSIONS`.

- [ ] Write failing tests for malformed JSON, non-array, >6 steps, discontinuous indexes, illegal faces/values/version, partial valid casts, and exact six-step completed casts.
- [ ] Implement pure parse/validation plus thin browser read/write/clear functions. Storage-unavailable reads return no reading; write failure does not change current React authority.
- [ ] Replace duplicated `STORAGE_KEY`/parsing logic in `ThreeCoinTool` without changing casting or Motion F semantics.
- [ ] Run `bun run test -- src/lib/three-coin-session.test.ts` and the existing Three-Coin tests.

### Task 2: Interpretation V2 types, records, provenance, and loaders

**Files:**
- Create: `src/domain/interpretation/v2/types.ts`
- Create: `src/domain/interpretation/v2/hexagrams/01.ts` … `64.ts`
- Create: `src/domain/interpretation/v2/load-interpretation.ts`
- Create: `src/domain/interpretation/v2/interpretation-completeness.test.ts`
- Create: `docs/THREE_COIN_FREE_READING_V2_PROVENANCE.md`

**Interfaces:**
- `HexagramInterpretation` includes number, coreTheme, coreMeaning, strength, challenge, orientation, structureInterpretation, reflectionQuestions, watchFor, transitionTheme, stabilityTheme.
- `LineInterpretation` includes hexagramNumber, position, theme, meaning, changeDynamic, caution, reflection, synthesisPhrase.
- Each per-hexagram module exports exactly one hexagram record and exactly six line records.
- `loadHexagramInterpretation(number)` dynamically imports one module and fails with `HEXAGRAM_INTERPRETATION_MISSING: number=<n>` for invalid/missing content.

- [ ] Author 64 composition-ready original hexagram records, migrating reliable V1 theme meaning rather than deleting it.
- [ ] Author all 384 original line records, one through six for every King Wen number, with position-specific semantics and no modern translation copying.
- [ ] Document King Wen/trigram/classical-line research sources, source boundaries, original-prose method, and explicit avoidance of modern copyrighted translations.
- [ ] Add tests proving 64/64, 384/384, no duplicate keys, positions exactly 1–6, all required fields non-empty, no TODO/TBD/Lorem placeholders, unique core meanings, unique line meanings, non-global reflection sets, and non-global cautions.

### Task 3: Deterministic reading composition

**Files:**
- Create: `src/domain/interpretation/v2/build-reading-synthesis.ts`
- Create: `src/domain/interpretation/v2/build-free-reading.ts`
- Create: `src/domain/interpretation/v2/build-free-reading.test.ts`

**Interfaces:**
- `buildFreeReading(result, primaryBundle, relatingBundle?)` validates record/result agreement and returns overview/primary/activeLines/relating/synthesis.
- `buildReadingSynthesis(...)` returns `situation`, `whereChangeIsHappening`, `directionOfChange`, `bottomLine` only.

- [ ] Write fixtures for `[7,7,7,7,7,7]` (no moves), `[9,7,7,7,7,7]` (single move: 1→44), a 2–3 move fixture, and `[9,9,9,9,9,9]` (six moves: 1→2).
- [ ] Implement stable/single/multiple-change composition with all active lines ordered bottom→top.
- [ ] Assert relating comparison language is structural/emerging, never deterministic future prediction.
- [ ] Assert calling the interpretation layer cannot alter `primaryHexagramNumber`, `movingLinePositions`, or `relatingHexagramNumber` produced by `buildHexagramResult`.

### Task 4: Result route and Product UI

**Files:**
- Create: `src/app/readings/three-coin/result/page.tsx`
- Create: `src/components/three-coin-result/three-coin-result-client.tsx`
- Create: `src/components/three-coin-result/reading-result-view.tsx`
- Create: `src/components/three-coin-result/result-page.module.css`
- Optionally create small focused presentation subcomponents only when they remove a distinct responsibility from `reading-result-view.tsx`.

**Interfaces:**
- Server page exports result-specific static metadata with `robots: { index: false, follow: true }` and no canonical/home OG.
- Client controller reads/validates completed steps, rebuilds `HexagramResult`, dynamically loads required interpretation bundles, and renders loading/empty/ready states.
- View is pure presentation and receives a complete `FreeReading` plus `HexagramResult`.

- [ ] Implement formal invalid state: `No completed reading found`, explanatory sentence, `Start a Three-Coin Reading` to `/#three-coin-reading`.
- [ ] Implement Overview, Primary, Structure, Changing Lines/No Changing Lines, optional Multiple Changes, optional Relating with explicit contrast, Synthesis, Bottom Line, Questions to Sit With, What to Watch, disclaimer, and `Start a New Reading`.
- [ ] Use `HexagramLines` for full figures; actual moving positions must include text/glyph state as well as cyan styling.
- [ ] Implement a restrained aura→figure→identity reveal and section reveal with `prefers-reduced-motion` fallbacks.
- [ ] Ensure correct H1/H2 hierarchy, keyboard focus, accessible line descriptions, no whole-page aria-live, and no 320/375/390 horizontal overflow.

### Task 5: Three-Coin formed → reveal transition

**Files:**
- Modify: `src/components/public-reading/three-coin-tool.tsx`

**Interfaces:**
- Uses current Motion F `revealedCount === 6` as the visual completion gate.
- Uses Next navigation/link only after completed state exists.

- [ ] Replace Three-Coin inline V1 result with `Your hexagram is formed` completion copy and `Reveal Your Reading` CTA after the sixth settle.
- [ ] Keep sixth-step persistence at release exactly where it is; do not cast/recompute on navigation.
- [ ] Keep current inline `New reading` behavior only for the casting chamber before reveal if present; result-page `Start a New Reading` is the explicit completed-session reset.
- [ ] Verify Back/Forward do not call reset and returning to the casting page restores six sealed lines.

### Task 6: Result SEO boundary and clean 404 metadata

**Files:**
- Modify only if needed: `src/lib/seo.ts`, `src/lib/seo.test.ts`, `src/lib/indexnow.test.ts`
- Create: `src/app/[...not-found]/page.tsx`
- Create: `src/app/not-found.tsx` if required by the verified Next.js 15 behavior.

**Interfaces:**
- `INDEXABLE_PATHS` remains byte-for-byte the same eight paths.
- Result route is treated as non-indexable/private product state but remains HTTP 200 with `noindex, follow`.
- Unmatched URL returns HTTP 404 with one 404-specific title and no homepage description/index/Open Graph conflict.

- [ ] Add failing SEO/unit/browser expectations before implementation.
- [ ] Implement the smallest Next App Router catch-all/not-found solution that passes real production-HTML assertions.
- [ ] Verify result absent from sitemap and `defaultIndexNowUrls()`; `normalizeIndexNowLiveUrl('/readings/three-coin/result')` must reject it.

### Task 7: Browser, Lighthouse, and bundle gates

**Files:**
- Modify: `scripts/browser-gate.mjs`
- Modify: `scripts/vercel-build.mjs`
- Add focused helper script only if needed to Lighthouse a seeded full result without query/path state.

**Interfaces:**
- Browser helper can seed only the existing Three-Coin sessionStorage key with valid deterministic fixture steps; product code gets no test-only route/query hook.

- [ ] Desktop E2E: homepage → six lines → `Your hexagram is formed` → Reveal → fixed URL → verify all result sections → capture reading text → refresh and assert exact equality → Back → Forward → exact equality → Start a New Reading → storage absent → Line 1 state.
- [ ] New context direct result URL: empty state, no fake reading, CTA back.
- [ ] 320/375/390 result checks: no horizontal overflow and key sections visible.
- [ ] Preserve Yarrow resume/result/reset and Mei Hua result/reset gates.
- [ ] HTTP gate: result 200 + `noindex, follow`, sitemap exact eight URLs, 404 status/title/noindex/no home description/no home OG/canonical conflict.
- [ ] Lighthouse a seeded full result page and homepage on mobile and desktop; retain existing severe-regression thresholds and report LCP/CLS/TBT.
- [ ] Inspect production build route/chunk output and browser resource URLs. Fail the gate if the homepage imports any V2 `hexagrams/*` prose chunk or the complete interpretation dataset.

### Task 8: Self-review, formal CI, and Draft PR

**Files:**
- Review complete branch diff.
- No production configuration/deployment changes.

- [ ] Self-review SRP: no function reads storage + computes cast + builds interpretation + renders UI.
- [ ] Self-review YAGNI/KISS: no API/AI/payment/CMS/rule-engine/classes/DI/state-store added.
- [ ] Self-review naming for vague new business identifiers (`data`, `temp`, `helper`, `process`, ambiguous `handle`).
- [ ] Self-review fail-fast boundaries for session, hexagram lookup, line lookup, and missing interpretation content.
- [ ] Run formal GitHub Actions on the exact head and inspect every step/result; do not infer PASS from a pending/missing run.
- [ ] Create Draft PR against `main`; do not merge, deploy production, submit Google/Bing, or send production IndexNow.
- [ ] Produce final report in the 14-section format required by the task, using `NOT READY` for any unverified mandatory gate.