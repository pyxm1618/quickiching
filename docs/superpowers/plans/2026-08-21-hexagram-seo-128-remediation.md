# QuickIChing 128 Hexagram SEO Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 64 English and 64 Simplified Chinese hexagram detail pages pass exact workbook TDH, approved-keyword density, language-purity, source-noise, and locale-specific internal-link acceptance gates.

**Architecture:** Keep the existing 128-row registry and Chinese content as the base, then overlay the new English Global Exact research through a focused typed module. Move keyword matching and density math into a pure tested module shared by the browser audit, while the shared detail component marks eligible copy and renders locale-pure modules. Extend existing hub tests and the production-DOM audit to prove the complete home-to-hub-to-detail link graph.

**Tech Stack:** Next.js 15 App Router, React 19 Server Components, TypeScript 5.7, Vitest 3, Bun scripts, Puppeteer production-DOM auditing

**Spec:** `docs/superpowers/specs/2026-08-21-hexagram-seo-128-remediation-design.md`

## Global Constraints

- Implementation base is PR #32 head `99590d3658762c9fface900354f254e497674a21`.
- English research source SHA-256 is `3924004150cc6190481a02257dd9e90731134cef417189c1b1e4a87e96da9a73`.
- Chinese source SHA-256 remains `c53e446dc0b168bbb459edf11342b58bc67031ca1436e9fc27a92cd58dbd25bc`.
- Preserve all 128 existing slugs, canonical URLs, reciprocal hreflang records, sitemap entries, source URLs, and `#line-1` through `#line-6` anchors.
- Exact Primary density is a hard 1.00%-2.00% pass band over eligible visible article copy.
- Approved non-overlapping longest-match keyword-family density is a hard 3.00%-5.00% pass band over the same copy.
- Eligible English copy contains zero Han characters; eligible Chinese copy contains zero standalone Latin words; eligible article copy contains zero brand terms.
- English Title/H1 come exactly from the new workbook; Chinese TDH remains exactly the approved Chinese workbook rows.
- Do not create the Hexagram 54 child page, change unrelated routes, mutate classical-source data, deploy, merge, or claim production completion.
- Preserve the user's untracked `.gstack/`, `.playwright-mcp/`, and `outputs/` paths.

---

### Task 1: Boundary-safe SEO quality primitives

**Files:**
- Create: `src/content/hexagrams/seo-quality.ts`
- Create: `src/content/hexagrams/seo-quality.test.ts`

**Interfaces:**
- Produces: `tokenizeWithSpans(text, locale): SeoToken[]`
- Produces: `countExactPhrase(text, phrase, locale): number`
- Produces: `measureKeywordQuality(input: KeywordQualityInput): KeywordQualityMeasurement`
- Produces: `findLanguageContamination(text, locale): LanguageContamination`
- Produces: constants `PRIMARY_DENSITY_RANGE` and `FAMILY_DENSITY_RANGE`

- [ ] **Step 1: Write failing boundary, longest-match, density, and language tests**

```ts
expect(countExactPhrase("hexagram 10", "hexagram 1", "en")).toBe(0);
expect(countExactPhrase("Hexagram 1; i ching hexagram 1", "hexagram 1", "en")).toBe(2);

const quality = measureKeywordQuality({
  text: "i ching hexagram 23 meaning love unchanging",
  locale: "en",
  primary: "hexagram 23",
  approvedFamily: ["hexagram 23", "i ching hexagram 23", "hexagram 23 meaning", "love", "unchanging"],
});
expect(quality.tokenCount).toBe(7);
expect(quality.primaryOccurrences).toBe(1);
expect(quality.familyCoveredTokens).toBe(7);
expect(quality.familyMatches.map((match) => match.phrase)).toEqual([
  "i ching hexagram 23",
  "meaning",
  "love",
  "unchanging",
]);

expect(findLanguageContamination("English copy 乾", "en").samples).toEqual(["乾"]);
expect(findLanguageContamination("中文 copy", "zh-Hans").samples).toEqual(["copy"]);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bunx vitest run src/content/hexagrams/seo-quality.test.ts`

