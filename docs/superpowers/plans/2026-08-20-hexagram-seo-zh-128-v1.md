# Quick I Ching 128 Hexagram SEO and Simplified Chinese Detail Pages Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Implement the workbook-governed 64 English + 64 Simplified Chinese hexagram detail pages with exact TDH, reciprocal locale architecture, authored Chinese content, static generation, and executable SEO/density gates without changing the frozen homepage or deterministic casting/product flows.

Architecture: Keep the existing King Wen/classical source and English interpretation catalog as the factual core. Add a typed, build-time-only SEO registry generated from the supplied workbook and a separate typed zh-Hans detail-content model. Render both locales through one detail-page presentation boundary, use the existing route registry as the source for canonical/hreflang/sitemap inventories, and keep the localized catch-all as a noindex 404 for unpublished paths.

Tech Stack: Next.js 15 App Router, React 19, TypeScript, Bun/Vitest, static generateStaticParams, Metadata, JSON-LD, Puppeteer browser gates, Node ESM audit scripts, and the bundled artifact-tool only for reading/validating the supplied XLSX during implementation.

Spec: /Users/milushangdi/Documents/quickiching/outputs/quickiching-seo-128-20260820/QUICKICHING_128_HEXAGRAM_SEO_IMPLEMENTATION_PROMPT.md plus the supplied workbook /Users/milushangdi/Documents/quickiching/outputs/quickiching-seo-128-20260820/quickiching_128_hexagram_seo_implementation_spec.xlsx (the user-specified Desktop path is absent; the same-name workspace copy is the only discovered source and must be reported if it remains unresolved).

## Global Constraints

- Preserve every existing English semantic slug and canonical URL; do not create numeric, pinyin, Han-character, changing-line, or unchanging doorway aliases.
- The workbook is the only page-level authority for Final Rendered Title, Final Meta Description, Final H1, keyword families, placement, required content, special modules, and exclusions; do not rewrite those values.
- Production runtime must import typed/static registry data and must not read XLSX or ship Excel parsing/audit data in the client bundle.
- English authored Judgment, Image, six classical lines, provenance, and interpretation-catalog content remain distinct from modern interpretation; the 64 English pages are not bulk-rewritten.
- Chinese detail pages use Simplified Chinese and existing core-meaning seeds, plus per-hexagram structured content; they must not claim a six-line divination system or implement 纳甲、地支、六亲、世应、用神.
- Chinese relationship/career/fortune modules are allowlisted only for hexagrams 8, 13, 16, 22, 24, 25, 39, 43, 44, 45, 56, 15, 28, and 48.
- Keep Quick I Ching/QuickIChing page-specific body mentions at most two and exclude site chrome, schema, legal boilerplate, header, footer, nav, controls, scripts, and styles from the density body scope.
- Homepage / and /zh content, TDH, H1, CTA, layout, and flow remain frozen; changes to shared components must be proven not to alter their rendered snapshots/metadata.
- Preserve casting probabilities/algorithms, question identity, manual cast, reading transformation, History isolation, Turnstile, fail-closed AI behavior, private/noindex result routes, and privacy boundaries.
- Never use git reset --hard, destructive checkout, force-push, merge, deploy, or broad staging; preserve unrelated .playwright-mcp/ and outputs/ files.

---

### Task 1: Lock source workbook and generated SEO registry

Files:
- Create: src/content/hexagrams/seo.ts
- Create: src/content/hexagrams/seo.test.ts
- Create: scripts/hexagram-seo-registry-gate.mjs
- Test data source: /Users/milushangdi/Documents/quickiching/outputs/quickiching-seo-128-20260820/quickiching_128_hexagram_seo_implementation_spec.xlsx

Interfaces:
- Produces HEXAGRAM_SEO_REGISTRY, typed entries keyed by locale and number, with the exact workbook columns needed by rendering and audits.
- Produces hexagramSeoFor(number, locale) and hexagramSeoRows() for server-side pages and tests.
- The registry contains exactly 64 en and 64 zh-Hans rows, with the workbook canonical URL, slug, Primary, approved family, placements, exact TDH, required content, SERP module, exclusion, and density metadata.

