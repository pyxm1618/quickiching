# Quick I Ching Multilingual V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the English-default/Simplified-Chinese-`/zh` multilingual foundation and publish only the Chinese homepage and Mei Hua current-time flow without changing casting facts, English URLs, or private-route behavior.

**Architecture:** Keep English URLs unprefixed inside `(default)` and expose Chinese pages inside `(localized)/[locale]`, with separate root layouts producing `lang="en"` and `lang="zh-Hans"`. A single typed locale/route registry owns public segments, equivalent-page relationships, canonical URLs, hreflang, switch targets, indexation, and sitemap inventory. Server pages load locale dictionaries and localized Mei Hua content, then pass only the selected serializable UI/result content into the shared client casting components.

**Tech Stack:** Next.js 15.5 App Router, React 19, TypeScript, Vitest, native Next Metadata, Tailwind CSS, existing `PublicReading`/casting domain.

**Spec:** User-provided task “Quick I Ching 多语言 V1 开发任务” pasted in `/Users/milushangdi/.codex/attachments/e9dd9d32-162d-41a6-b907-3d25e7ccac0c/pasted-text.txt`.

## Global Constraints

- English remains the unprefixed public locale; Chinese uses `/zh`, while the internal locale is `zh-Hans`.
- Only `en` and `zh-Hans` are active; unsupported locale paths return a real 404.
- Do not introduce an i18n dependency, browser-language redirect, IP redirect, global middleware rewrite, or client-side `<html lang>` mutation.
- Do not alter Three-Coin, Yarrow, Mei Hua arithmetic, King Wen mapping, changing-line calculation, English slugs, Question-first semantics, English History, or English Personalized Interpretation behavior.
- Chinese V1 exposes only `/zh` and `/zh/methods/mei-hua-yi-shu`; no Chinese hexagram SEO pages or other Chinese method pages are indexable.
- Chinese AI and History controls are hidden; no Chinese reading silently routes to English History or English AI output.
- Canonical URLs are absolute, self-referencing, slashless except `/`; equivalent pages emit the same bidirectional `en`, `zh-Hans`, and `x-default` alternates.
- Sitemap derives from the registry, preserves the 73-page English baseline, and adds exactly the two real Chinese pages.
- Preserve unrelated existing `.gitignore` and `.playwright-mcp/` worktree changes; never add them to phase commits.
- Do not push, deploy, create a PR, create a worktree, switch branches, stash, reset, restore, or delete user files.

---

### Task 1: Locale and route registry foundation

**Files:**
- Create: `src/i18n/config.ts`
- Create: `src/i18n/routes.ts`
- Create: `src/i18n/helpers.ts`
- Create: `src/i18n/dictionaries/types.ts`
- Modify: `src/lib/seo.ts`
- Create: `src/i18n/helpers.test.ts`
- Modify: `src/lib/seo.test.ts`

**Interfaces:**
- `ContentLocale = "en" | "zh-Hans"`.
- `LocaleDefinition = { contentLocale, publicSegment, htmlLang, hreflang }`.
- `LocalizedRouteDefinition = { id, paths, renderable, indexable, hreflangGroup, switchable }`.
- `validatePublicLocale(value: string): ContentLocale` throws/returns failure for every value except the empty English segment and `zh` route segment.
- `publicPath(locale, pathnameWithoutLocale): string` returns an English slashless path or `/zh`-prefixed path.
- `canonicalUrl(path): string`, `alternateLanguages(routeId): Record<string,string> | undefined`, `languageSwitchTarget(routeId, locale): { href, label, equivalent }`.
- `indexableUrlInventory(): readonly string[]` and `sitemapUrlInventory(): readonly string[]` return deduplicated absolute canonical URLs.

- [ ] **Step 1: Write failing registry tests** for the two active locales, rejection of `ja`/`zh-Hans` public paths, homepage and Mei Hua equivalence, no Chinese equivalent for Three-Coin/hexagram routes, self-canonical URLs, `x-default`, two added sitemap URLs, duplicate/slash checks, and unchanged English hexagram slugs.
- [ ] **Step 2: Run the focused tests** with `npm test -- src/i18n/helpers.test.ts src/lib/seo.test.ts`; confirm failure because the registry modules and new inventory behavior do not exist.
- [ ] **Step 3: Implement the minimal typed registry/helpers** and make `INDEXABLE_PATHS` remain the 73 English paths while exposing the localized inventory separately.
- [ ] **Step 4: Run the focused tests** again and confirm all registry assertions pass without changing the existing English sitemap contract.
- [ ] **Step 5: Commit only Task 1 files** with `git add src/i18n src/lib/seo.ts src/lib/seo.test.ts && git commit -m "feat: add multilingual locale registry"`.

### Task 2: Root layouts and route architecture