Expected: FAIL because `seo-quality.ts` and its exported functions do not exist.

- [ ] **Step 3: Implement span-aware tokenization and matching**

```ts
export type SeoToken = { value: string; start: number; end: number };

export const PRIMARY_DENSITY_RANGE = { min: 0.01, max: 0.02 } as const;
export const FAMILY_DENSITY_RANGE = { min: 0.03, max: 0.05 } as const;

export function measureKeywordQuality(input: KeywordQualityInput): KeywordQualityMeasurement {
  const tokens = tokenizeWithSpans(input.text.normalize("NFKC"), input.locale);
  const primaryOccurrences = countExactPhrase(input.text, input.primary, input.locale);
  const familyMatches = matchLongestNonOverlapping(input.text, input.approvedFamily, input.locale);
  const familyCoveredTokens = tokens.filter((token) =>
    familyMatches.some((match) => token.start >= match.start && token.end <= match.end),
  ).length;
  return {
    tokenCount: tokens.length,
    primaryOccurrences,
    primaryDensity: primaryOccurrences / Math.max(tokens.length, 1),
    familyCoveredTokens,
    familyDensity: familyCoveredTokens / Math.max(tokens.length, 1),
    familyMatches,
  };
}
```

Use Unicode letter/number lookarounds for English phrase boundaries and protected exact phrase spans for Chinese. Sort approved phrases by token count and character length before accepting non-overlapping spans.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `bunx vitest run src/content/hexagrams/seo-quality.test.ts`

Expected: PASS with the literal counts above.

- [ ] **Step 5: Commit the quality primitives**

```bash
git add src/content/hexagrams/seo-quality.ts src/content/hexagrams/seo-quality.test.ts
git commit -m "test: define hexagram SEO density contract"
```

### Task 2: Overlay the authoritative English Global Exact mapping

**Files:**
- Create: `src/content/hexagrams/en-global-exact.ts`
- Modify: `src/content/hexagrams/seo.ts`
- Modify: `src/content/hexagrams/seo.test.ts`
- Modify: `scripts/hexagram-seo-registry-gate.mjs`

**Interfaces:**
- Produces: `EN_GLOBAL_EXACT_SOURCE_SHA256`
- Produces: `EN_GLOBAL_EXACT_ROWS: readonly EnGlobalExactRow[]`
- Produces: `englishGlobalExactRow(number): EnGlobalExactRow`
- Extends: `HexagramSeoEntry` with `otherCoreVariant`, `meaningKeyword`, `loveKeyword`, `unchangingKeyword`, `relationshipKeyword`, `specialKeywords`, and `recommendedModules`
- Preserves: `hexagramSeoFor(number, locale)` and `hexagramSeoRows()` consumer APIs

- [ ] **Step 1: Replace old English expectations with failing workbook expectations**

```ts
expect(HEXAGRAM_SEO_EN_SOURCE_SHA256).toBe("3924004150cc6190481a02257dd9e90731134cef417189c1b1e4a87e96da9a73");
for (let number = 1; number <= 64; number += 1) {
  const entry = hexagramSeoFor(number, "en");
  expect(entry.primaryKeyword).toBe(`hexagram ${number}`);
  expect(entry.finalTitle).toBe(`I Ching Hexagram ${number}: ${entry.hexagramName} — Meaning, Love & Unchanging`);
  expect(entry.finalH1).toBe(`Hexagram ${number} — ${entry.hexagramName}`);
  expect(entry.finalDescription.toLowerCase()).toContain(`hexagram ${number}`);
  expect(entry.finalDescription.toLowerCase()).toContain("love");
  expect(entry.finalDescription.toLowerCase()).toContain("unchanging");
}
expect(hexagramSeoFor(23, "en").specialKeywords).toContain("i ching hexagram 23 meaning splitting apart bo");
expect(hexagramSeoFor(54, "en").specialKeywords).toContain("hexagram 54 in romance reading");
```

Retain the exact existing Chinese TDH assertions for representative rows and all-row uniqueness.

- [ ] **Step 2: Run registry tests and verify RED**