- [ ] Step 1: Extract the workbook with the bundled artifact-tool and validate its source shape. Read English 64, 中文 64, Density Standard, QA Checklist, and Sources; assert the two detail sheets have header row 4 and rows 5–68, exactly 64 data rows each, and no formula/error cells.
- [ ] Step 2: Compare source facts before generating code. Assert English canonical URLs use the existing /hexagrams/<slug> values and Chinese canonical URLs use the same <slug> under /zh/hexagrams/; stop the affected row if any slug or canonical conflicts with src/domain/public-reading/classical.ts.
- [ ] Step 3: Generate the static typed source from the validated rows. Preserve exact Unicode punctuation and strings for Title, Description, H1, Primary, Secondary, family, placement, content, and exclusion. Add a source filename and SHA-256 comment/value for drift evidence, but do not include XLSX data in the runtime bundle.
- [ ] Step 4: Write the registry unit tests before page integration. Test counts, locale counts, canonical/slug equality, 128 unique URLs, 128 unique titles/descriptions/H1s, exact row lookups for hexagrams 1/23/52/54/61/64, Chinese module allowlist, hexagram 64 hub exclusion, and exact Primary placement metadata.
- [ ] Step 5: Add a deterministic registry gate. Have scripts/hexagram-seo-registry-gate.mjs import the compiled/static registry, validate the recorded source hash and emit a machine-readable summary. Keep XLSX comparison in the one-time artifact-tool extraction workflow rather than adding an unavailable artifact-tool dependency to production or CI.
- [ ] Step 6: Run the focused gate. Run bunx vitest run src/content/hexagrams/seo.test.ts and node scripts/hexagram-seo-registry-gate.mjs; expected result is 128 rows, 0 mismatch, and no duplicate TDH.

### Task 2: Add maintainable Simplified Chinese detail content

Files:
- Create: src/content/hexagrams/types.ts
- Create: src/content/hexagrams/zh-Hans.ts
- Create: src/content/hexagrams/zh-Hans.test.ts
- Modify: src/content/mei-hua-yi-shu/zh-Hans.ts only if the existing 64 seed summaries need a named export; preserve all existing reading text.

Interfaces:
- Produces ZH_HANS_HEXAGRAM_CONTENT: Readonly<Record<number, ZhHansHexagramDetailContent>>.
- Each record provides a per-hexagram theme, core meaning seed, practical reading, support, caution, no-changing-lines explanation, three reflection questions, six line-structure explanations, and optional allowlisted scene module.
- zhHansHexagramContent(number) throws a stable missing-data error and never accepts a user question or AI output.

- [ ] Step 1: Define the content type around factual reuse and authored interpretation. Include number, theme, coreMeaning, practicalUnderstanding, supports, watchFor, unchanging, reflectionQuestions, and exactly six lineNotes; keep classical judgment/image/line text sourced from CLASSICAL_HEXAGRAMS rather than duplicating it as editable prose.
- [ ] Step 2: Promote the existing Chinese core meanings as seeds. Reuse the 64 SUMMARY_BY_NUMBER strings through a named static export or a one-time copied data block; do not change their text or route the public page through the Mei Hua reading model.
- [ ] Step 3: Add per-number authored structure data. Give every number distinct theme/practical/caution/reflection/line-note content. Use position-aware language (初爻/二爻/三爻/四爻/五爻/上爻), classical text as source, and grounded probabilistic phrasing; do not build one name-replacement template or introduce deterministic fortune claims.
- [ ] Step 4: Encode the 14-page scene allowlist. Add relationship modules only for 8, 13, 16, 22, 24, 25, 39, 43, 44, 45, 56; career/work only for 15 and 28; fortune/吉凶 only for 48; all other entries have sceneModule undefined.
- [ ] Step 5: Add terminology and safety tests. Scan all Chinese content for forbidden deterministic phrases, inaccurate loose 六爻 usage, unsupported 六爻 system claims, machine-translation markers, and missing required terms (易经, 周易, 起卦, 本卦, 动爻, 之卦, 卦辞, 爻辞). Test all 64 records have six non-empty line notes and one substantive unchanging explanation.
- [ ] Step 6: Run the content gate. Run bunx vitest run src/content/hexagrams/zh-Hans.test.ts; expected result is 64 complete records and exactly 14 scene modules.

### Task 3: Upgrade route registry, localized hub, sitemap, and language switching

Files:
- Modify: src/i18n/routes.ts
- Modify: src/i18n/helpers.ts
- Modify: src/i18n/helpers.test.ts
- Modify: src/i18n/seo-metadata.test.ts
- Modify: src/components/language-switcher.tsx only if current-path resolution needs a server-safe route id
- Create: src/app/(localized)/zh/hexagrams/page.tsx
- Modify: src/app/(default)/hexagrams/page.tsx only to preserve its existing English TDH and add no Chinese metadata
- Modify: src/app/sitemap.ts only through registry-derived inventory

