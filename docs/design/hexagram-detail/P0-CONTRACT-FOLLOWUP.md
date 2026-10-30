# PR #70 P0 source-contract follow-up

The failed Public SEO run was `40868552129`, head `e1bd74c4602f69adb21accfbd880ea9057435096`. Its failure came from `scripts/public-p0-browser-gate.mjs`: the English page no longer used the old literal headings “Classical source record” and “Fixed records for the six lines”. The existing `>= 7` classical source-link assertion passed before that obsolete wording assertion failed.

The replacement asserts the actual approved knowledge-page section, Judgment and Image subsections, and their real fixed classical source links. Canonical and six line-anchor assertions remain. The source checks are stronger: every scoped Wikisource link must match the current hexagram's exact fixed URL/revision; each of the six individually labelled line-source links must match the classical catalog. Chinese classical-text assertions remain. No UI, style, data, API, service or dependency changes were needed for this fix.

Verified locally against the existing production build:

- Original P0 command reproduced the exact obsolete-wording failure.
- Updated full `PUBLIC_V1_TEST_BASE_URL=http://localhost:3217 bun scripts/public-p0-browser-gate.mjs` passed all existing flows.
- Added component regression covers the exact fixed source and all six individually labelled line links across 64 hexagrams × 2 locales.
- Full unit suite: 130 files / 861 tests PASS; lint and typecheck PASS.
- Negative audit 1: removing the third line's real source anchor in temporary browser DOM still leaves seven global source links, but the updated gate correctly fails the per-line completeness assertion.
- Negative audit 2: replacing that anchor's `oldid` with `1` in temporary browser DOM preserves the link count but correctly fails the fixed URL/revision assertion.
- Both negative audit copies were temporary test files, removed after the run; the production renderer and data were unchanged.

Raw logs and mutation results are preserved locally in `outputs/hexagram-detail/p0-contract/`. Remote CI must be read back for the new head before declaring CI PASS. This test fix does not approve the page's visuals or authorize merging.

Total page height (3020px versus the 1536px reference example) is not a UI defect by itself. Real full-length content must remain. Final pixel QA evaluates visual system, proportions, component styles and local rhythm, rather than forcing equal full-page height.