Run: `bunx vitest run src/content/hexagrams/seo.test.ts`

Expected: FAIL on the English hash, Title/H1, description intents, and new research fields.

- [ ] **Step 3: Add all 64 workbook rows and derive the English overlay**

Define each row with the workbook's number, common name, Primary, core secondary, other core variant, volumes, recommended modules, Title, H1, and notes. Overlay only English registry entries:

```ts
const english = englishGlobalExactRow(entry.number);
return {
  ...entry,
  hexagramName: english.commonEnglishName,
  primaryKeyword: english.primaryKeyword,
  secondaryCore: english.secondaryCore,
  otherCoreVariant: english.otherCoreVariant,
  meaningKeyword: `hexagram ${entry.number} meaning`,
  loveKeyword: `hexagram ${entry.number} love`,
  unchangingKeyword: `hexagram ${entry.number} unchanging`,
  relationshipKeyword: english.relationshipSpecific ? `hexagram ${entry.number} relationship` : null,
  specialKeywords: english.specialKeywords,
  recommendedModules: english.recommendedModules,
  finalTitle: english.titleTarget,
  titleLength: english.titleTarget.length,
  finalDescription: buildEnglishMetaDescription(entry.finalDescription, english),
  descriptionLength: finalDescription.length,
  finalH1: english.h1Target,
  h1Length: english.h1Target.length,
  familyDensityMin: 0.03,
  familyDensityMax: 0.05,
  brandMentionsInBodyMax: 0,
};
```

`buildEnglishMetaDescription` retains the unique first-sentence interpretation theme from the existing row and adds concise Meaning/Love/Unchanging intent. Assert 64 unique descriptions and inspect all lengths; shorten only the shared intent clause when an output exceeds 160 characters.

- [ ] **Step 4: Update the registry gate for two source hashes**

The script must compare `HEXAGRAM_SEO_EN_SOURCE_SHA256` with `3924...a73` and `HEXAGRAM_SEO_ZH_SOURCE_SHA256` with `c53e...25bc`, retain 128 unique canonical/TDH checks, and assert all English Primary/Title/H1 patterns.

- [ ] **Step 5: Run registry tests and gate and verify GREEN**

Run: `bunx vitest run src/content/hexagrams/seo.test.ts`

Run: `bun run seo:registry`

Expected: both commands PASS; output reports 64 English rows, 64 Chinese rows, and 128 unique canonical URLs, Titles, Descriptions, and H1s.

- [ ] **Step 6: Commit the research overlay**

```bash
git add src/content/hexagrams/en-global-exact.ts src/content/hexagrams/seo.ts src/content/hexagrams/seo.test.ts scripts/hexagram-seo-registry-gate.mjs
git commit -m "feat: apply English Global Exact hexagram mapping"
```

### Task 3: Render locale-pure, intent-complete detail pages

**Files:**
- Modify: `src/components/hexagram-detail-page.tsx`
- Modify: `src/components/hexagram-detail-page.test.tsx`

**Interfaces:**
- Consumes: the extended `HexagramSeoEntry` fields from Task 2
- Consumes: existing page-specific `knowledge.interpretation` strength, challenge, transition, and stability content
- Produces: `data-seo-copy`, `data-seo-exclude`, `data-seo-home-link`, and `data-seo-hub-link` DOM contracts for Task 5

- [ ] **Step 1: Write failing tests for language purity and required modules**

For all 64 English and all 64 Chinese renders, strip `script`, `nav`, and `[data-seo-exclude]` blocks, then assert:

```ts
expect(eligibleEnglishText).not.toMatch(/\p{Script=Han}/u);
expect(eligibleChineseText).not.toMatch(/\b\p{Script=Latin}{2,}\b/u);
expect(englishHtml).toContain(`>${seo.loveKeyword} meaning<`);
expect(englishHtml).toContain(`>${seo.unchangingKeyword}<`);
expect(englishHtml).toContain(`Hexagram ${number} Line 1`);
expect(chineseHtml).toContain(`${seo.primaryKeyword}初爻`);
```