Interfaces:
- ROUTE_REGISTRY contains one paired route for each English/Chinese detail slug and one Chinese Hub route marked PENDING_RESEARCH outside the 128-page TDH registry.
- alternateLanguages(routeId) returns en, zh-Hans, and x-default with x-default equal to the English detail URL.
- languageSwitchTarget("hexagram:<slug>", locale) is one-to-one between /hexagrams/<slug> and /zh/hexagrams/<slug>.
- indexablePathInventory() returns 140 unique indexable paths: 73 English + /zh + /zh/methods/mei-hua-yi-shu + /zh/hexagrams + 64 Chinese details.

- [ ] Step 1: Derive paired detail routes from the 64 canonical English paths. Replace englishOnlyRoute for detail pages with hreflangGroup true, switchable true, both renderable/indexable paths, and the same semantic slug.
- [ ] Step 2: Add the Chinese Hub route. Register /zh/hexagrams as renderable/indexable for zh-Hans only if the app’s indexation policy permits the necessary information architecture, keep its metadata descriptive and explicitly PENDING_RESEARCH, and do not add it to the 128-page TDH registry.
- [ ] Step 3: Make inventories registry-derived. Avoid hand-maintained count constants; generate Chinese detail paths from the same 64 canonical entries and assert no /hexagrams/1 aliases, no /line-1 paths, and no private/result paths.
- [ ] Step 4: Add route/helper tests. Assert English slug equality, paired route count 64, reciprocal alternates, x-default English, self-canonical path normalization, language switches in both directions, 140 inventory, and no duplicate/trailing-slash URLs.
- [ ] Step 5: Implement the Chinese Hub. Link all 64 Chinese details with descriptive anchor text, a concise temporary title/description, no independent keyword claims, and links to the existing Chinese entry point; ensure it is excluded from the 128 exact TDH/density pass.
- [ ] Step 6: Run route/sitemap tests. Run bunx vitest run src/i18n/helpers.test.ts src/i18n/seo-metadata.test.ts; expected result is a 140-path sitemap inventory and no private URL.

### Task 4: Render exact English/Chinese detail pages with static HTML and metadata

Files:
- Create: src/app/(localized)/zh/hexagrams/[slug]/page.tsx
- Modify: src/app/(default)/hexagrams/[slug]/page.tsx
- Create: src/components/hexagram-detail-page.tsx
- Create: src/components/hexagram-detail-page.test.tsx
- Modify: src/domain/public-reading/knowledge.ts only if it needs a locale-neutral static data helper; do not change algorithms or classical data.

Interfaces:
- Both routes export generateStaticParams() for all 64 slugs and generateMetadata() from the exact locale-specific SEO row.
- Both pages render a single exact H1, self-canonical metadata, exact Open Graph URL, lang from the root layout, JSON-LD WebPage + BreadcrumbList, six #line-1…#line-6 anchors, and complete visible main/article HTML without client-only SEO injection.
- The shared component receives { locale, knowledge, seo, content, previous, next } and emits locale-specific labels/links without changing factual values.

- [ ] Step 1: Add a server-only page data loader. Resolve slug to the existing classical entity, static interpretation catalog, typed SEO row, and (for zh-Hans) typed content; return notFound() for unknown slugs so the localized catch-all remains a noindex 404.
- [ ] Step 2: Render the English detail page using exact workbook TDH. Keep Judgment/Image/six source lines/provenance/catalog values and existing authored interpretation; add clear primary/secondary coverage, unchanging reading, and required special sections for 23, 52, 54, 61, and 64 without changing the English Hub TDH or creating new URLs.
- [ ] Step 3: Render the Chinese detail page as native structured content. Include 卦序、卦名、完整卦名、卦象、上下卦、卦辞、大象、six classical 爻辞/source links、核心含义、现实理解、支持/警惕、six line notes、无动爻、reflection questions、previous/next, Chinese Hub, Chinese entry, and a clear start-casting CTA. Use Chinese paths for primary detail navigation; English links are explicitly marked only where no Chinese Guide exists.
- [ ] Step 4: Implement special modules and safety copy. Hexagram 23 includes Bo/Splitting Apart without fatalism; 52 includes substantive Line 3; 54 includes relationships/romance with position, reciprocity, consent, dignity and no outcome prediction; 61 includes substantive Line 5; 64 preserves singular entity intent and does not target the 64-page Hub phrase.
- [ ] Step 5: Add reciprocal metadata and structured data. Use alternateLanguages(routeId) for both pages, absolute canonical/OG/JSON-LD/breadcrumb URLs from canonicalUrl, inLanguage en or zh-Hans, and exactly one H1; do not allow the layout title template to append a second brand by using title.absolute or the project’s exact metadata pattern.
- [ ] Step 6: Add component/page tests. Assert all 128 metadata rows are exact/unique, all routes statically parameterize 64 slugs, all pages contain six line ids and no line route, all required special modules exist, Chinese module allowlist is enforced, and the English homepage/Chinese homepage metadata modules remain unchanged.
- [ ] Step 7: Run focused page tests and a production build smoke test. Run bunx vitest run src/components/hexagram-detail-page.test.tsx src/app/route-architecture.test.ts; run bun run build after the route compiles and confirm both detail route families are present in the generated build.

