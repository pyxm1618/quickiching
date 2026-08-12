# Three-Coin Free Reading V2 Design

## Goal

Upgrade only the Three-Coin free result experience into a complete deterministic reading product while preserving current casting semantics, Public SEO V1, Yarrow, Mei Hua, and all locked scope boundaries.

## Existing flow

`ThreeCoinTool` commits each generated `ThreeCoinStep` to React state and `sessionStorage` immediately on release. Motion F delays visual disclosure only. The V2 change keeps that authority boundary and replaces the completed Three-Coin inline V1 result with an explicit reveal transition to a dedicated result page.

The casting domain remains authoritative and deterministic: six bottom-up values produce the King Wen primary number, moving positions 1–6, and a relating number only when moving lines exist.

## Route and browser-state strategy

The product result route is fixed at `/readings/three-coin/result`.

The established Three-Coin storage key remains the authoritative browser-session source. Shared parsing/validation/reset code accepts only legal sequential Three-Coin steps. A completed cast is valid only when it contains exactly six steps, indexes are exactly 0–5 in order, line values are 6/7/8/9, three coin faces are valid and arithmetically agree with the stored line value, and the stored algorithm version matches the current Three-Coin algorithm version.

The result page never randomizes or edits values. It rebuilds the existing `HexagramResult` from the six sealed `lineValue`s. Invalid or incomplete state renders `No completed reading found` and a CTA to `/#three-coin-reading`.

Only `Start a New Reading` clears the storage. Back, forward, navigation, and refresh do not reset it.

## Completion UX

The sixth release remains authoritative immediately. Motion F completes its current settlement. Once the sixth line is visually settled, `ThreeCoinTool` displays `Your hexagram is formed` and a primary `Reveal Your Reading` link. It no longer renders the full Three-Coin V1 result inline. Yarrow and Mei Hua retain the existing V1 `ReadingResult`.

## Interpretation domain

`src/domain/interpretation/basic.ts` remains intact for current V1 consumers.

V2 adds:

- `types.ts`: `HexagramInterpretation`, `LineInterpretation`, `FreeReading`, and synthesis types.
- `profile.ts`: the explicit semantic profile and deterministic content builder used by all V2 records.
- `catalog/01-04.ts` … `catalog/61-64.ts`: sixteen literal code-split chunks, each containing four hexagram profiles and their six exact line-position emphases.
- `load-interpretation.ts`: deterministic 1–64 loader with explicit dynamic imports and fail-fast missing-record errors.
- `build-free-reading.ts`: pure orchestration over an already computed cast and already loaded interpretation bundles.
- `build-reading-synthesis.ts`: small deterministic composition functions only; no DSL, rule engine, class hierarchy, or runtime prose generation.

Each hexagram record contains core theme/meaning, strength, challenge, orientation, structure interpretation, reflection questions, watch-for evidence, and composition fields. Each line contains hexagram number, position, theme, meaning, change dynamic, caution, reflection, and a compact synthesis phrase.

Exactly 64 hexagram records and 384 line records are required. Each exact `(hexagramNumber, position)` has a separately authored semantic emphasis. Shared deterministic prose framing converts that semantic input into the page fields while content-quality tests reject duplicate and highly repetitive output. No LLM or random prose generation exists in this layer.

## Synthesis

`buildReadingSynthesis` produces:

- The Situation — primary structure and current pattern.
- Where Change Is Happening — stable branch for zero moves; one-line or multi-line integrated summary otherwise.
- Direction of Change — stable primary emphasis or comparison with the relating hexagram.
- Bottom Line — 50–100 words, deterministic and grounded in the records.

Multiple moving lines are all shown bottom-to-top and synthesized together. No line-precedence hierarchy is introduced. Relating hexagrams are framed as an emerging/contrast structure, never a guaranteed future.

## Server/client and bundle boundary