Assert relationship modules exist only for `[1, 26, 37, 41, 42, 49, 54, 56]`, Hexagram 23 contains its full Splitting Apart/Bo phrase, and Hexagram 54 contains its full romance phrase.

- [ ] **Step 2: Run component tests and verify RED**

Run: `bunx vitest run src/components/hexagram-detail-page.test.tsx`

Expected: FAIL on English Han text, Chinese Latin words, missing Love modules, old special modules, and missing link markers.

- [ ] **Step 3: Make the English article English-only**

- Use `seo.hexagramName` as the English display name.
- Remove pinyin and Han characters from the English identity block.
- Replace the English raw Chinese Judgment/Image/line-text display with English source attribution and the preserved fixed source URL; do not invent translations.
- Keep English authored meaning and six line interpretations.
- Render each English line heading as `Hexagram N Line P — theme`.

- [ ] **Step 4: Add the English Love, Unchanging, relationship, and special modules**

Use the approved phrases in natural headings and page-specific existing content:

```tsx
<h2>{seo.loveKeyword} meaning</h2>
<p>In an {seo.otherCoreVariant} love reading, {seo.hexagramName} emphasizes {knowledge.interpretation.strength}.</p>
<p>Its relationship challenge is {knowledge.interpretation.challenge}; compare that theme with consent, reciprocity, and observed behavior.</p>

<h2>{seo.unchangingKeyword}</h2>
<p>An unchanging {seo.primaryKeyword} keeps {seo.hexagramName} as the stable frame.</p>
<p>{knowledge.interpretation.stabilityTheme}</p>
```

Render the approved relationship module only when `seo.relationshipKeyword` is non-null. Render exact special phrases only from `seo.specialKeywords`. Remove PR #32's old Hexagram 52, 61, and 64 research modules because the new English workbook does not approve them.

- [ ] **Step 5: Make Chinese detail copy Chinese-only**

Map trigram codes to `乾、坤、震、巽、坎、离、艮、兑`; translate visible guide labels; keep Chinese classical text. Render line headings as `${seo.primaryKeyword}${POSITIONS[index]}` and preserve the numeric anchor link separately.

- [ ] **Step 6: Mark eligible and excluded DOM regions**

Put page-specific readable headings and prose under `data-seo-copy`. Mark breadcrumb, navigation, CTAs, source attribution, schema, legal copy, and anchor glyph controls with `data-seo-exclude`. Add normal followable locale home and hub anchors carrying `data-seo-home-link` and `data-seo-hub-link`.

- [ ] **Step 7: Run component tests and verify GREEN**

Run: `bunx vitest run src/components/hexagram-detail-page.test.tsx`

Expected: PASS for all 128 renders with no eligible cross-language text and all required modules/anchors.

- [ ] **Step 8: Commit the detail-page remediation**

```bash
git add src/components/hexagram-detail-page.tsx src/components/hexagram-detail-page.test.tsx
git commit -m "feat: localize and optimize 128 hexagram details"
```

### Task 4: Complete and test the locale-specific link graph

**Files:**
- Modify: `src/app/hexagrams-hub.test.tsx`
- Modify: `src/app/(default)/hexagrams/page.tsx`
- Modify: `src/app/(localized)/zh/hexagrams/page.tsx`
- Modify: `src/app/(localized)/zh/page.tsx`
- Modify: `src/app/(default)/page.tsx` only if the existing `/hexagrams` link cannot satisfy the explicit marker test

**Interfaces:**
- Consumes: `data-seo-home-link` and `data-seo-hub-link` from Task 3
- Produces: `data-seo-hexagram-hub-link` on locale homepage links and `data-seo-inbound-anchor` on one canonical hub-to-detail anchor per row

- [ ] **Step 1: Expand the hub test into a failing complete graph test**

