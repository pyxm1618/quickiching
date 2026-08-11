# Three-Coin Free Reading V2 — Independent Review Fixes

## Status

Approved delta design derived directly from the independent review of PR #22. This document narrows the next implementation round; it does not replace the original V2 design.

## Goal

Resolve the two P1 and two P2 findings without changing the successful V2 architecture, casting algorithm, route strategy, SEO policy, Yarrow/Mei Hua behavior, or production safety boundaries.

## 1. Line interpretation content depth

Keep the existing 16 catalog chunks, deterministic loader, `HexagramInterpretationBundle`, and composition flow. Replace the current `lineEmphases`-driven prose expansion model with line-specific authored data.

Each of the 384 lines must own the core semantic content of these fields:

- `theme`
- `meaning`
- `changeDynamic`
- `caution`
- `reflection`
- `synthesisPhrase`

A shared constructor may validate and assemble records, but it must not generate the substantive meaning/caution/reflection prose from a position template. Shared formatting is allowed only for non-semantic concerns such as key validation or punctuation normalization.

Hexagram-level `coreMeaning`, `reflectionQuestions`, and `watchFor` should also stop depending primarily on one fixed sentence template. Their data may remain profile-based, but each hexagram must contain authored semantic text for those user-facing fields.

The content remains Quick I Ching original prose. Classical/historical materials may be used only for semantic cross-checking under the provenance policy already established.

## 2. Session storage fail-fast

`sessionStorage` is an authoritative persistence boundary for the V2 result route. Browser storage access failures must not be silently converted to empty state or ignored.

Required behavior:

- `getItem` failure throws a specific read error.
- `setItem`/write failure throws a specific write error.
- `removeItem` failure throws a specific clear error.
- invalid JSON / invalid stored shape remains a data-validation failure that can resolve to no valid completed reading, but browser API access failure is distinct.
- `ThreeCoinTool` must not show a newly cast line as successfully authoritative unless the matching session write succeeds.
- on write failure, the new line must not be committed to React state and the UI must surface a recoverable persistence error instead of reaching `Your hexagram is formed` / Reveal.
- `Start a New Reading` on the result page must only navigate away after clear succeeds. Clear failure leaves the result visible and exposes the specific error.
- incomplete-reading reset inside the casting chamber must likewise not pretend the session was cleared if `removeItem` fails.

No database, API, cookie, or cross-device storage is added.

## 3. Duplicate anchor ID

The homepage owns the single public fragment target `id="three-coin-reading"`. `ThreeCoinTool` must not declare the same ID internally.

A browser gate must assert exactly one element matches `#three-coin-reading` on the homepage.

## 4. Completed-reading reset UX

Before six lines are complete, the sidebar may retain its `New reading` reset control.

After the sixth line has visually settled, the sidebar destructive reset control is removed. The completed state presents one primary continuation: `Reveal Your Reading`.

The formal `Start a New Reading` action remains on the result page after the user has seen the reading. No confirmation dialog is added in this round.

## 5. Tests and gates

Add/extend deterministic tests for:

- `sessionStorage.getItem` throwing;
- `sessionStorage.setItem` throwing;
- `sessionStorage.removeItem` throwing;
- casting state not advancing when persistence fails;
- result-page reset not navigating when clear fails;
- exactly one homepage `#three-coin-reading` ID;
- completed Three-Coin chamber has Reveal but no sidebar `New reading` reset;
- 384 line records remain complete and unique;
- line user-facing semantic fields are authored per line rather than produced by the old shared position prose generator;
- hexagram-level reflection/watch/core text diversity remains deterministic and substantive.

Run the full existing quality gate afterward: lint, typecheck, all tests, build, Chromium E2E, bundle boundary, sitemap/IndexNow dry-run, 404 metadata, and Lighthouse.

## 6. Non-goals

Do not change:

- casting randomness or King Wen mapping;
- fixed result URL or noindex policy;
- sitemap/indexable URL set;
- Yarrow/Mei Hua result architecture;
- auth, DB, payment, credits, AI, CMS, localization, sharing;
- production deployment or production IndexNow/Search Console submission.