### Task 5: Add deterministic 128-page TDH and density audit gates

Files:
- Create: scripts/hexagram-seo-density-audit.mjs
- Create: scripts/hexagram-seo-density-audit.test.mjs or a Vitest wrapper under src/content/hexagrams/
- Create: scripts/hexagram-seo-html-gate.mjs
- Modify: package.json with explicit seo:hexagram-registry, seo:hexagram-density, and seo:hexagram-html scripts only
- Modify: .github/workflows/public-seo-v1.yml to run the new gates without weakening existing gates

Interfaces:
- node scripts/hexagram-seo-density-audit.mjs --base-url <url> --out <json> fetches every 128 canonical detail URL and writes one JSON row per URL plus a summary.
- Each row contains locale, primary, main token count, exact Primary count/density, approved-family match count/density, brand body count, TDH/early-copy/body/inbound-anchor placements, PASS|WARN|FAIL, and a page-specific exception reason when outside 3%–5%.
- The audit uses NFKC; English Unicode letter/number tokens and case-insensitive phrase matches; Chinese protected phrases sorted longest-first, non-overlapping, then Intl.Segmenter("zh-Hans", { granularity: "word" }) for remaining word-like segments.

- [ ] Step 1: Implement the HTML main/article extractor. Parse only main/article visible text, remove header, footer, nav, buttons, cookie/consent, JSON-LD, scripts, styles, and shared legal/safety boilerplate; fail if no detail article can be isolated rather than claiming a pass.
- [ ] Step 2: Implement phrase matching. Count exact Primary separately; count approved Primary/Secondary/family phrases with non-overlap; protect Chinese longest phrases and prevent nested family double-counting; count body brand phrases separately.
- [ ] Step 3: Implement placement checks. Assert Primary appears in final title, H1, meta description, early visible copy, body/heading, and at least one inbound detail anchor as declared by the workbook; report absent placements with field-specific failures.
- [ ] Step 4: Implement the 128-row gate. Fetch/parse every canonical URL, require exactly 128 rows, require canonical/OG/JSON-LD/hreflang/one-H1/line-anchor checks, and output deterministic JSON plus a compact stdout summary. Do not enforce a mechanical exact-primary percentage floor.
- [ ] Step 5: Add targeted audit fixtures. Use fixture HTML for one English and one Chinese page to test tokenization, nested phrases, excluded chrome, brand cap, line anchors, and specific below/above-band explanations; test no generic “all pages” exception text is accepted.
- [ ] Step 6: Wire CI. Run registry, HTML, and density gates against a production server in the existing public SEO workflow; preserve existing homepage, locale, casting, result, privacy, and performance gates.
- [ ] Step 7: Run the scripts locally against the built app. Save the JSON report outside the tracked scope or in the task output directory, inspect all 128 rows, and fix only value-adding content if a page is low/high; document genuine naturalness exceptions instead of stuffing.

### Task 6: Strengthen browser SEO, privacy, performance, and regression gates

Files:
- Modify: scripts/on-page-seo-browser-gate.mjs
- Modify: scripts/multilingual-browser-gate.mjs
- Modify: scripts/homepage-seo-audit.mjs only if needed to assert the frozen baseline
- Create: scripts/hexagram-browser-gate.mjs
- Modify/add: focused tests under src/app/, src/i18n/, src/lib/, and src/domain/ only where new behavior requires them
- Modify: .github/workflows/public-seo-v1.yml only to run the gates and existing bundle/lighthouse checks