```ts
expect(englishHomeHtml).toContain('href="/hexagrams"');
expect(chineseHomeHtml).toContain('href="/zh/hexagrams"');
expect(uniqueDetailHrefs(englishHubHtml, "/hexagrams/")).toHaveLength(64);
expect(uniqueDetailHrefs(chineseHubHtml, "/zh/hexagrams/")).toHaveLength(64);
expect(englishDetailHtml).toContain('data-seo-home-link="/"');
expect(englishDetailHtml).toContain('data-seo-hub-link="/hexagrams"');
expect(chineseDetailHtml).toContain('data-seo-home-link="/zh"');
expect(chineseDetailHtml).toContain('data-seo-hub-link="/zh/hexagrams"');
```

Also assert the English hub's 64 primary anchors contain no Han characters and the Chinese hub's 64 primary anchors contain no standalone Latin words.

- [ ] **Step 2: Run the graph test and verify RED**

Run: `bunx vitest run src/app/hexagrams-hub.test.tsx`

Expected: FAIL because the Chinese homepage has no `/zh/hexagrams` link, its copy says the pages are unavailable, and the hub collections contain cross-language visible labels.

- [ ] **Step 3: Fix the home and hub hierarchy**

- Add a visible Chinese-home link to `/zh/hexagrams` with Chinese anchor text.
- Remove the stale Chinese-home claim that 64 Chinese SEO pages are unavailable.
- Keep the existing English-home `/hexagrams` link and add the marker if needed.
- Remove Han names from the English hub's 64 primary anchors.
- Replace `King Wen`, `Hub`, and `PENDING_RESEARCH` from visible Chinese hub prose with truthful Chinese wording without changing unresearched Chinese hub TDH decisions.
- Keep one canonical `data-seo-inbound-anchor` per detail row and preserve normal followable anchors.

- [ ] **Step 4: Run the graph test and verify GREEN**

Run: `bunx vitest run src/app/hexagrams-hub.test.tsx`

Expected: PASS with two home-to-hub links, 64 unique detail targets per hub, and detail-to-home/hub return links.

- [ ] **Step 5: Commit the link graph**

```bash
git add src/app/hexagrams-hub.test.tsx src/app/'(default)'/hexagrams/page.tsx src/app/'(localized)'/zh/hexagrams/page.tsx src/app/'(localized)'/zh/page.tsx src/app/'(default)'/page.tsx
git commit -m "fix: complete locale hexagram link graph"
```

### Task 5: Replace PR #32's false-green browser audit

**Files:**
- Modify: `scripts/hexagram-seo-quality-audit.mjs`
- Create: `scripts/hexagram-seo-quality-audit.test.ts`
- Modify: `package.json` only if a dedicated focused audit-test command is needed
- Modify: `scripts/vercel-build.mjs` only if output paths or command wiring changes

**Interfaces:**
- Consumes: `measureKeywordQuality`, `findLanguageContamination`, density constants, and extended registry fields
- Consumes: DOM markers from Tasks 3 and 4
- Produces: per-page JSON/CSV records with exact Primary density, family density, matched approved phrases, contamination/noise samples, placements, and link-graph status

- [ ] **Step 1: Write failing audit regression tests**

Export pure `auditSnapshot(entry, snapshot, inboundAnchor)` without running the CLI on import. Feed literal snapshots proving:

- `hexagram 10` cannot pass Hexagram 1 placement;
- hidden/excluded text cannot satisfy a phrase;
- a page below 1% Primary or below 3% family density fails;
- a page above 2% Primary or above 5% family density fails;
- English Han and Chinese Latin contamination fail;
- missing home/hub return links fail;
- provider/brand/source terms never contribute to the family numerator.

- [ ] **Step 2: Run the audit regression test and verify RED**

Run: `bunx vitest run scripts/hexagram-seo-quality-audit.test.ts`

Expected: FAIL against PR #32's substring matcher, `textContent` extraction, diagnostic-only density, and absent link-graph failures.

- [ ] **Step 3: Use real eligible visible DOM text**

In Puppeteer, clone `[data-seo-copy]`, remove `[data-seo-exclude]`, `nav`, `button`, `script`, `style`, `[hidden]`, `[aria-hidden="true"]`, and elements whose computed `display` is `none` or `visibility` is `hidden`, then read `innerText`. Collect home/hub marker hrefs from the original DOM.

