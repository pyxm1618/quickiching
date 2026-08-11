# Three-Coin Free Reading V2 Design

## Goal

Upgrade only the Three-Coin free result experience into a complete deterministic reading product while preserving current casting semantics, Public SEO V1, Yarrow, Mei Hua, and all locked scope boundaries.

## Existing flow

`ThreeCoinTool` commits each generated `ThreeCoinStep` to React state and `sessionStorage` immediately on release. Motion F delays visual disclosure only. Once six visually revealed steps exist, the component currently builds `HexagramResult` and renders the shared inline V1 `ReadingResult`.

The casting domain is already correct and deterministic: six bottom-up values produce the King Wen primary number, moving positions 1–6, and a relating number only when moving lines exist.

## Route and browser-state strategy

Add one fixed product route: `/readings/three-coin/result`.

The Three-Coin storage key remains the authoritative browser-session source. Move storage parsing/validation/reset into a focused browser boundary so both `ThreeCoinTool` and the result page use the same rules. A completed cast is valid only when it contains exactly six steps, indexes are exactly 0–5 in order, line values are 6/7/8/9, coin faces are valid, and the stored algorithm version matches the Three-Coin algorithm version.

The result page never randomizes or edits values. It rebuilds the existing `HexagramResult` from the six sealed `lineValue`s. Invalid or incomplete state renders `No completed reading found` and a CTA to `/#three-coin-reading`.

Only `Start a New Reading` clears the storage. Back, forward, navigation, and refresh do not reset it.

## Completion UX

The sixth release remains authoritative immediately. Motion F completes its current settlement. Once the sixth line is visually settled, `ThreeCoinTool` displays `Your hexagram is formed` and a primary `Reveal Your Reading` link/button. It no longer renders the full Three-Coin V1 result inline. Yarrow and Mei Hua retain the existing `ReadingResult`.

## Interpretation domain

Keep `src/domain/interpretation/basic.ts` intact for current V1 consumers.

Add a V2 domain with:

- `types.ts`: `HexagramInterpretation`, `LineInterpretation`, `FreeReading`, synthesis types.
- `hexagrams/01.ts` … `hexagrams/64.ts`: one composition-friendly hexagram record plus its six line records per module.
- `load-interpretation.ts`: deterministic 1–64 loader with explicit dynamic imports and fail-fast missing-record errors.
- `build-free-reading.ts`: pure orchestration over already-loaded records.
- `build-reading-synthesis.ts`: small deterministic composition functions only; no DSL/rule-engine/classes.

Each hexagram record contains core theme/meaning, strength, challenge, orientation, structure interpretation, reflection questions, watch-for evidence, and composition fields. Each line contains hexagram number, position, theme, meaning, change dynamic, caution, reflection, and a compact synthesis phrase.

Exactly 64 hexagram records and 384 line records are required. Every record is original Quick I Ching prose informed by classical structure and line material without copying modern copyrighted translations.

## Synthesis

`buildReadingSynthesis` produces:

- The Situation — primary structure and current pattern.
- Where Change Is Happening — stable branch for zero moves; one-line or multi-line integrated summary otherwise.
- Direction of Change — stable primary emphasis or comparison with the relating hexagram.
- Bottom Line — 50–100 words, deterministic and grounded in the records.

Multiple moving lines are all shown bottom-to-top and synthesized together. No line-precedence hierarchy is introduced. Relating hexagrams are framed as an emerging/contrast structure, never a guaranteed future.

## Server/client and bundle boundary

`src/app/readings/three-coin/result/page.tsx` remains a Server Component and owns static metadata (`noindex, follow`) plus the page shell. A small Client Component reads/validates `sessionStorage`, rebuilds the deterministic casting result, and dynamically loads only the primary and optional relating interpretation modules.

The 64 modules are explicit code-split imports. `ThreeCoinTool` does not import the V2 interpretation loader or prose. Therefore the homepage client bundle does not receive the 64/384 interpretation dataset.

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
9. What to Watch — two to four primary-specific real-world observations.
10. One bottom disclaimer and `Start a New Reading`.

## Visual and accessibility design

Continue Concept A + Motion F: deep black/purple surfaces, gold/cyan accents, translucent depth, aura/glow, Fraunces display typography, current spacing/border language, and restrained reveal motion. Use CSS first; no animation library, canvas, WebGL, or Three.js.

Primary → Changing Lines → Relating is expressed as a vertical reading path with explicit labels and non-color change markers. `HexagramLines` remains the figure renderer and already exposes per-line accessible labels; result-specific wrappers add descriptive headings and moving-line text. Honor `prefers-reduced-motion` and retain visible keyboard focus.

Mobile widths 320/375/390 are first-class; no horizontal overflow.

## SEO and 404

The result page exports static metadata with `robots: { index: false, follow: true }`, no canonical, and no homepage Open Graph metadata. `INDEXABLE_PATHS` remains exactly the existing eight paths, so sitemap and default IndexNow live URLs remain unchanged.

Fix unmatched-route metadata with a dedicated catch-all/not-found boundary that preserves HTTP 404 and supplies a single 404-specific title plus noindex while clearing inherited homepage description/Open Graph data. Browser gates verify the emitted head; no broader SEO refactor is allowed.

## Tests

Add deterministic Vitest coverage for:

- Three-Coin session validation and completed-state rebuild.
- exactly 64 hexagram interpretations and exactly 384 lines; keys 1–64 and positions 1–6; all required fields non-empty; no duplicates/missing records.
- deterministic content-quality guards for duplicate core meanings/line meanings, repeated reflection sets/cautions, and placeholders.
- zero, one, multiple, and six moving-line fixtures.
- casting invariance: V2 interpretation cannot change primary/moving/relating facts.

Extend Chromium gates for six-line → formed → reveal → result, refresh equality, back/forward preservation, invalid-result empty state, explicit New Reading reset, 320/375/390 result overflow/accessibility-sensitive behavior, and Yarrow/Mei Hua regression.

Extend HTTP/SEO gates for result `noindex, follow`, sitemap/IndexNow exclusion, and clean 404 metadata. Extend Lighthouse to audit both homepage and a fully populated result page on mobile and desktop.

## Scope exclusions

No AI, question input, personalization, auth, database, payment, credits, history, permanent sharing, Yarrow/Mei Hua V2 result pages, SEO hexagram/line pages, CMS, localization, keyword expansion, production indexing submission, or production deployment.