**Files:**
- Create: `src/app/(default)/layout.tsx`
- Create: `src/app/(localized)/[locale]/layout.tsx`
- Create: `src/app/(localized)/[locale]/not-found.tsx`
- Move: every existing `page.tsx` route and the current `not-found.tsx` from `src/app` into `src/app/(default)/` without changing its URL path.
- Delete: `src/app/layout.tsx` after its behavior is preserved in `(default)/layout.tsx`.
- Modify: `next.config.mjs`
- Modify: `next.config.test.mjs`
- Create: `src/app/route-architecture.test.ts`

**Interfaces:**
- Default root layout renders `<html lang="en">` and the existing English header/footer/analytics.
- Localized root layout accepts `{ params: Promise<{ locale: string }> }`, permits only `zh`, renders `<html lang="zh-Hans">`, and calls `notFound()` for any other segment.
- Existing `api`, `sitemap.ts`, `robots.ts`, `global-not-found.tsx`, assets, actions, and middleware remain at `src/app` root.

- [ ] **Step 1: Write failing route tests** asserting the route-group files exist, localized static params contain only `{ locale: "zh" }`, unsupported locale validation calls `notFound`, and the two `/en` patterns are permanent redirects to unprefixed paths.
- [ ] **Step 2: Run the focused route/config tests** and confirm the missing files/redirects fail.
- [ ] **Step 3: Add both root layouts, move only route files mechanically, and add `/en/:path*` permanent redirect rules**; do not change middleware matchers or route semantics.
- [ ] **Step 4: Run `npm run typecheck` and the focused route tests**, then run a clean `npm run build` to catch App Router/global-not-found incompatibilities.
- [ ] **Step 5: Commit only route-architecture files and moved routes** with `git add 'src/app' next.config.mjs next.config.test.mjs && git commit -m "refactor: split English and localized root layouts"`.

### Task 3: Server dictionaries and Chinese content model

**Files:**
- Create: `src/i18n/dictionaries/en.ts`
- Create: `src/i18n/dictionaries/zh-Hans.ts`
- Create: `src/i18n/dictionaries/index.ts`
- Create: `src/content/mei-hua-yi-shu/en.ts`
- Create: `src/content/mei-hua-yi-shu/zh-Hans.ts`
- Create: `src/content/mei-hua-yi-shu/types.ts`
- Create: `src/content/mei-hua-yi-shu/zh-Hans.test.ts`

**Interfaces:**
- `UiDictionary` covers navigation, Question-first, Mei Hua controls/errors, reading labels, safety copy, and language-switch labels.
- `MeiHuaPageContent` covers title/description/H1, positioning, current-time convention, usage, interpretation, FAQ/links, and structured-data language.
- `LocalizedReadingContent` contains 64 authored Chinese core summaries keyed by King Wen number, six structural changing-line templates, and grounded reflection/safety text; it must not import English interpretation bundles.
- `getDictionary(locale)` and `getMeiHuaContent(locale)` are server-safe selectors; client components receive selected serializable values as props.

- [ ] **Step 1: Write failing content tests** requiring 64 Chinese entries, no forbidden deterministic-prediction phrases, explicit Gregorian/十二时辰/non-unique-traditional-rule wording, and no claims of Chinese Three-Coin/Yarrow/History/AI support.
- [ ] **Step 2: Run `npm test -- src/content/mei-hua-yi-shu/zh-Hans.test.ts`; confirm the content modules are missing.
- [ ] **Step 3: Implement the English/Chinese dictionary and content modules**, authoring concise Chinese summaries for all 64 hexagrams and generic six-position structural line templates rather than pretending they are classical line texts.
- [ ] **Step 4: Run the focused content tests and `npm run typecheck`**.
- [ ] **Step 5: Commit the dictionaries/content with `git add src/i18n/dictionaries src/content && git commit -m "feat: add English and Simplified Chinese reading content"`.

### Task 4: Chinese pages and localized casting UI

**Files:**
- Create: `src/app/(localized)/[locale]/page.tsx`
- Create: `src/app/(localized)/[locale]/methods/mei-hua-yi-shu/page.tsx`
- Modify: `src/components/public-reading/question-first.tsx`
- Modify: `src/components/public-reading/mei-hua-tool.tsx`
- Modify: `src/domain/public-reading/static-reading.ts`
- Modify: `src/components/public-reading/public-reading-result.tsx`
- Modify: `src/components/public-reading/personalized-interpretation.tsx`
- Modify: `src/components/site-header.tsx`
- Modify: `src/components/site-footer.tsx`
- Create: `src/components/language-switcher.tsx`
- Create: `src/components/public-reading/localized-reading.test.tsx`

**Interfaces:**
- Existing English component props remain source-compatible through English defaults; localized pages pass `locale="zh-Hans"`, selected UI dictionary, and localized reading content.
- `PublicReadingResult` chooses localized display content from props but always renders the same `PublicReading` facts and fingerprint.
- Chinese result controls omit Personalized Interpretation, Save/View History, and English result links; any English hexagram link is visibly labeled `英文卦义详情`.
- `LanguageSwitcher` resolves current pathname through the route registry; it offers direct equivalents only for `/` and Mei Hua, and otherwise offers a separately labeled `中文首页` target.