- [ ] **Step 4: Make every accepted SEO condition a hard failure**

Call the shared quality functions. Add failures for exact TDH mismatch, strict Primary placement, missing preferred secondary, Primary density outside 1%-2%, family density outside 3%-5%, language contamination, brand/noise, mechanical repetition, missing source URLs, missing six anchors, missing home/hub return links, broken hub inbound anchor, canonical/hreflang/JSON-LD failures, or hidden keyword content.

- [ ] **Step 5: Add home/hub collection verification**

Snapshot `/`, `/hexagrams`, `/zh`, and `/zh/hexagrams`. Assert the two locale home links, exactly 64 unique locale-correct hub detail targets, no `nofollow` on graph anchors, and no cross-locale target in either 64-link collection.

- [ ] **Step 6: Run the audit regression test and verify GREEN**

Run: `bunx vitest run scripts/hexagram-seo-quality-audit.test.ts`

Expected: PASS for all literal false-green counterexamples.

- [ ] **Step 7: Commit the hard browser gate**

```bash
git add scripts/hexagram-seo-quality-audit.mjs scripts/hexagram-seo-quality-audit.test.ts package.json scripts/vercel-build.mjs
git commit -m "fix: harden 128-page SEO quality gate"
```

### Task 6: Tune all 128 pages to the approved bands and run launch evidence

**Files:**
- Modify only the scoped registry/content/component files from Tasks 2-5 if the real production-DOM report identifies a failing page
- Do not create a waiver file

**Interfaces:**
- Consumes: the complete production build and hard quality report
- Produces: zero-failure JSON/CSV evidence for all 128 pages and the locale link graph

- [ ] **Step 1: Run fast static verification**

Run: `bun run lint`

Run: `bun run typecheck`

Run: `bun run test`

Run: `bun run seo:registry`

Expected: all commands exit 0 with no failed tests or registry rows.

- [ ] **Step 2: Build production output**

Run: `bun run build`

Expected: Next.js production build exits 0 and includes all 64 English plus 64 Chinese detail routes.

- [ ] **Step 3: Run the 128-page production-DOM quality gate**

Run: `HEXAGRAM_SEO_AUDIT_STATIC_DIR=.next/server/app bun run seo:quality` when the build layout supports direct static HTML; otherwise start the built app and run `HEXAGRAM_SEO_AUDIT_BASE_URL=http://127.0.0.1:3000 bun run seo:quality`.

Expected summary: `total=128`, `pass=128`, `fail=0`, Primary density complete `128`, family density complete `128`, language clean `128`, TDH complete `128`, source/link graph complete `128`.

- [ ] **Step 4: Tune real failures without waivers**

For a density failure, change only that page's natural heading or page-specific paragraph using its approved phrases. For a language/noise failure, remove or translate the offending visible text. Re-run the focused component test and then the full quality gate after each batch. Never change thresholds or mark a failed row PASS through explanation.

- [ ] **Step 5: Run remaining browser and source gates**

Run the repository's existing `seo:browser`, `verify:classical-sources`, and full `scripts/vercel-build.mjs` launch-gate path with a fresh production server as required by their documented environment variables.

Expected: canonical, reciprocal hreflang, JSON-LD, line anchors, internal links, source records, and all public launch gates exit 0.

- [ ] **Step 6: Run representative Lighthouse checks**

Run the existing Lighthouse gate against one English detail page and its Chinese pair.

Expected: SEO and Accessibility remain 100; record actual Performance scores without inventing a target not present in the spec.

- [ ] **Step 7: Review the final diff and commit scoped tuning**

Run: `git diff --check`

Run: `git status --short`

Confirm `.gstack/`, `.playwright-mcp/`, and `outputs/` remain unstaged. Stage only scoped task files, then commit:

```bash
git commit -m "test: verify 128 hexagram SEO pages"
```

- [ ] **Step 8: Report the exact repository state**

Report branch and HEAD SHA, files changed, every fresh verification count, min/max Primary and family density by locale, link-graph counts, and whether anything was pushed, opened as a PR, merged, staged, or deployed. Do not equate local build success with production deployment.