`src/app/readings/three-coin/result/page.tsx` remains a Server Component and owns result-specific static metadata (`noindex, follow`) plus the route shell. A small Client Component reads and validates `sessionStorage`, rebuilds the deterministic casting result, and requests only the chunk(s) containing the primary and optional relating interpretation.

The sixteen catalog chunks are reached only through dynamic imports from the result flow. `ThreeCoinTool` does not import the V2 interpretation loader or prose. Production browser gating inspects the downloaded JavaScript: the homepage must contain none of the V2 catalog sentinels, while a seeded result must contain its required primary/relating chunks without unrelated catalog chunks.

No API, database, cookie state, auth, server persistence, AI, or query-string result state is introduced.

## Result page information architecture

1. Reading Overview — primary figure/name/number, moving positions, relating identity if present, Three-Coin method, concise theme.
2. The Primary Hexagram — Core Meaning, Strength, Challenge, Orientation.
3. Understanding the Structure — upper/lower trigrams, objective line structure, original structural interpretation.
4. Changing Lines — one accessible card per active line, or a concise No Changing Lines section; Multiple Changes notice when needed.
5. The Relating Hexagram — only when moves exist; figure, core meaning, and explicit comparison to primary.
6. Bringing the Reading Together — Situation, Where Change Is Happening, Direction of Change.
7. Bottom Line — visually prominent concise takeaway.
8. Questions to Sit With — three primary-specific prompts.
9. What to Watch — three primary-specific real-world observations.
10. One bottom disclaimer and `Start a New Reading`.

## Visual and accessibility design

Continue Concept A + Motion F: deep black/purple surfaces, gold/cyan accents, translucent depth, aura/glow, Fraunces display typography, current spacing/border language, and restrained reveal motion. Use CSS first; no animation library, canvas, WebGL, or Three.js.

Primary → Changing Lines → Relating is expressed as a responsive reading path with explicit labels and non-color change markers. `HexagramLines` remains the figure renderer; result-specific wrappers provide descriptive headings and moving-line text. Honor `prefers-reduced-motion` and retain visible keyboard focus.

Mobile widths 320/375/390 are first-class and must have no horizontal overflow.

## SEO and 404

The result page exports static metadata with `robots: { index: false, follow: true }`, no canonical, and result-specific metadata rather than homepage metadata. `INDEXABLE_PATHS` remains exactly the existing eight paths, so sitemap and default IndexNow live URLs remain unchanged.

Unmatched routes use a dedicated catch-all/not-found boundary intended to preserve HTTP 404 and provide a 404-specific title plus noindex without homepage description/canonical/Open Graph conflicts. Production HTML browser gates, not source inspection alone, determine whether this fix passes.

## Tests and runtime gates

Deterministic Vitest coverage includes:

- Three-Coin session validation and completed-state rebuild.
- exactly 64 hexagram interpretations and exactly 384 lines; keys 1–64 and positions 1–6; all required fields non-empty; no duplicates/missing records.
- content-quality guards for duplicate core meanings/line meanings, repeated reflection/caution content, placeholder text, prophecy language, and highly repetitive line openings.
- zero, one, multiple, and six moving-line fixtures.
- casting invariance: V2 interpretation cannot change primary/moving/relating facts.

Chromium gates cover real six-line casting → formed → reveal → result, refresh equality, back/forward preservation, invalid-result empty state, explicit New Reading reset, 320/375/390 overflow, and Yarrow/Mei Hua regression. A separate legal seeded fixture provides deterministic checks without adding any test-only product URL or API.

HTTP/SEO gates cover result `noindex, follow`, sitemap/IndexNow exclusion, and clean 404 metadata. Lighthouse audits both homepage and a populated result page on mobile and desktop. A bundle gate inspects browser-downloaded JavaScript to prove the V2 prose catalog is absent from the homepage client payload.

## Scope exclusions

No AI, question input, personalization, auth, database, payment, credits, history, permanent sharing, Yarrow/Mei Hua V2 result pages, SEO hexagram/line pages, CMS, localization, keyword expansion, production indexing submission, or production deployment.