- [ ] **Step 1: Write failing localized UI tests** for Question-first copy, timezone validation, Chinese reading labels/core output, hidden AI/History controls, stable fingerprint/line facts, reset behavior, and no unmarked English result labels.
- [ ] **Step 2: Run the focused UI/domain tests** and confirm the expected locale props/content behavior is absent.
- [ ] **Step 3: Pass dictionary/content props through QuestionFirst/MeiHuaTool/PublicReadingResult**, add Chinese pages with `generateStaticParams`, and keep English defaults unchanged.
- [ ] **Step 4: Run the focused tests, full `npm test`, `npm run lint`, and `npm run typecheck`**; inspect bundle imports to ensure Chinese content is selected server-side rather than imported into every English route.
- [ ] **Step 5: Commit localized page/UI changes with `git add src/app src/components src/domain/public-reading && git commit -m "feat: publish Simplified Chinese Mei Hua flow"`.

### Task 5: Metadata, hreflang, sitemap, robots, redirects, and slash policy

**Files:**
- Modify: localized and English homepage/Mei Hua page metadata
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/robots.ts`
- Modify: `src/lib/seo.ts`
- Modify: relevant page links in the localized flow
- Modify: `src/middleware.ts` only if tests prove a matcher conflict; preserve all existing private/API/gone semantics.
- Extend: `src/i18n/helpers.test.ts`, `src/lib/seo.test.ts`, `next.config.test.mjs`

**Interfaces:**
- English homepage/Mei Hua and Chinese homepage/Mei Hua emit absolute self-canonical URLs and the same `en`, `zh-Hans`, `x-default` alternate set.
- Pages without Chinese equivalents emit no `zh-Hans` alternate.
- `sitemap()` maps registry inventory and contains exactly 75 URLs: the stable 73 English URLs plus `/zh` and `/zh/methods/mei-hua-yi-shu`.

- [ ] **Step 1: Add failing metadata/sitemap/redirect tests** for exact URL sets, absolute canonical output, alternates, no `/en`, no nonexistent `/zh` entries, and no trailing slash except root.
- [ ] **Step 2: Run focused tests and confirm the current metadata/sitemap behavior fails the new requirements.
- [ ] **Step 3: Wire route registry helpers into metadata/sitemap/robots and normalize only in-scope trailing-slash links; add the permanent `/en` redirect rules.
- [ ] **Step 4: Run full unit tests and inspect rendered metadata in a production server.
- [ ] **Step 5: Commit SEO integration with `git add src/app src/i18n src/lib/seo.ts next.config.mjs src/middleware.ts && git commit -m "feat: integrate multilingual SEO routes"`.

### Task 6: Browser, regression, and performance gates

**Files:**
- Create: `scripts/multilingual-browser-gate.mjs`
- Modify: relevant existing browser gate only where its hard-coded 73-URL English assertion must use the registry-derived expected set.
- Create: `src/app/multilingual-regression.test.ts`
- Create or extend: public reading/result tests for Mei Hua timezone, changing-line and transformation invariants.

**Interfaces:**
- Browser gate uses `PUBLIC_V1_TEST_BASE_URL` and the existing Chrome resolution convention, emits text only, and verifies status/headers/source HTML/flow text at desktop, iPhone-width, and Android-width viewports.

- [ ] **Step 1: Write the browser/regression assertions** for English `lang`, Chinese `lang`, no Accept-Language redirect, metadata source HTML, `/en` redirects, unsupported 404s, Chinese question→cast→primary/moving/relating result, stable result fingerprint across language targets, all existing English method routes, sitemap, and robots.
- [ ] **Step 2: Run the new gate against the current implementation and confirm failures identify missing V1 behavior.
- [ ] **Step 3: Fix only failures caused by this V1 change; preserve public reading algorithm inputs/outputs and existing private/API route closure.
- [ ] **Step 4: Run lint, typecheck, all unit tests, a clean production build, the multilingual browser gate, relevant existing browser gates, and Lighthouse/bundle gates.
- [ ] **Step 5: Review `git diff`, verify only intended files are staged/committed, and record any pre-existing build/performance blocker separately from V1 findings.

## Final verification checklist

- [ ] `git status` shows the unrelated `.gitignore`/`.playwright-mcp` artifacts preserved and no accidental edits.
- [ ] `npm run lint` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0 with algorithm/regression coverage intact.
- [ ] `npm run build` exits 0 from a clean build directory.
- [ ] Browser source/flow checks pass for English, Chinese, redirects, 404s, and three viewport classes.
- [ ] Sitemap has 75 real canonical URLs and robots exposes the canonical sitemap without blocking `/zh`.
- [ ] No push, deployment, or PR was performed.
