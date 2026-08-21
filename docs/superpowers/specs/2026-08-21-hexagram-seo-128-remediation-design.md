# QuickIChing 128 Hexagram SEO Remediation Design

**Date:** 2026-08-21

**Implementation base:** PR #32, head `99590d3658762c9fface900354f254e497674a21`

**Scope:** the 64 English and 64 Simplified Chinese hexagram detail pages, their two locale hubs, and the two locale home-to-hub paths

## Goal

Replace PR #32's diagnostic-only keyword checks with an auditable SEO acceptance system that proves all 128 detail pages use the approved keywords at the approved density, have correct per-page Title/Description/H1, avoid language contamination and source-label noise, and participate in a complete locale-specific internal-link graph.

This is a release-quality gate, not a promise of Google rankings.

## Authority and Source Boundaries

English keyword decisions come from `quickiching_64_hexagram_keyword_mapping_EN_FINAL_GLOBAL_EXACT.xlsx`, SHA-256 `3924004150cc6190481a02257dd9e90731134cef417189c1b1e4a87e96da9a73`.

- For every English row, the workbook controls the common English name, Primary, core secondary, other core variant, recommended modules, exact Title, and exact H1.
- All 64 English Primary keywords are `hexagram N`.
- Every English page receives Meaning, Love, Unchanging, and six-line modules.
- Relationship-specific content appears only where the workbook's `Recommended Modules` cell requests it: Hexagrams 1, 26, 37, 41, 42, 49, 54, and 56.
- Hexagram 23 covers `i ching hexagram 23 meaning splitting apart bo` on its parent page.
- Hexagram 54 covers `hexagram 54 in romance reading` on its parent page. This remediation does not create the candidate child page.

The existing combined workbook, SHA-256 `c53e446dc0b168bbb459edf11342b58bc67031ca1436e9fc27a92cd58dbd25bc`, remains authoritative for the 64 Chinese canonical URLs, slugs, keyword mappings, Titles, Meta Descriptions, and H1s. Its retired English research and 53-page waiver mechanism are not authoritative for English keyword decisions.

Existing semantic slugs and canonical URLs remain unchanged. Classical-source records, fixed source URLs, and six same-page line anchors remain unchanged.

## Per-page TDH

### English

- Title and H1 must equal the new English workbook targets byte-for-byte.
- Each page receives a unique Meta Description, normally 140-160 characters, containing its exact `hexagram N` Primary, common English name, Meaning, Love, Unchanging intent, and one page-specific interpretation theme already supported by repository content.
- Descriptions must not be a 64-row generic template distinguished only by number and name.

### Simplified Chinese

- Title, Meta Description, and H1 remain exact matches to the approved Chinese workbook rows.
- No English workbook field may overwrite a Chinese TDH field.

All 128 Titles, Descriptions, and H1s must remain unique within their field, with one canonical URL and one indexable intent per row.

## Content and Language Architecture

### English pages

- Visible article copy is English-only.
- Remove the repeated visible Chinese Judgment, Image, and six Chinese line-text blocks from English pages. Preserve the fixed original-source URL and truthful English attribution without inventing a translation.
- Remove Chinese characters and pinyin from the English H1 and prominent identity line.
- Add a substantive, page-specific Love section to all 64 pages.
- Keep a substantive, page-specific Unchanging section on all 64 pages.
- Keep Meaning and six line-by-line English interpretation sections.
- Add only workbook-approved relationship and special modules.

### Simplified Chinese pages

- Visible article copy is Simplified Chinese-only, apart from non-visible URL values and schema/site-chrome brand data outside the eligible article copy.
- Preserve the sourced Chinese Judgment, Image, and line texts.
- Replace visible English guide labels and Romanized trigram codes with Chinese labels and trigram names.
- Do not add English Love/Relationship research to Chinese pages.

### Source integrity

Source links remain real anchors with usable accessible names and adequately sized targets. `Wikisource`, `oldid`, revision labels, raw URL fragments, and `#line-N` source noise must not dominate eligible page copy. Same-page `#line-1` through `#line-6` reading anchors remain available.

## Density Contract