- [ ] Step 1: Replace four-page detail sampling with full route coverage. The browser gate visits all 128 detail URLs for status, title/description/H1 exactness, one H1, canonical/OG URL, locale, reciprocal hreflang, JSON-LD, six line anchors, index/follow, and no client-only body dependency; retain detailed assertions for 1/23/52/54/61/64.
- [ ] Step 2: Test navigation in both languages. From English details switch to the same Chinese slug and back, from the Chinese Hub open details, verify previous/next and method CTA links, and ensure Chinese primary detail navigation does not silently route to English.
- [ ] Step 3: Test HTTP/static boundaries. Assert all 64 English and 64 Chinese details return 200 from the production build, /zh/hexagrams returns 200, /zh/hexagrams/1 and all /line-1 style aliases remain 404/noindex, and no 308 trailing-slash normalization is needed for canonical URLs.
- [ ] Step 4: Run mobile/desktop readability assertions. Use 390px and 1440px viewports, assert no horizontal overflow, visible H1/main sections, keyboard focus for language switcher and line anchors, and no console/page errors; do not produce screenshots.
- [ ] Step 5: Protect private routes and algorithms. Run existing casting, yarrow, Mei Hua, reading, History, Turnstile/AI, privacy/noindex and bundle tests unchanged; add sitemap assertions that no private/result URL is emitted.
- [ ] Step 6: Compare homepage/performance baselines. Run the homepage exact metadata/content gate before and after; run existing bundle and Lighthouse/performance scripts; treat any changed homepage TDH/H1/core flow or clear bundle regression as a failure requiring repair/report.

### Task 7: Final verification, commit, push, and non-Draft PR

Files:
- Modify only confirmed task files from Tasks 1–6.
- Create: PR description from the verified report; do not commit generated local browser artifacts, .playwright-mcp/, or unrelated outputs/ files.

- [ ] Step 1: Run the full local matrix. Run bun run lint, bun run typecheck, bun run test, bun run build, all existing browser gates, the new registry/HTML/density gates, sitemap/route tests, bundle/performance gates, and git diff --check; record exit codes and actual summaries.
- [ ] Step 2: Review the final tracked scope. Run git status --short, git diff --stat, and git diff --check; confirm only the requested implementation/plan files are staged and .playwright-mcp/ and outputs/ remain untracked and untouched.
- [ ] Step 3: Commit the confirmed implementation. Stage explicit paths only and commit feat: implement 128 hexagram SEO and Chinese detail pages; do not stage the attached workbook or browser artifacts unless separately requested.
- [ ] Step 4: Push without force. Push agent/hexagram-seo-zh-128-v1 to origin, then verify local HEAD equals the upstream branch SHA and the worktree is clean apart from preserved unrelated untracked files.
- [ ] Step 5: Create exactly one non-Draft PR. Use base main, head agent/hexagram-seo-zh-128-v1, title matching the commit, and include baseline SHA, branch SHA, 64+64 counts, Hub PENDING_RESEARCH, 140 indexable URLs, sitemap count, exact TDH uniqueness/mismatches, density band/exception/brand results, hreflang/canonical/JSON-LD/anchors, all validation results, homepage freeze evidence, and unresolved issues. Set draft false because the user explicitly requested a non-Draft PR.
- [ ] Step 6: Verify remote PR metadata and CI. Read the created PR once, confirm base/head/SHA/non-Draft/no merge, and inspect Actions. If a check fails, fix only regressions introduced by this PR; never delete or weaken gates. Do not merge or deploy.

## Self-review checklist

- Workbook exact TDH is the source of every 128 rendered title/description/H1; no new keyword research or silent rewrite is present.
- English slugs and authored classical/interpretation data remain intact; Chinese pages share entity facts but have separate native content.
- Chinese Hub is descriptive and PENDING_RESEARCH, while the 128-page registry excludes it from exact TDH/density counts.
- Route registry, sitemap, canonical, Open Graph, breadcrumbs, JSON-LD, language switcher, and x-default all resolve to the same normalized URLs.
- All six line anchors are same-page only; no 384 line routes or 4096 combinations are added.
- Density scope and tokenizer are deterministic, visible-main-only, phrase-protected for Chinese, and exception reasons are page-specific.
- Homepage, private/noindex pages, casting, reading, History, AI safety, and performance gates remain protected.
- Final response will distinguish verified PASS, WARN, and blocked external checks; no unverified browser/CI/PR result will be presented as success.