Density is measured only over eligible, visible, page-specific article copy. Site header/footer, breadcrumb/navigation, buttons, CTAs, legal copy, source-attribution labels, URLs, JSON-LD, scripts, styles, hidden/collapsed content, and reusable chrome are excluded.

For each locale, the denominator is the locale-aware visible token count. English uses Unicode word tokens. Chinese uses `Intl.Segmenter("zh-Hans", { granularity: "word" })` word-like segments.

### Exact Primary density

`boundary-safe Primary occurrences / eligible visible tokens`

- Hard pass band: **1.00%-2.00%** on every page.
- English matching must use token boundaries, so `hexagram 10` cannot satisfy `hexagram 1`.
- Chinese matching uses exact protected phrases.

### Approved keyword-family density

`tokens covered by non-overlapping, longest-match-first approved phrases / eligible visible tokens`

- Hard pass band: **3.00%-5.00%** on every page.
- Approved phrases come only from the active row's Primary, core secondary, approved other-core/variant family, English common name or Chinese entity family, and workbook-required Meaning/Love/Unchanging/special intent phrases.
- Nested phrases are counted once. For example, `i ching hexagram 23` does not also count a second `hexagram 23` span in family density.
- Brand terms, source-provider names, revision words, generic template labels, unrelated hexagrams, and other-locale words never contribute to the numerator.

The gate fails both under-optimization and over-optimization. There is no waiver table and no explanation that converts a failed page into PASS.

## Language and Noise Gates

- Eligible English article copy: zero Han characters.
- Eligible Chinese article copy: zero standalone Latin-script words.
- Eligible article brand count: zero `Quick I Ching`/`QuickIChing` occurrences.
- Visible source noise: zero `oldid`, revision labels, raw `#line-N` text, or exposed tracking/query fragments.
- Mechanical stuffing detection checks repeated Primary/secondary runs, abnormally short spacing between repetitions, repetitive headings, and a per-term maximum consistent with the density ceiling.

Each violation reports the page URL, offending term, count, density, and a short context sample.

## Locale-specific Internal Link Graph

The release gate must prove the complete followable path for both languages:

```text
/    -> /hexagrams    -> 64 English detail pages -> /hexagrams and /
/zh  -> /zh/hexagrams -> 64 Chinese detail pages -> /zh/hexagrams and /zh
```

Requirements:

- The English homepage contains a normal followable anchor to `/hexagrams`.
- The Chinese homepage contains a normal followable anchor to `/zh/hexagrams`.
- Each hub contains exactly 64 unique, locale-correct, followable detail anchors.
- Every detail page contains a followable link to its locale hub and its locale homepage.
- Hub anchor text naturally includes the row's approved Primary/entity name.
- English and Chinese hubs do not point their 64-item collections at the other locale.
- Canonical, reciprocal hreflang, x-default, sitemap inclusion, previous/next links, and line anchors remain valid.

The homepages do not need to render 64 links directly; the verified home-to-hub-to-detail path is the intended hierarchy.

## Implementation Boundaries

Expected touched areas are limited to:

- English/Chinese hexagram SEO registries and content types
- English page-specific Love/Unchanging content data
- the shared hexagram detail component
- the two hexagram hubs and, only if currently missing, their locale homepage links
- the SEO registry/quality/browser gates and their tests
- package/build script wiring required to run those gates

No slug migration, redirect project, child-page launch, unrelated homepage keyword rewrite, classical-source mutation, personalized reading change, payment/auth change, deployment, or PR merge is included.

## TDD and Verification

Implementation starts with failing tests for:

1. strict Primary boundaries (`hexagram 1` versus `hexagram 10`);
2. non-overlapping longest-family matching;
3. exclusion of hidden/navigation/source/brand text;
4. English/Chinese language contamination;
5. the two home -> hub -> 64 details -> home/hub link graphs;
6. exact English workbook Title/H1 and unique descriptions;
7. exact Chinese workbook TDH;
8. all 128 per-page density and placement results.

Fresh completion evidence must include targeted red/green tests, all Vitest files, TypeScript, ESLint, production build, registry gate, the 128-page production-DOM SEO gate, link graph/canonical/hreflang/JSON-LD/line-anchor checks, and representative Lighthouse runs for both locales. Any failure remains a failure; no waiver converts it to success.
